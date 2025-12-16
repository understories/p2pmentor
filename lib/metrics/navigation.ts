/**
 * Navigation Metrics Types
 *
 * Privacy-preserving navigation tracking types.
 * All data is aggregated before submission (no individual tracking).
 */

export type NavigationAggregate = {
  pattern: string; // e.g., "/network→/profiles" or "click:/network:button"
  count: number;
};

export type NavigationMetric = {
  aggregates: NavigationAggregate[];
  page: string;
  createdAt: string;
};

