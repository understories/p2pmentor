/**
 * Performance metrics tracking
 * 
 * Tracks performance of Arkiv JSON-RPC vs GraphQL for key flows.
 * Used for DX documentation and admin panel insights.
 * 
 * Reference: refs/docs/sprint2.md Section 2
 */

/**
 * Performance sample for a single operation
 */
export type PerfSample = {
  source: 'graphql' | 'arkiv';
  operation: string;
  route?: string; // e.g. '/network'
  durationMs: number;
  payloadBytes?: number;
  httpRequests?: number;
  createdAt: string; // ISO timestamp
};

/**
 * In-memory storage for performance samples
 * Capped at MAX_SAMPLES to prevent memory bloat
 */
const MAX_SAMPLES = 200;
const samples: PerfSample[] = [];

/**
 * Check if performance logging is enabled
 */
function isPerfLoggingEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    // Disabled by default, enable with ENABLE_PERF_LOGGING=true
    return process.env.ENABLE_PERF_LOGGING === 'true';
  }
  // Client-side: enabled by default for development
  return typeof window !== 'undefined';
}

/**
 * Record a performance sample
 * 
 * Stores sample in-memory (capped at MAX_SAMPLES).
 * Future: Can extend to persist to Arkiv entities for long-term storage.
 * 
 * @param sample - Performance sample to record
 */
export function recordPerfSample(sample: PerfSample): void {
  if (!isPerfLoggingEnabled()) {
    return;
  }

  // Add to in-memory buffer
  samples.push(sample);

  // Enforce cap: remove oldest samples if over limit
  if (samples.length > MAX_SAMPLES) {
    samples.shift(); // Remove oldest
  }

  // Optional: Log to console in development
  // Guard process.env access for browser context
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
    console.log(`[Perf] ${sample.source} ${sample.operation}: ${sample.durationMs}ms`, {
      route: sample.route,
      payloadBytes: sample.payloadBytes,
      httpRequests: sample.httpRequests,
    });
  }
}

/**
 * Get all stored performance samples
 * 
 * @returns Array of performance samples (most recent first)
 */
export function getPerfSamples(): PerfSample[] {
  return [...samples].reverse(); // Most recent first
}

/**
 * Get performance samples filtered by criteria
 * 
 * @param filters - Optional filters
 * @returns Filtered performance samples
 */
export function getPerfSamplesFiltered(filters?: {
  source?: 'graphql' | 'arkiv';
  operation?: string;
  route?: string;
  since?: string; // ISO timestamp
}): PerfSample[] {
  let filtered = getPerfSamples();

  if (filters?.source) {
    filtered = filtered.filter(s => s.source === filters.source);
  }

  if (filters?.operation) {
    filtered = filtered.filter(s => s.operation === filters.operation);
  }

  if (filters?.route) {
    filtered = filtered.filter(s => s.route === filters.route);
  }

  if (filters?.since) {
    const sinceTime = new Date(filters.since).getTime();
    filtered = filtered.filter(s => new Date(s.createdAt).getTime() >= sinceTime);
  }

  return filtered;
}

/**
 * Clear all stored performance samples
 */
export function clearPerfSamples(): void {
  samples.length = 0;
}

/**
 * Get performance summary for an operation
 * 
 * Aggregates samples by source and operation to show comparisons.
 */
export function getPerfSummary(operation: string, route?: string): {
  graphql?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
  };
  arkiv?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
  };
} {
  const filters = { operation, route };
  const graphqlSamples = getPerfSamplesFiltered({ ...filters, source: 'graphql' });
  const arkivSamples = getPerfSamplesFiltered({ ...filters, source: 'arkiv' });

  const summarize = (samples: PerfSample[]) => {
    if (samples.length === 0) return undefined;

    const durations = samples.map(s => s.durationMs);
    const payloadSizes = samples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
    const httpCounts = samples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);

    return {
      avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
      avgPayloadBytes: payloadSizes.length > 0
        ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length
        : undefined,
      avgHttpRequests: httpCounts.length > 0
        ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length
        : undefined,
      samples: samples.length,
    };
  };

  return {
    graphql: summarize(graphqlSamples),
    arkiv: summarize(arkivSamples),
  };
}

