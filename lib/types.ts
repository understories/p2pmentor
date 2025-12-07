/**
 * Shared TypeScript types
 * 
 * Common types used across the application.
 */

/**
 * Wallet address type (Ethereum address format)
 */
export type WalletAddress = `0x${string}`;

/**
 * Entity key from Arkiv
 */
export type EntityKey = string;

/**
 * Transaction hash
 */
export type TxHash = `0x${string}`;

/**
 * Graph visualization types for network forest view
 */

export type GraphNodeType = "ask" | "offer" | "skill";

export interface NetworkGraphNode {
  id: string;          // unique ID, e.g. ask:<id>, offer:<id>, skill:<skillName>
  type: GraphNodeType;
  label: string;       // skill or short description
  wallet?: string;     // wallet address for ask/offer nodes
  skillName?: string;  // normalized skill name (lowercase)
  createdAt?: string;  // ISO string for sorting / tooltips
}

export type GraphLinkType = "ask-skill" | "offer-skill" | "match";

export interface NetworkGraphLink {
  source: string;        // node.id
  target: string;        // node.id
  type: GraphLinkType;
  score?: number;        // for match strength if needed
}

export interface NetworkGraphData {
  nodes: NetworkGraphNode[];
  links: NetworkGraphLink[];
}

