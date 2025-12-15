/**
 * Network graph data builder
 *
 * Transforms asks and offers into graph nodes and links for visualization.
 * Used by the experimental forest view.
 */

import { listAsks } from "./asks";
import { listOffers } from "./offers";
import { useGraphqlForNetwork } from "@/lib/graph/featureFlags";
import type { Ask } from "./asks";
import type { Offer } from "./offers";
import type { NetworkGraphData, NetworkGraphNode, NetworkGraphLink } from "@/lib/types";

type NetworkGraphParams = {
  skillFilter?: string;
  limitAsks?: number;
  limitOffers?: number;
  includeExpired?: boolean;
};

/**
 * Build graph data using Arkiv JSON-RPC (direct calls)
 *
 * This is the original implementation that directly queries Arkiv entities.
 * Used as fallback when GraphQL is disabled or fails.
 */
async function buildNetworkGraphDataJsonRpc(params: NetworkGraphParams): Promise<NetworkGraphData> {
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  const limitAsks = params.limitAsks ?? 25;
  const limitOffers = params.limitOffers ?? 25;
  const skillFilter = params.skillFilter?.toLowerCase().trim();
  const includeExpired = params.includeExpired ?? false;

  // Fetch asks and offers via Arkiv JSON-RPC
  // Note: listAsks and listOffers don't support skill filtering in params yet
  // We'll filter client-side for now
  const [asks, offers] = await Promise.all([
    listAsks({ limit: limitAsks, includeExpired }),
    listOffers({ limit: limitOffers, includeExpired }),
  ]);

  // Filter asks/offers based on expiration unless explicitly including expired
  const now = Date.now();
  const activeAsks = asks
    .filter((ask) => {
      const created = new Date(ask.createdAt).getTime();
      const expires = created + ask.ttlSeconds * 1000;
      const isActive = expires > now;

      if (!includeExpired && !isActive) return false;

      if (skillFilter) {
        const askSkill = ask.skill?.toLowerCase().trim() || "";
        return askSkill.includes(skillFilter);
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitAsks);

  const activeOffers = offers
    .filter((offer) => {
      const created = new Date(offer.createdAt).getTime();
      const expires = created + offer.ttlSeconds * 1000;
      const isActive = expires > now;

      if (!includeExpired && !isActive) return false;

      if (skillFilter) {
        const offerSkill = offer.skill?.toLowerCase().trim() || "";
        return offerSkill.includes(skillFilter);
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitOffers);

  // Collect unique skills and normalize
  const skillSet = new Set<string>();
  activeAsks.forEach((ask) => {
    if (ask.skill) {
      skillSet.add(ask.skill.toLowerCase().trim());
    }
  });
  activeOffers.forEach((offer) => {
    if (offer.skill) {
      skillSet.add(offer.skill.toLowerCase().trim());
    }
  });

  // Create nodes
  const nodes: NetworkGraphNode[] = [];
  const nodeMap = new Map<string, NetworkGraphNode>();

  // Create skill nodes
  skillSet.forEach((skillName) => {
    const nodeId = `skill:${skillName}`;
    const node: NetworkGraphNode = {
      id: nodeId,
      type: "skill",
      label: skillName,
      skillName: skillName,
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  });

  // Create ask nodes
  activeAsks.forEach((ask) => {
    const nodeId = `ask:${ask.key}`;
    const skillName = ask.skill?.toLowerCase().trim() || "unknown";
    const node: NetworkGraphNode = {
      id: nodeId,
      type: "ask",
      label: skillName,
      wallet: ask.wallet,
      skillName: skillName,
      createdAt: ask.createdAt,
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  });

  // Create offer nodes
  activeOffers.forEach((offer) => {
    const nodeId = `offer:${offer.key}`;
    const skillName = offer.skill?.toLowerCase().trim() || "unknown";
    const node: NetworkGraphNode = {
      id: nodeId,
      type: "offer",
      label: skillName,
      wallet: offer.wallet,
      skillName: skillName,
      createdAt: offer.createdAt,
      isPaid: offer.isPaid,
      cost: offer.cost,
      availabilityWindow: offer.availabilityWindow,
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
  });

  // Create links
  const links: NetworkGraphLink[] = [];
  const linkSet = new Set<string>(); // For deduplication

  // Ask-skill links
  activeAsks.forEach((ask) => {
    const askNodeId = `ask:${ask.key}`;
    const skillName = ask.skill?.toLowerCase().trim();
    if (skillName) {
      const skillNodeId = `skill:${skillName}`;
      const linkKey = `${askNodeId}-${skillNodeId}`;
      if (!linkSet.has(linkKey) && nodeMap.has(askNodeId) && nodeMap.has(skillNodeId)) {
        links.push({
          source: askNodeId,
          target: skillNodeId,
          type: "ask-skill",
        });
        linkSet.add(linkKey);
      }
    }
  });

  // Offer-skill links
  activeOffers.forEach((offer) => {
    const offerNodeId = `offer:${offer.key}`;
    const skillName = offer.skill?.toLowerCase().trim();
    if (skillName) {
      const skillNodeId = `skill:${skillName}`;
      const linkKey = `${offerNodeId}-${skillNodeId}`;
      if (!linkSet.has(linkKey) && nodeMap.has(offerNodeId) && nodeMap.has(skillNodeId)) {
        links.push({
          source: offerNodeId,
          target: skillNodeId,
          type: "offer-skill",
        });
        linkSet.add(linkKey);
      }
    }
  });

  // Match links (ask + offer with same skill, different wallets)
  activeAsks.forEach((ask) => {
    const askSkill = ask.skill?.toLowerCase().trim();
    if (!askSkill) return;

    activeOffers.forEach((offer) => {
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
          const now = Date.now();
          const askAge = now - new Date(ask.createdAt).getTime();
          const offerAge = now - new Date(offer.createdAt).getTime();
          const maxAge = Math.max(askAge, offerAge);
          const hoursOld = maxAge / (1000 * 60 * 60);
          const score = Math.max(0, 1 - hoursOld / 24); // Decay over 24 hours

          links.push({
            source: askNodeId,
            target: offerNodeId,
            type: "match",
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
    const skillNodes = nodes.filter((n) => n.type === "skill");
    const entityNodes = nodes.filter((n) => n.type !== "skill");
    const maxEntityNodes = 100 - skillNodes.length;

    if (maxEntityNodes > 0 && entityNodes.length > maxEntityNodes) {
      // Sort by creation date (newest first) and take top N
      entityNodes.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      const keptEntityNodes = entityNodes.slice(0, maxEntityNodes);
      const keptNodeIds = new Set([...skillNodes, ...keptEntityNodes].map((n) => n.id));

      // Filter nodes and links to only include kept nodes
      const filteredNodes = nodes.filter((n) => keptNodeIds.has(n.id));
      const filteredLinks = links.filter(
        (link) => keptNodeIds.has(link.source) && keptNodeIds.has(link.target)
      );

      const result = {
        nodes: filteredNodes,
        links: filteredLinks,
      };

      // Record performance metrics
      const durationMs =
        typeof performance !== "undefined" ? performance.now() - startTime : Date.now() - startTime;
      const payloadBytes = JSON.stringify(result).length;

      // Record performance sample (async, don't block)
      import("@/lib/metrics/perf")
        .then(({ recordPerfSample }) => {
          recordPerfSample({
            source: "arkiv",
            operation: "buildNetworkGraphData",
            route: "/network",
            durationMs: Math.round(durationMs),
            payloadBytes,
            httpRequests: 4, // listAsks (2) + listOffers (2) = 4 total
            createdAt: new Date().toISOString(),
          });
        })
        .catch(() => {
          // Silently fail if metrics module not available
        });

      return result;
    }
  }

  const result = {
    nodes,
    links,
  };

  // Record performance metrics
  const durationMs =
    typeof performance !== "undefined" ? performance.now() - startTime : Date.now() - startTime;
  const payloadBytes = JSON.stringify(result).length;

  // Record performance sample (async, don't block)
  import("@/lib/metrics/perf")
    .then(({ recordPerfSample }) => {
      recordPerfSample({
        source: "arkiv",
        operation: "buildNetworkGraphData",
        route: "/network",
        durationMs: Math.round(durationMs),
        payloadBytes,
        httpRequests: 4, // listAsks (2) + listOffers (2) = 4 total
        createdAt: new Date().toISOString(),
      });
    })
    .catch(() => {
      // Silently fail if metrics module not available
    });

  return result;
}

/**
 * Build graph data from asks and offers
 *
 * Uses GraphQL API when enabled (via feature flag), falls back to JSON-RPC.
 *
 * @param options - Filtering and limiting options
 * @returns Graph data with nodes and links
 */
export async function buildNetworkGraphData(
  options?: NetworkGraphParams
): Promise<NetworkGraphData> {
  if (!useGraphqlForNetwork()) {
    return buildNetworkGraphDataJsonRpc(options || {});
  }

  // Track performance for GraphQL path (same pattern as JSON-RPC path)
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const { fetchNetworkOverview } = await import("@/lib/graph/networkQueries");
    const { adaptNetworkOverviewToGraphData } = await import("@/lib/graph/networkAdapter");

    const overview = await fetchNetworkOverview({
      skillFilter: options?.skillFilter,
      limitAsks: options?.limitAsks,
      limitOffers: options?.limitOffers,
      includeExpired: options?.includeExpired,
    });

    const result = adaptNetworkOverviewToGraphData(overview, {
      skillFilter: options?.skillFilter,
      limitAsks: options?.limitAsks,
      limitOffers: options?.limitOffers,
      includeExpired: options?.includeExpired,
    });

    // Record performance metrics for GraphQL path (same pattern as JSON-RPC)
    const durationMs =
      typeof performance !== "undefined" ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(result).length;

    // Record performance sample (async, don't block)
    import("@/lib/metrics/perf")
      .then(({ recordPerfSample }) => {
        recordPerfSample({
          source: "graphql",
          operation: "buildNetworkGraphData",
          route: "/network",
          durationMs: Math.round(durationMs),
          payloadBytes,
          httpRequests: 1, // Single GraphQL query
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Silently fail if metrics module not available
      });

    return result;
  } catch (err) {
    // Log + fallback to JSON-RPC for safety
    console.error("[networkGraph] GraphQL path failed, falling back to JSON-RPC", err);

    // Track fallback event
    const fallbackStartTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const fallbackResult = await buildNetworkGraphDataJsonRpc(options || {});
    const fallbackDurationMs =
      typeof performance !== "undefined"
        ? performance.now() - fallbackStartTime
        : Date.now() - fallbackStartTime;
    const fallbackPayloadBytes = JSON.stringify(fallbackResult).length;

    // Record fallback performance sample
    import("@/lib/metrics/perf")
      .then(({ recordPerfSample }) => {
        recordPerfSample({
          source: "arkiv",
          operation: "buildNetworkGraphData",
          route: "/network",
          durationMs: Math.round(fallbackDurationMs),
          payloadBytes: fallbackPayloadBytes,
          httpRequests: 2, // JSON-RPC typically needs 2 requests (asks + offers)
          status: "success",
          usedFallback: true, // Track that this was a fallback
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Silently fail if metrics module not available
      });

    return fallbackResult;
  }
}
