/**
 * Skill CRUD helpers
 * 
 * Skills are first-class Arkiv entities for beta.
 * All user-facing flows must reference Skill.id, not free-text strings.
 * 
 * Reference: refs/doc/learner_communities_QUESTIONS.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { SPACE_ID } from "@/lib/config";

export type Skill = {
  key: string;
  name_canonical: string; // Display name (e.g., "Spanish")
  slug: string; // Normalized key (e.g., "spanish")
  description?: string;
  created_by_profile?: string; // Wallet address of creator (null for curated)
  status: 'active' | 'archived';
  spaceId: string;
  createdAt: string;
  txHash?: string;
}

/**
 * Normalize skill name to slug
 * Converts to lowercase, removes special chars, handles spaces
 */
export function normalizeSkillSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Create a Skill entity
 */
export async function createSkill({
  name_canonical,
  description,
  created_by_profile,
  privateKey,
  spaceId = SPACE_ID,
}: {
  name_canonical: string;
  description?: string;
  created_by_profile?: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  // Always create slug - this is required for topic/learning community pages
  const slug = normalizeSkillSlug(name_canonical);
  if (!slug || slug.trim() === '') {
    throw new Error(`Cannot create skill "${name_canonical}": slug normalization resulted in empty string`);
  }
  const status = 'active';

  // Skills should persist long-term (1 year)
  const expiresIn = 31536000; // 1 year in seconds

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        description: description || undefined,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'skill' },
        { key: 'name_canonical', value: name_canonical },
        { key: 'slug', value: slug },
        { key: 'status', value: status },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
        ...(created_by_profile ? [{ key: 'created_by_profile', value: created_by_profile.toLowerCase() }] : []),
      ],
      expiresIn,
    });
  });

  const { entityKey, txHash } = result;

  // Store txHash in separate entity for reliable querying
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'skill_txhash' },
        { key: 'skillKey', value: entityKey },
        { key: 'slug', value: slug },
        { key: 'spaceId', value: spaceId },
      ],
      expiresIn,
    });
  } catch (error: any) {
    console.warn('[skill] Failed to create skill_txhash entity, but skill was created:', error);
  }

  // Automatically add creator as a member of the community (if created_by_profile is provided)
  // This ensures the creator sees "Leave" instead of "Join" immediately after creation
  if (created_by_profile) {
    try {
      const { createLearningFollow } = await import('./learningFollow');
      const normalizedWallet = created_by_profile.toLowerCase();
      await createLearningFollow({
        profile_wallet: normalizedWallet,
        skill_id: entityKey,
        mode: 'learning',
        privateKey,
        spaceId,
      });
    } catch (error: any) {
      // Don't block skill creation if follow creation fails
      // This is a non-critical operation - user can manually join if needed
      console.warn('[createSkill] Failed to automatically add creator as member, but skill was created:', error);
    }
  }

  // Create notifications for all profiles when a new skill is created
  // This invites everyone to join the new learning community
  // IMPORTANT: Only notify profiles in the same spaceId to avoid cross-environment notifications
  try {
    const { createNotification } = await import('./notifications');
    const { listUserProfiles } = await import('./profile');
    
    // Get all profiles in the same spaceId
    const allProfiles = await listUserProfiles({ spaceId });
    const uniqueWallets = new Set<string>();
    allProfiles.forEach(profile => {
      // Ensure wallet is normalized and not empty
      // Also verify profile is in the same spaceId (safety check)
      const wallet = profile.wallet?.trim();
      if (wallet && wallet.length > 0 && profile.spaceId === spaceId) {
        uniqueWallets.add(wallet.toLowerCase());
      }
    });

    // Create notification for each profile
    const notificationPromises = Array.from(uniqueWallets).map(wallet => 
      createNotification({
        wallet,
        notificationType: 'new_skill_created',
        sourceEntityType: 'skill',
        sourceEntityKey: entityKey,
        title: 'New Learning Community',
        message: `Join the ${name_canonical} community!`,
        link: `/topic/${slug}`,
        metadata: {
          skillKey: entityKey,
          skillName: name_canonical,
          skillSlug: slug,
          description: description || undefined,
          createdAt,
          txHash,
        },
        privateKey,
        spaceId,
      }).catch((err: any) => {
        console.warn(`[createSkill] Failed to create notification for ${wallet}:`, err);
      })
    );

    // Don't wait for all notifications - fire and forget (non-blocking)
    Promise.all(notificationPromises).catch((err: any) => {
      console.warn('[createSkill] Some notifications failed to create:', err);
    });
  } catch (err: any) {
    // Notification creation failure shouldn't block skill creation
    console.warn('[createSkill] Error creating notifications:', err);
  }

  return { key: entityKey, txHash };
}

