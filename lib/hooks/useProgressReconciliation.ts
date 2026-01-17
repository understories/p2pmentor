/**
 * Progress Reconciliation Hook
 *
 * Manages optimistic UI updates for quest step completion
 * with indexer lag reconciliation.
 *
 * Provides:
 * - Immediate "submitted" state for responsive UI
 * - Polling for indexer confirmation
 * - State transitions: pending → submitted → indexed | error
 *
 * Reference: refs/docs/jan26plan.md - Week 1 Day 3-4
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { QuestStepEvidence } from '@/lib/arkiv/questStep';

/**
 * Status of a pending step completion
 */
export type ReconciliationStatus = 'pending' | 'submitted' | 'indexed' | 'error';

/**
 * Pending step data
 */
export interface PendingStep {
  stepId: string;
  status: ReconciliationStatus;
  evidence: QuestStepEvidence;
  txHash?: string;
  entityKey?: string;
  error?: string;
  submittedAt: number; // timestamp
}

/**
 * Polling configuration
 */
export interface PollingConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_POLLING_CONFIG: PollingConfig = {
  maxAttempts: 10,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 1.5,
};

/**
 * Hook for managing optimistic progress updates with reconciliation
 */
export function useProgressReconciliation(
  pollingConfig: Partial<PollingConfig> = {}
) {
  const config = { ...DEFAULT_POLLING_CONFIG, ...pollingConfig };
  const [pendingSteps, setPendingSteps] = useState<Map<string, PendingStep>>(new Map());
  const pollingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      pollingTimers.current.forEach((timer) => clearTimeout(timer));
      pollingTimers.current.clear();
    };
  }, []);

  /**
   * Update a pending step's status
   */
  const updateStepStatus = useCallback((
    stepId: string,
    updates: Partial<PendingStep>
  ) => {
    setPendingSteps((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(stepId);
      if (existing) {
        newMap.set(stepId, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  /**
   * Start polling for indexer confirmation
   */
  const startPolling = useCallback((
    stepId: string,
    txHash: string,
    checkFn: () => Promise<boolean>,
    attempt: number = 0
  ) => {
    if (attempt >= config.maxAttempts) {
      // Max attempts reached - leave as submitted (user can refresh)
      console.warn(`[useProgressReconciliation] Max polling attempts for ${stepId}`);
      return;
    }

    const delay = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelayMs
    );

    const timer = setTimeout(async () => {
      try {
        const isIndexed = await checkFn();
        if (isIndexed) {
          updateStepStatus(stepId, { status: 'indexed' });
          pollingTimers.current.delete(stepId);
        } else {
          // Continue polling
          startPolling(stepId, txHash, checkFn, attempt + 1);
        }
      } catch (error) {
        console.error(`[useProgressReconciliation] Polling error for ${stepId}:`, error);
        // Continue polling on error
        startPolling(stepId, txHash, checkFn, attempt + 1);
      }
    }, delay);

    pollingTimers.current.set(stepId, timer);
  }, [config, updateStepStatus]);

  /**
   * Record a step as pending (optimistic update)
   */
  const markPending = useCallback((stepId: string, evidence: QuestStepEvidence) => {
    setPendingSteps((prev) => {
      const newMap = new Map(prev);
      newMap.set(stepId, {
        stepId,
        status: 'pending',
        evidence,
        submittedAt: Date.now(),
      });
      return newMap;
    });
  }, []);

  /**
   * Mark step as submitted and start polling
   */
  const markSubmitted = useCallback((
    stepId: string,
    txHash: string,
    entityKey: string,
    checkFn: () => Promise<boolean>
  ) => {
    updateStepStatus(stepId, {
      status: 'submitted',
      txHash,
      entityKey,
    });

    // Start polling for indexer confirmation
    startPolling(stepId, txHash, checkFn);
  }, [updateStepStatus, startPolling]);

  /**
   * Mark step as indexed (manually, e.g., from query result)
   */
  const markIndexed = useCallback((stepId: string) => {
    updateStepStatus(stepId, { status: 'indexed' });

    // Cancel any pending polling
    const timer = pollingTimers.current.get(stepId);
    if (timer) {
      clearTimeout(timer);
      pollingTimers.current.delete(stepId);
    }
  }, [updateStepStatus]);

  /**
   * Mark step as error
   */
  const markError = useCallback((stepId: string, error: string) => {
    updateStepStatus(stepId, {
      status: 'error',
      error,
    });

    // Cancel any pending polling
    const timer = pollingTimers.current.get(stepId);
    if (timer) {
      clearTimeout(timer);
      pollingTimers.current.delete(stepId);
    }
  }, [updateStepStatus]);

  /**
   * Clear a step from pending (e.g., after refresh)
   */
  const clearStep = useCallback((stepId: string) => {
    setPendingSteps((prev) => {
      const newMap = new Map(prev);
      newMap.delete(stepId);
      return newMap;
    });

    // Cancel any pending polling
    const timer = pollingTimers.current.get(stepId);
    if (timer) {
      clearTimeout(timer);
      pollingTimers.current.delete(stepId);
    }
  }, []);

  /**
   * Clear all pending steps
   */
  const clearAll = useCallback(() => {
    setPendingSteps(new Map());
    pollingTimers.current.forEach((timer) => clearTimeout(timer));
    pollingTimers.current.clear();
  }, []);

  /**
   * Get status for a specific step
   */
  const getStepStatus = useCallback((stepId: string): PendingStep | undefined => {
    return pendingSteps.get(stepId);
  }, [pendingSteps]);

  /**
   * Check if any steps are pending submission
   */
  const hasPendingSteps = pendingSteps.size > 0;

  /**
   * Get all pending step IDs
   */
  const pendingStepIds = Array.from(pendingSteps.keys());

  return {
    // State
    pendingSteps,
    hasPendingSteps,
    pendingStepIds,

    // Actions
    markPending,
    markSubmitted,
    markIndexed,
    markError,
    clearStep,
    clearAll,

    // Queries
    getStepStatus,
  };
}

/**
 * Simple hook for tracking a single step's submission status
 */
export function useStepSubmission() {
  const [status, setStatus] = useState<ReconciliationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus(null);
    setError(null);
  }, []);

  const setPending = useCallback(() => {
    setStatus('pending');
    setError(null);
  }, []);

  const setSubmitted = useCallback(() => {
    setStatus('submitted');
  }, []);

  const setIndexed = useCallback(() => {
    setStatus('indexed');
  }, []);

  const setFailed = useCallback((errorMessage: string) => {
    setStatus('error');
    setError(errorMessage);
  }, []);

  return {
    status,
    error,
    isLoading: status === 'pending' || status === 'submitted',
    isSuccess: status === 'indexed',
    isError: status === 'error',
    reset,
    setPending,
    setSubmitted,
    setIndexed,
    setFailed,
  };
}
