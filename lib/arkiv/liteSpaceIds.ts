/**
 * Lite Space IDs Discovery
 *
 * Queries all lite_ask and lite_offer entities from Arkiv network
 * to discover all unique space IDs that have been used.
 *
 * This enables the /lite page to show all space IDs created by any user,
 * not just those stored in localStorage.
 */

import { eq } from "@arkiv-network/sdk/query"
import { getPublicClient } from "./client"
import { CURRENT_WALLET } from "@/lib/config"

/**
 * Space ID metadata
 */
export type SpaceIdMetadata = {
  spaceId: string;
  askCount: number;
  offerCount: number;
  totalEntities: number;
  mostRecentActivity: string; // ISO timestamp
  isP2pmentorSpace: boolean; // Created by our app's signing wallet
  hasActiveEntities: boolean; // Has non-expired entities
}

/**
 * Get all unique space IDs with metadata from lite entities on Arkiv network
 *
 * Queries all lite_ask and lite_offer entities (without spaceId filter)
 * and extracts unique space IDs with metadata from their attributes.
 *
 * @param options - Filtering options
 * @returns Array of space IDs with metadata, sorted by relevance
 */
export async function getAllLiteSpaceIds(options?: {
  filter?: 'p2pmentor' | 'network' | 'all';
  minEntities?: number;
  recentDays?: number; // Only include spaces with activity in last N days
}): Promise<SpaceIdMetadata[]> {
  try {
    const publicClient = getPublicClient();
    const currentWallet = CURRENT_WALLET?.toLowerCase();
    const filter = options?.filter || 'all';
    const minEntities = options?.minEntities || 0;
    const recentDays = options?.recentDays;
    const recentCutoff = recentDays ? Date.now() - (recentDays * 24 * 60 * 60 * 1000) : null;

    // Query all lite_ask and lite_offer entities without spaceId filter
    // We query both types to ensure we discover all space IDs
    const [asksResult, offersResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'lite_ask'))
        .withAttributes(true)
        .limit(1000) // High limit to get all entities
        .fetch()
        .catch(() => ({ entities: [] })),
      publicClient.buildQuery()
        .where(eq('type', 'lite_offer'))
        .withAttributes(true)
        .limit(1000) // High limit to get all entities
        .fetch()
        .catch(() => ({ entities: [] })),
    ]);

    // Helper to extract attribute value
    const getAttr = (attrs: any, key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Track metadata per space ID
    const spaceIdMap = new Map<string, {
      askCount: number;
      offerCount: number;
      mostRecentActivity: number; // timestamp
      isP2pmentorSpace: boolean;
      hasActiveEntities: boolean;
    }>();

    // Process lite_ask entities
    if (asksResult?.entities && Array.isArray(asksResult.entities)) {
      asksResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const spaceId = getAttr(attrs, 'spaceId')?.trim();
        if (!spaceId) return;

        const createdAt = getAttr(attrs, 'createdAt');
        const createdAtTime = createdAt ? new Date(createdAt).getTime() : 0;
        const ttlSeconds = parseInt(getAttr(attrs, 'ttlSeconds') || '2592000', 10);
        const expiresAt = createdAtTime + (ttlSeconds * 1000);
        const isActive = Date.now() < expiresAt;

        const signerWallet = getAttr(attrs, 'signer_wallet')?.toLowerCase();
        const isP2pmentor = !!(currentWallet && signerWallet === currentWallet);

        if (!spaceIdMap.has(spaceId)) {
          spaceIdMap.set(spaceId, {
            askCount: 0,
            offerCount: 0,
            mostRecentActivity: createdAtTime,
            isP2pmentorSpace: isP2pmentor,
            hasActiveEntities: isActive,
          });
        }

        const metadata = spaceIdMap.get(spaceId)!;
        metadata.askCount++;
        if (createdAtTime > metadata.mostRecentActivity) {
          metadata.mostRecentActivity = createdAtTime;
        }
        if (isActive) {
          metadata.hasActiveEntities = true;
        }
        // If we found a p2pmentor entity, mark the space as p2pmentor
        if (isP2pmentor) {
          metadata.isP2pmentorSpace = true;
        }
      });
    }

    // Process lite_offer entities
    if (offersResult?.entities && Array.isArray(offersResult.entities)) {
      offersResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const spaceId = getAttr(attrs, 'spaceId')?.trim();
        if (!spaceId) return;

        const createdAt = getAttr(attrs, 'createdAt');
        const createdAtTime = createdAt ? new Date(createdAt).getTime() : 0;
        const ttlSeconds = parseInt(getAttr(attrs, 'ttlSeconds') || '2592000', 10);
        const expiresAt = createdAtTime + (ttlSeconds * 1000);
        const isActive = Date.now() < expiresAt;

        const signerWallet = getAttr(attrs, 'signer_wallet')?.toLowerCase();
        const isP2pmentor = !!(currentWallet && signerWallet === currentWallet);

        if (!spaceIdMap.has(spaceId)) {
          spaceIdMap.set(spaceId, {
            askCount: 0,
            offerCount: 0,
            mostRecentActivity: createdAtTime,
            isP2pmentorSpace: isP2pmentor,
            hasActiveEntities: isActive,
          });
        }

        const metadata = spaceIdMap.get(spaceId)!;
        metadata.offerCount++;
        if (createdAtTime > metadata.mostRecentActivity) {
          metadata.mostRecentActivity = createdAtTime;
        }
        if (isActive) {
          metadata.hasActiveEntities = true;
        }
        // If we found a p2pmentor entity, mark the space as p2pmentor
        if (isP2pmentor) {
          metadata.isP2pmentorSpace = true;
        }
      });
    }

    // Convert to array and apply filters
    let results: SpaceIdMetadata[] = Array.from(spaceIdMap.entries()).map(([spaceId, meta]) => ({
      spaceId,
      askCount: meta.askCount,
      offerCount: meta.offerCount,
      totalEntities: meta.askCount + meta.offerCount,
      mostRecentActivity: new Date(meta.mostRecentActivity).toISOString(),
      isP2pmentorSpace: meta.isP2pmentorSpace,
      hasActiveEntities: meta.hasActiveEntities,
    }));

    // Apply filters
    if (filter === 'p2pmentor') {
      results = results.filter(r => r.isP2pmentorSpace);
    } else if (filter === 'network') {
      results = results.filter(r => !r.isP2pmentorSpace);
    }

    if (minEntities > 0) {
      results = results.filter(r => r.totalEntities >= minEntities);
    }

    if (recentCutoff) {
      results = results.filter(r => new Date(r.mostRecentActivity).getTime() >= recentCutoff);
    }

    // Sort by relevance: total entities (desc), then most recent activity (desc)
    results.sort((a, b) => {
      if (b.totalEntities !== a.totalEntities) {
        return b.totalEntities - a.totalEntities;
      }
      return new Date(b.mostRecentActivity).getTime() - new Date(a.mostRecentActivity).getTime();
    });

    return results;
  } catch (error: any) {
    // CRITICAL: Catch ANY error and return empty array
    // This ensures the function NEVER throws, making it safe for API routes
    console.error('[getAllLiteSpaceIds] Unexpected error, returning empty array:', {
      message: error?.message,
      stack: error?.stack,
      error: error?.toString()
    });
    return [];
  }
}

/**
 * Get simple array of space IDs (backward compatibility)
 *
 * @param options - Filtering options
 * @returns Array of space ID strings
 */
export async function getAllLiteSpaceIdsSimple(options?: {
  filter?: 'p2pmentor' | 'network' | 'all';
  minEntities?: number;
  recentDays?: number;
}): Promise<string[]> {
  const metadata = await getAllLiteSpaceIds(options);
  return metadata.map(m => m.spaceId);
}
