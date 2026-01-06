/**
 * Public data contracts for the explorer
 * 
 * Defines the shape of public entities exposed via the explorer API.
 * All entities include ALL data stored on Arkiv to demonstrate transparency.
 * All data shown here is verifiable via transaction hashes.
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
  type: 'profile' | 'ask' | 'offer' | 'skill' | 'lite_ask' | 'lite_offer';
  wallet?: string;
  title?: string;
  summary?: string;
  createdAt?: string;
  txHash?: string;
  provenance?: Provenance | null;
}

/**
 * Public profile (all fields stored on Arkiv)
 */
export interface PublicProfile extends PublicEntity {
  type: 'profile';
  wallet: string;
  displayName: string;
  username?: string;
  profileImage?: string;
  identity_seed?: string;
  exploringStatement?: string;
  bio?: string;
  bioShort?: string;
  bioLong?: string;
  skills?: string;
  skillsArray?: string[];
  skillExpertise?: Record<string, number>;
  timezone?: string;
  languages?: string[];
  contactLinks?: {
    twitter?: string;
    github?: string;
    telegram?: string;
    discord?: string;
  };
  seniority?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  domainsOfInterest?: string[];
  mentorRoles?: string[];
  learnerRoles?: string[];
  availabilityWindow?: string;
  sessionsCompleted?: number;
  sessionsGiven?: number;
  sessionsReceived?: number;
  npsScore?: number;
  topSkillsUsage?: Array<{ skill: string; count: number }>;
  peerTestimonials?: Array<{ text: string; timestamp: string; fromWallet: string }>;
  trustEdges?: Array<{ toWallet: string; strength: number; createdAt: string }>;
  communityAffiliations?: string[];
  reputationScore?: number;
  lastActiveTimestamp?: string;
  spaceId?: string;
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
  spaceId?: string;
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
  spaceId?: string;
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
  spaceId?: string;
}

/**
 * Public lite ask (all fields are public by design)
 */
export interface PublicLiteAsk extends PublicEntity {
  type: 'lite_ask';
  name: string;
  discordHandle: string;
  skill: string;
  description?: string;
  status: string;
  spaceId: string;
  ttlSeconds: number;
}

/**
 * Public lite offer (all fields are public by design)
 */
export interface PublicLiteOffer extends PublicEntity {
  type: 'lite_offer';
  name: string;
  discordHandle: string;
  skill: string;
  description?: string;
  cost?: string;
  status: string;
  spaceId: string;
  ttlSeconds: number;
}

