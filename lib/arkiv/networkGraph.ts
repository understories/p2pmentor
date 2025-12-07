/**
 * Network graph data builder
 * 
 * Transforms asks and offers into graph nodes and links for visualization.
 * Used by the experimental forest view.
 */

import { listAsks } from './asks';
import { listOffers } from './offers';
import type { Ask } from './asks';
import type { Offer } from './offers';
import type { NetworkGraphData, NetworkGraphNode, NetworkGraphLink } from '@/lib/types';

/**
 * Build graph data from asks and offers
 * 
 * @param options - Filtering and limiting options
 * @returns Graph data with nodes and links
 */
export async function buildNetworkGraphData(options?: {
  skillFilter?: string;
  limitAsks?: number;
  limitOffers?: number;
}): Promise<NetworkGraphData> {
  const limitAsks = options?.limitAsks ?? 25;
  const limitOffers = options?.limitOffers ?? 25;
  const skillFilter = options?.skillFilter?.toLowerCase().trim();

  // Fetch asks and offers
  // Note: listAsks and listOffers don't support skill filtering in params yet
  // We'll filter client-side for now
  const [asks, offers] = await Promise.all([
    listAsks(),
    listOffers(),
  ]);

  // Filter active asks/offers (not expired) and apply skill filter if provided
  const now = Date.now();
  let activeAsks = asks
    .filter(ask => {
      const created = new Date(ask.createdAt).getTime();
      const expires = created + (ask.ttlSeconds * 1000);
      const isActive = expires > now;
      
      // Apply skill filter if provided
      if (skillFilter) {
        const askSkill = ask.skill?.toLowerCase().trim() || '';
        return isActive && askSkill.includes(skillFilter);
      }
      
      return isActive;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitAsks);

  let activeOffers = offers
    .filter(offer => {
      const created = new Date(offer.createdAt).getTime();
      const expires = created + (offer.ttlSeconds * 1000);
      const isActive = expires > now;
      
      // Apply skill filter if provided
      if (skillFilter) {
        const offerSkill = offer.skill?.toLowerCase().trim() || '';
        return isActive && offerSkill.includes(skillFilter);
      }
      
      return isActive;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitOffers);

  // Collect unique skills and normalize
  const skillSet = new Set<string>();
  activeAsks.forEach(ask => {
    if (ask.skill) {
      skillSet.add(ask.skill.toLowerCase().trim());
    }
  });
  activeOffers.forEach(offer => {
    if (offer.skill) {
      skillSet.add(offer.skill.toLowerCase().trim());
    }
  });

  // Create nodes
  const nodes: NetworkGraphNode[] = [];
  const nodeMap = new Map<string, NetworkGraphNode>();

  // Create skill nodes
  skillSet.forEach(skillName => {
    const nodeId = `skill:${skillName}`;
    const node: NetworkGraphNode = {
      id: nodeId,
      type: 'skill',
      label: skillName,
      skillName: skillName,
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  });

  // Create ask nodes
  activeAsks.forEach(ask => {
    const nodeId = `ask:${ask.key}`;
    const skillName = ask.skill?.toLowerCase().trim() || 'unknown';
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
  });

  // Create offer nodes
  activeOffers.forEach(offer => {
    const nodeId = `offer:${offer.key}`;
    const skillName = offer.skill?.toLowerCase().trim() || 'unknown';
    const node: NetworkGraphNode = {
      id: nodeId,
      type: 'offer',
      label: skillName,
      wallet: offer.wallet,
      skillName: skillName,
      createdAt: offer.createdAt,
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  });

  // Create links
  const links: NetworkGraphLink[] = [];
  const linkSet = new Set<string>(); // For deduplication

  // Ask-skill links
  activeAsks.forEach(ask => {
    const askNodeId = `ask:${ask.key}`;
    const skillName = ask.skill?.toLowerCase().trim();
    if (skillName) {
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
  });

  // Offer-skill links
  activeOffers.forEach(offer => {
    const offerNodeId = `offer:${offer.key}`;
    const skillName = offer.skill?.toLowerCase().trim();
    if (skillName) {
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
  });

  // Match links (ask + offer with same skill, different wallets)
  activeAsks.forEach(ask => {
    const askSkill = ask.skill?.toLowerCase().trim();
    if (!askSkill) return;

    activeOffers.forEach(offer => {
      const offerSkill = offer.skill?.toLowerCase().trim();
      if (!offerSkill) return;

      // Match if same skill and different wallets
      if (askSkill === offerSkill && ask.wallet.toLowerCase() !== offer.wallet.toLowerCase()) {
        const askNodeId = `ask:${ask.key}`;
        const offerNodeId = `offer:${offer.key}`;
        
        // Ensure both nodes exist
        if (!nodeMap.has(askNodeId) || !nodeMap.has(offerNodeId)) return;

        // Create bidirectional link (only add once)
        const linkKey1 = `${askNodeId}-${offerNodeId}`;
        const linkKey2 = `${offerNodeId}-${askNodeId}`;
        
        if (!linkSet.has(linkKey1) && !linkSet.has(linkKey2)) {
          // Simple match score based on recency
          const askAge = now - new Date(ask.createdAt).getTime();
          const offerAge = now - new Date(offer.createdAt).getTime();
          const maxAge = Math.max(askAge, offerAge);
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
    });
  });

  // Enforce total node cap (100 max)
  const totalNodes = nodes.length;
  if (totalNodes > 100) {
    // Keep all skill nodes, then limit asks/offers proportionally
    const skillNodes = nodes.filter(n => n.type === 'skill');
    const entityNodes = nodes.filter(n => n.type !== 'skill');
    const maxEntityNodes = 100 - skillNodes.length;
    
    if (maxEntityNodes > 0 && entityNodes.length > maxEntityNodes) {
      // Sort by creation date (newest first) and take top N
      entityNodes.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
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