/**
 * List all Skills
 */
export async function listSkills({
  status,
  slug,
  spaceId,
  spaceIds,
  limit = 100,
}: {
  status?: 'active' | 'archived';
  slug?: string;
  spaceId?: string;
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<Skill[]> {
  try {
    const publicClient = getPublicClient();
    
    // Build query with space ID filtering
    let queryBuilder = publicClient.buildQuery()
      .where(eq('type', 'skill'))
      .withAttributes(true)
      .withPayload(true);

    // Support multiple spaceIds (builder mode) or single spaceId
    if (spaceIds && spaceIds.length > 0) {
      // Query all, filter client-side (Arkiv doesn't support OR queries)
      // Use higher limit for builder mode to ensure we get all skills
      queryBuilder = queryBuilder.limit(limit || 500);
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const finalSpaceId = spaceId || SPACE_ID;
      // Use provided limit or default to 500 to ensure we get all skills
      queryBuilder = queryBuilder.where(eq('spaceId', finalSpaceId)).limit(limit || 500);
    }
    
    // Fetch skill entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      queryBuilder.fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'skill_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('[listSkills] Invalid result from Arkiv query:', result);
      return [];
    }
    
    // Log for debugging
    console.log('[listSkills] Arkiv query result:', {
      spaceId: spaceId || SPACE_ID,
      spaceIds,
      entitiesFound: result.entities.length,
      limit,
    });

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const skillKey = getAttr('skillKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && skillKey) {
              txHashMap[skillKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let skills = result.entities.map((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[listSkills] Error decoding skill payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      return {
        key: entity.key,
        name_canonical: getAttr('name_canonical'),
        slug: getAttr('slug'),
        description: payload.description || undefined,
        created_by_profile: getAttr('created_by_profile') || undefined,
        status: (getAttr('status') || 'active') as 'active' | 'archived',
        spaceId: getAttr('spaceId') || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
        createdAt: getAttr('createdAt'),
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Filter by spaceIds client-side if multiple requested
    if (spaceIds && spaceIds.length > 0) {
      skills = skills.filter((skill: Skill) => spaceIds.includes(skill.spaceId));
    }

    // Apply filters
    if (status) {
      skills = skills.filter(s => s.status === status);
    }
    if (slug) {
      const normalizedSlug = normalizeSkillSlug(slug);
      skills = skills.filter(s => s.slug === normalizedSlug);
    }

    // Deduplicate skills by name_canonical (case-insensitive) or slug
    // If duplicates exist, keep the most recent one (by createdAt) or the one with a slug
    // This ensures users see only one "German" skill, not multiple duplicates
    const skillMap = new Map<string, Skill>();
    
    skills.forEach(skill => {
      // Use normalized name_canonical as the deduplication key (case-insensitive)
      const dedupeKey = skill.name_canonical.toLowerCase().trim();
      const existing = skillMap.get(dedupeKey);
      
      if (existing) {
        // Duplicate found - decide which one to keep
        const existingDate = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
        const currentDate = skill.createdAt ? new Date(skill.createdAt).getTime() : 0;
        
        // Prefer skill with slug, then most recent, then existing
        const existingHasSlug = existing.slug && existing.slug.trim() !== '';
        const currentHasSlug = skill.slug && skill.slug.trim() !== '';
        
        if (currentHasSlug && !existingHasSlug) {
          // Current has slug, existing doesn't - replace
          skillMap.set(dedupeKey, skill);
        } else if (!currentHasSlug && existingHasSlug) {
          // Existing has slug, current doesn't - keep existing
          // (no change needed)
        } else if (currentDate > existingDate) {
          // Both have or don't have slugs, but current is newer - replace
          skillMap.set(dedupeKey, skill);
        }
        // Otherwise keep existing (older or same date)
      } else {
        // New skill - add to map
        skillMap.set(dedupeKey, skill);
      }
    });
    
    // Convert back to array
    const deduplicatedSkills = Array.from(skillMap.values());
    
    // Log if duplicates were found (for debugging)
    if (skills.length > deduplicatedSkills.length) {
      console.log('[listSkills] Deduplicated skills:', {
        before: skills.length,
        after: deduplicatedSkills.length,
        duplicatesRemoved: skills.length - deduplicatedSkills.length,
      });
    }

    // Sort by name_canonical
    return deduplicatedSkills.sort((a, b) => a.name_canonical.localeCompare(b.name_canonical));
  } catch (error: any) {
    console.error('[listSkills] Error:', error);
    return [];
  }
}

/**
 * Get Skill by slug
 * 
 * @param slug - Skill slug (normalized name)
 * @param spaceId - Optional spaceId to filter by. If not provided, uses SPACE_ID from config.
 *                  This ensures we only find skills in the current environment.
 */
export async function getSkillBySlug(slug: string, spaceId?: string): Promise<Skill | null> {
  const normalizedSlug = normalizeSkillSlug(slug);
  // Use provided spaceId or default to SPACE_ID from config
  const finalSpaceId = spaceId || SPACE_ID;
  const skills = await listSkills({ slug: normalizedSlug, spaceId: finalSpaceId, limit: 1 });
  return skills.length > 0 ? skills[0] : null;
}

/**
 * Get Skill by key (entity key)
 */
export async function getSkillByKey(key: string): Promise<Skill | null> {
  try {
    const publicClient = getPublicClient();
    const result = await publicClient.buildQuery()
      .where(eq('type', 'skill'))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      return null;
    }

    const entity = result.entities.find((e: any) => e.key === key);
    if (!entity) {
      return null;
    }

    // Fetch txHash
    const txHashResult = await publicClient.buildQuery()
      .where(eq('type', 'skill_txhash'))
      .where(eq('skillKey', key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    let txHash: string | undefined;
    if (txHashResult?.entities && Array.isArray(txHashResult.entities) && txHashResult.entities.length > 0) {
      try {
        const txHashEntity = txHashResult.entities[0];
        if (txHashEntity.payload) {
          const decoded = txHashEntity.payload instanceof Uint8Array
            ? new TextDecoder().decode(txHashEntity.payload)
            : typeof txHashEntity.payload === 'string'
            ? txHashEntity.payload
            : JSON.stringify(txHashEntity.payload);
          const payload = JSON.parse(decoded);
          txHash = payload.txHash;
        }
      } catch (e) {
        // Ignore decode errors
      }
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded = entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
          ? entity.payload
          : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('[getSkillByKey] Error decoding payload:', e);
    }

    return {
      key: entity.key,
      name_canonical: getAttr('name_canonical'),
      slug: getAttr('slug'),
      description: payload.description || undefined,
      created_by_profile: getAttr('created_by_profile') || undefined,
      status: (getAttr('status') || 'active') as 'active' | 'archived',
      spaceId: getAttr('spaceId') || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt'),
      txHash: txHash || payload.txHash || undefined,
    };
  } catch (error: any) {
    console.error('[getSkillByKey] Error:', error);
    return null;
  }
}
