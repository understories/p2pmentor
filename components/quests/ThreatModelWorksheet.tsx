/**
 * Threat Model Worksheet Component
 *
 * Interactive form for building a personal threat model.
 * Stores structured threat model data as quest step evidence.
 *
 * Week 3 (Feb 15-21) - Web3 privacy track
 */

'use client';

import { useState } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';

interface Threat {
  id: string;
  threat: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

interface ThreatModelWorksheetProps {
  onComplete?: (model: { threats: Threat[]; assumptions: string; topPriority: string }) => void;
}

const EXAMPLE_THREATS: Partial<Threat>[] = [
  {
    threat: 'Wallet address linked to real identity via exchange KYC',
    likelihood: 'high',
    impact: 'high',
  },
  {
    threat: 'Transaction patterns reveal financial activity',
    likelihood: 'medium',
    impact: 'medium',
  },
  {
    threat: 'ENS name links on-chain activity to social identity',
    likelihood: 'high',
    impact: 'medium',
  },
  { threat: 'Clipboard malware replaces wallet addresses', likelihood: 'low', impact: 'high' },
];

export function ThreatModelWorksheet({ onComplete }: ThreatModelWorksheetProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const [threats, setThreats] = useState<Threat[]>([]);
  const [assumptions, setAssumptions] = useState('');
  const [topPriority, setTopPriority] = useState('');
  const [newThreat, setNewThreat] = useState('');
  const [newLikelihood, setNewLikelihood] = useState<'low' | 'medium' | 'high'>('medium');
  const [newImpact, setNewImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [newMitigation, setNewMitigation] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const addThreat = () => {
    if (!newThreat.trim()) return;
    const threat: Threat = {
      id: `threat-${Date.now()}`,
      threat: newThreat.trim(),
      likelihood: newLikelihood,
      impact: newImpact,
      mitigation: newMitigation.trim(),
    };
    setThreats([...threats, threat]);
    setNewThreat('');
    setNewMitigation('');
    setNewLikelihood('medium');
    setNewImpact('medium');
  };

  const removeThreat = (id: string) => {
    setThreats(threats.filter((t) => t.id !== id));
  };

  const addExampleThreat = (example: Partial<Threat>) => {
    const threat: Threat = {
      id: `threat-${Date.now()}`,
      threat: example.threat || '',
      likelihood: example.likelihood || 'medium',
      impact: example.impact || 'medium',
      mitigation: '',
    };
    setThreats([...threats, threat]);
  };

  const handleSubmit = () => {
    if (threats.length < 2) return;
    setSubmitted(true);
    onComplete?.({
      threats,
      assumptions,
      topPriority,
    });
  };

  const riskColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20">
        <h3 className="mb-2 text-lg font-semibold text-emerald-800 dark:text-emerald-200">
          Threat Model Complete
        </h3>
        <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-300">
          You identified {threats.length} threats. Your top priority: &ldquo;
          {topPriority || threats[0]?.threat}&rdquo;
        </p>
        <div className="space-y-2">
          {threats.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              <span className={`rounded px-1.5 py-0.5 text-xs ${riskColor(t.likelihood)}`}>
                {t.likelihood}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{t.threat}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
      <h3 className="mb-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
        Personal Threat Model
      </h3>
      <p className="mb-4 text-sm text-amber-800 dark:text-amber-200">
        Identify threats to your on-chain privacy, assess their likelihood and impact, and plan
        mitigations. Add at least 2 threats to complete this step.
      </p>

      {arkivBuilderMode && (
        <ArkivQueryTooltip
          query={[
            `Evidence stored in quest_step_progress payload:`,
            `{ evidenceType: 'checklist_completion',`,
            `  threatModel: { threats, assumptions, topPriority } }`,
          ]}
          label="Threat Model Evidence"
        >
          <div className="mb-3 text-xs text-amber-600">Arkiv Builder Mode: hover for details</div>
        </ArkivQueryTooltip>
      )}

      {/* Example threats */}
      {threats.length === 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            Common Web3 privacy threats (click to add):
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_THREATS.map((ex, i) => (
              <button
                key={i}
                onClick={() => addExampleThreat(ex)}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-gray-800 dark:text-amber-200 dark:hover:bg-gray-700"
              >
                + {ex.threat?.slice(0, 40)}...
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing threats */}
      {threats.length > 0 && (
        <div className="mb-4 space-y-2">
          {threats.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-gray-800"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t.threat}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${riskColor(t.likelihood)}`}>
                    Likelihood: {t.likelihood}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${riskColor(t.impact)}`}>
                    Impact: {t.impact}
                  </span>
                </div>
                {t.mitigation && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Mitigation: {t.mitigation}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeThreat(t.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new threat form */}
      <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-gray-800">
        <input
          type="text"
          value={newThreat}
          onChange={(e) => setNewThreat(e.target.value)}
          placeholder="Describe a threat..."
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <div className="flex gap-4">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Likelihood:
            <select
              value={newLikelihood}
              onChange={(e) => setNewLikelihood(e.target.value as 'low' | 'medium' | 'high')}
              className="ml-1 rounded border px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Impact:
            <select
              value={newImpact}
              onChange={(e) => setNewImpact(e.target.value as 'low' | 'medium' | 'high')}
              className="ml-1 rounded border px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <input
          type="text"
          value={newMitigation}
          onChange={(e) => setNewMitigation(e.target.value)}
          placeholder="Mitigation strategy (optional)"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <button
          onClick={addThreat}
          disabled={!newThreat.trim()}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          Add Threat
        </button>
      </div>

      {/* Assumptions */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-amber-800 dark:text-amber-200">
          Your assumptions (optional):
        </label>
        <textarea
          value={assumptions}
          onChange={(e) => setAssumptions(e.target.value)}
          placeholder="e.g., I use a hardware wallet, I don't have an ENS name..."
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          rows={2}
        />
      </div>

      {/* Top priority */}
      {threats.length >= 2 && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-amber-800 dark:text-amber-200">
            Which threat is your top priority to address?
          </label>
          <select
            value={topPriority}
            onChange={(e) => setTopPriority(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Select...</option>
            {threats.map((t) => (
              <option key={t.id} value={t.threat}>
                {t.threat}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={threats.length < 2}
        className={`rounded-lg px-4 py-2 font-medium transition-colors ${
          threats.length < 2
            ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
            : 'bg-amber-600 text-white hover:bg-amber-700'
        }`}
      >
        Complete Threat Model ({threats.length}/2 minimum threats)
      </button>
    </div>
  );
}
