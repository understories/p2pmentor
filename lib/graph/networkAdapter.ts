/**
 * Adapter to convert GraphQL subgraph results to network graph data format
 * 
 * Transforms raw GraphQL responses into the { nodes, links } structure used by
 * the forest view, matching the exact behavior of buildNetworkGraphData.
 * 
 * Reference: docs/graph_indexing_plan.md Section 5.2
 */

import type {
  NetworkGraphData,
  NetworkGraphNode,
  NetworkGraphLink,
} from '@/lib/types';
import type {
  GraphQLNetworkOverviewResponse,
  GraphQLSkillRef,
  GraphQLAsk,
  GraphQLOffer,
} from './networkQueries';

/**
 * Options for adapter transformation
 */
export interface AdapterOptions {
  skillFilter?: string;
  limitAsks?: number;
  limitOffers?: number;
  includeExpired?: boolean;
}

/**
 * Convert BigInt string or ISO string to timestamp (milliseconds)
 */
function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  
  // If it's a BigInt string (from subgraph), parse it
  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  
  // Otherwise try ISO string
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? null : parsed;
}

/**
 * Check if an ask/offer is expired
 */
function isExpired(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false; // No expiration means never expires
  const expires = parseTimestamp(expiresAt);
  if (!expires) return false; // Can't parse, assume not expired
  return expires <= now;
}

/**
 * Adapt GraphQL network overview response to NetworkGraphData
 * 
 * This function replicates the exact behavior of buildNetworkGraphData:
 * - Normalizes skills to lowercase
 * - Builds node IDs: ask:<id>, offer:<id>, skill:<name>
 * - Filters by expiration if includeExpired = false
 * - Applies render caps (max 100 nodes, typically 25 asks + 25 offers)
 * - Creates ask-skill, offer-skill, and match links
 * 
 * @param raw - Raw GraphQL response from fetchNetworkOverview
 * @param options - Adapter options (matching buildNetworkGraphData options)
 * @returns Network graph data in the same format as buildNetworkGraphData
 */
