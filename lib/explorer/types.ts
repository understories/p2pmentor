/**
 * Public data contracts for the explorer
 * 
 * Defines the shape of public entities exposed via the explorer API.
 * All entities are serialized through allowlist-based serializers to ensure
 * private data is never exposed.
 */

/**
 * Transaction provenance metadata
 */
export interface Provenance {
  txHash: string;
  explorerTxUrl: string;
  blockNumber: string | null;
  blockTimestamp: number | null;
  status: 'success' | 'failed' | 'pending' | null;
}

/**
 * Base public entity structure
 */
export interface PublicEntity {
  key: string;
  type: 'profile' | 'ask' | 'offer' | 'skill';
  wallet?: string;
  title?: string;
  summary?: string;
  createdAt?: string;
  txHash?: string;
  provenance?: Provenance | null;
}

/**
 * Public profile (whitelist-only fields)
 */
export interface PublicProfile extends PublicEntity {
  type: 'profile';
  wallet: string;
  displayName: string;
  username?: string;
  bioShort?: string;
  skillsArray?: string[];
  timezone?: string;
}

/**
 * Public ask (all fields are public by design)
 */
export interface PublicAsk extends PublicEntity {
  type: 'ask';
  wallet: string;
  skill: string;
  skill_id?: string;
  skill_label?: string;
  message: string;
  status: string;
}

/**
 * Public offer (all fields are public by design)
 */
export interface PublicOffer extends PublicEntity {
  type: 'offer';
  wallet: string;
  skill: string;
  skill_id?: string;
  skill_label?: string;
  message: string;
  availabilityWindow: string;
  status: string;
  isPaid: boolean;
  cost?: string;
  paymentAddress?: string;
}

/**
 * Public skill (all fields are public by design)
 */
export interface PublicSkill extends PublicEntity {
  type: 'skill';
  name_canonical: string;
  slug: string;
  description?: string;
  status: 'active' | 'archived';
}

