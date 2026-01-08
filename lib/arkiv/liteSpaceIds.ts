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

/**
 * Get all unique space IDs from lite entities on Arkiv network
 * 
 * Queries all lite_ask and lite_offer entities (without spaceId filter)
 * and extracts unique space IDs from their attributes.
 * 
 * @returns Array of unique space IDs found in the network
 */
export async function getAllLiteSpaceIds(): Promise<string[]> {
  try {
    const publicClient = getPublicClient();
    
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

    // Extract space IDs from entities
    const spaceIds = new Set<string>();

    // Process lite_ask entities
    if (asksResult?.entities && Array.isArray(asksResult.entities)) {
      asksResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const spaceId = getAttr('spaceId');
        if (spaceId && spaceId.trim()) {
          spaceIds.add(spaceId.trim());
        }
      });
    }

    // Process lite_offer entities
    if (offersResult?.entities && Array.isArray(offersResult.entities)) {
      offersResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const spaceId = getAttr('spaceId');
        if (spaceId && spaceId.trim()) {
          spaceIds.add(spaceId.trim());
        }
      });
    }

    // Convert Set to sorted array
    const uniqueSpaceIds = Array.from(spaceIds).sort();

    return uniqueSpaceIds;
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