export function adaptNetworkOverviewToGraphData(
  raw: GraphQLNetworkOverviewResponse,
  options: AdapterOptions = {}
): NetworkGraphData {
  const {
    skillFilter,
    limitAsks = 25,
    limitOffers = 25,
    includeExpired = false,
  } = options;

  const now = Date.now();
  const skillFilterLower = skillFilter?.toLowerCase().trim();

  // Collect all asks and offers, filtering by expiration if needed
  const allAsks: Array<{ ask: GraphQLAsk; skillName: string }> = [];
  const allOffers: Array<{ offer: GraphQLOffer; skillName: string }> = [];
  const skillSet = new Set<string>();

  for (const skillRef of raw.skillRefs) {
    const skillName = skillRef.name.toLowerCase().trim();
    
    // Apply skill filter if provided
    if (skillFilterLower && !skillName.includes(skillFilterLower)) {
      continue;
    }

    skillSet.add(skillName);

    // Process asks
    for (const ask of skillRef.asks) {
      // Filter by expiration if needed
      if (!includeExpired && isExpired(ask.expiresAt, now)) {
        continue;
      }
      allAsks.push({ ask, skillName });
    }

    // Process offers
    for (const offer of skillRef.offers) {
      // Filter by expiration if needed
      if (!includeExpired && isExpired(offer.expiresAt, now)) {
        continue;
      }
      allOffers.push({ offer, skillName });
    }
  }

  // Sort by creation date (newest first) and apply limits
  allAsks.sort((a, b) => {
    const aTime = parseTimestamp(a.ask.createdAt) || 0;
    const bTime = parseTimestamp(b.ask.createdAt) || 0;
    return bTime - aTime;
  });
  allOffers.sort((a, b) => {
    const aTime = parseTimestamp(a.offer.createdAt) || 0;
    const bTime = parseTimestamp(b.offer.createdAt) || 0;
    return bTime - aTime;
  });

  const limitedAsks = allAsks.slice(0, limitAsks);
  const limitedOffers = allOffers.slice(0, limitOffers);

  // Build nodes
  const nodes: NetworkGraphNode[] = [];
  const nodeMap = new Map<string, NetworkGraphNode>();

  // Create skill nodes
  for (const skillName of skillSet) {
    const nodeId = `skill:${skillName}`;
    const node: NetworkGraphNode = {
      id: nodeId,
      type: 'skill',
      label: skillName,
      skillName: skillName,
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  }

  // Create ask nodes
  for (const { ask, skillName } of limitedAsks) {
    const nodeId = `ask:${ask.key || ask.id}`;
    const node: NetworkGraphNode = {
      id: nodeId,
      type: 'ask',
      label: skillName,
      wallet: ask.wallet,
      skillName: skillName,
      createdAt: ask.createdAt,
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  }

  // Create offer nodes
  for (const { offer, skillName } of limitedOffers) {
    const nodeId = `offer:${offer.key || offer.id}`;
    const node: NetworkGraphNode = {
      id: nodeId,
      type: 'offer',
      label: skillName,
      wallet: offer.wallet,
      skillName: skillName,
      createdAt: offer.createdAt,
      isPaid: offer.isPaid,
      cost: offer.cost || undefined,
      // Note: paymentAddress not in current NetworkGraphNode type, but available in raw data
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  }

  // Build links
  const links: NetworkGraphLink[] = [];
  const linkSet = new Set<string>(); // For deduplication

  // Ask-skill links
  for (const { ask, skillName } of limitedAsks) {
    const askNodeId = `ask:${ask.key || ask.id}`;
    const skillNodeId = `skill:${skillName}`;
    const linkKey = `${askNodeId}-${skillNodeId}`;
    
    if (!linkSet.has(linkKey) && nodeMap.has(askNodeId) && nodeMap.has(skillNodeId)) {
      links.push({
        source: askNodeId,
        target: skillNodeId,
        type: 'ask-skill',
      });
      linkSet.add(linkKey);
    }
  }

  // Offer-skill links
  for (const { offer, skillName } of limitedOffers) {
    const offerNodeId = `offer:${offer.key || offer.id}`;
    const skillNodeId = `skill:${skillName}`;
    const linkKey = `${offerNodeId}-${skillNodeId}`;
    
    if (!linkSet.has(linkKey) && nodeMap.has(offerNodeId) && nodeMap.has(skillNodeId)) {
      links.push({
        source: offerNodeId,
        target: skillNodeId,
        type: 'offer-skill',
      });
      linkSet.add(linkKey);
    }
  }

  // Match links (ask ↔ offer with same skill and different wallets)
  for (const { ask, skillName: askSkill } of limitedAsks) {
    for (const { offer, skillName: offerSkill } of limitedOffers) {
      if (
        askSkill === offerSkill &&
        ask.wallet.toLowerCase() !== offer.wallet.toLowerCase()
      ) {
        const askNodeId = `ask:${ask.key || ask.id}`;
        const offerNodeId = `offer:${offer.key || offer.id}`;
        
        if (!nodeMap.has(askNodeId) || !nodeMap.has(offerNodeId)) continue;

        // Create bidirectional link (only add once)
        const linkKey1 = `${askNodeId}-${offerNodeId}`;
        const linkKey2 = `${offerNodeId}-${askNodeId}`;
        
        if (!linkSet.has(linkKey1) && !linkSet.has(linkKey2)) {
          // Simple match score based on recency (matching buildNetworkGraphData logic)
          const askTime = parseTimestamp(ask.createdAt) || 0;
          const offerTime = parseTimestamp(offer.createdAt) || 0;
          const maxAge = Math.max(now - askTime, now - offerTime);
          const hoursOld = maxAge / (1000 * 60 * 60);
          const score = Math.max(0, 1 - (hoursOld / 24)); // Decay over 24 hours

          links.push({
            source: askNodeId,
            target: offerNodeId,
            type: 'match',
            score: score,
          });
          linkSet.add(linkKey1);
        }
      }
    }
  }

  // Enforce total node cap (100 max, matching buildNetworkGraphData)
  const totalNodes = nodes.length;
  if (totalNodes > 100) {
    // Keep all skill nodes, then limit asks/offers proportionally
    const skillNodes = nodes.filter(n => n.type === 'skill');
    const entityNodes = nodes.filter(n => n.type !== 'skill');
    const maxEntityNodes = 100 - skillNodes.length;
    
    if (maxEntityNodes > 0 && entityNodes.length > maxEntityNodes) {
      // Sort by creation date (newest first) and take top N
      entityNodes.sort((a, b) => {
        const aTime = a.createdAt ? parseTimestamp(a.createdAt) || 0 : 0;
        const bTime = b.createdAt ? parseTimestamp(b.createdAt) || 0 : 0;
        return bTime - aTime;
      });
      
      const keptEntityNodes = entityNodes.slice(0, maxEntityNodes);
      const keptNodeIds = new Set([...skillNodes, ...keptEntityNodes].map(n => n.id));
      
      // Filter nodes and links to only include kept nodes
      const filteredNodes = nodes.filter(n => keptNodeIds.has(n.id));
      const filteredLinks = links.filter(
        link => keptNodeIds.has(link.source) && keptNodeIds.has(link.target)
      );
      
      return {
        nodes: filteredNodes,
        links: filteredLinks,
      };
    }
  }

  return {
    nodes,
    links,
  };
}

