/**
 * Skill helper functions
 * 
 * Utilities for ensuring skill entities exist and handling skill-to-community mapping.
 */

import { listSkills, getSkillBySlug, getSkillByKey, normalizeSkillSlug, createSkill } from './skill';
import { SPACE_ID } from '@/lib/config';
import { getPrivateKey } from '@/lib/config';

/**
 * Ensure a skill entity exists for a given skill name.
 * If it doesn't exist, creates it automatically.
 * 
 * @param skillName - The canonical name of the skill
 * @returns The skill entity (existing or newly created)
 */
export async function ensureSkillEntity(skillName: string): Promise<{ key: string; slug: string; name_canonical: string } | null> {
  if (!skillName || !skillName.trim()) {
    return null;
  }

  try {
    // Normalize the skill name to slug
    const normalizedSlug = normalizeSkillSlug(skillName.trim());
    
    // Check if skill already exists by slug in the current spaceId
    // getSkillBySlug will use SPACE_ID from config automatically
    const existing = await getSkillBySlug(normalizedSlug);
    if (existing) {
      return {
        key: existing.key,
        slug: existing.slug,
        name_canonical: existing.name_canonical,
      };
    }

    // Skill doesn't exist - create it
    // Get wallet address from localStorage if available (for auto-adding creator as member)
    const walletAddress = typeof window !== 'undefined'
      ? localStorage.getItem('wallet_address')
      : null;

    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name_canonical: skillName.trim(),
        description: undefined,
        created_by_profile: walletAddress || undefined, // Pass wallet so creator is auto-added as member
      }),
    });

    const data = await res.json();
    if (data.ok && data.skill) {
      return {
        key: data.skill.key,
        slug: data.skill.slug,
        name_canonical: data.skill.name_canonical,
      };
    } else if (data.alreadyExists && data.skill) {
      // Skill was created between check and creation
      return {
        key: data.skill.key,
        slug: data.skill.slug,
        name_canonical: data.skill.name_canonical,
      };
    }

    console.error('[ensureSkillEntity] Failed to create skill:', data.error);
    return null;
  } catch (error: any) {
    console.error('[ensureSkillEntity] Error ensuring skill entity:', error);
    return null;
  }
}

/**
 * Get or create a skill entity and return the topic page link.
 * 
 * @param skillName - The canonical name of the skill
 * @returns The topic page link, or null if skill cannot be created
 */
export async function getSkillTopicLink(skillName: string): Promise<string | null> {
  const skillEntity = await ensureSkillEntity(skillName);
  if (skillEntity) {
    return `/topic/${skillEntity.slug}`;
  }
  return null;
}

/**
 * Ensure a skill entity exists (server-side version)
 * If skill_id is provided, verify it exists. If skill name is provided, find or create by slug.
 * 
 * This function is designed for use in API routes (server-side) where we have direct access
 * to createSkill() and don't need to make HTTP requests.
 * 
 * @param skill_id - Optional skill entity key
 * @param skill_name - Optional skill name (canonical)
 * @param wallet - Wallet address of creator (for created_by_profile)
 * @param spaceId - Space ID (defaults to SPACE_ID from config)
 * @returns Skill entity key and metadata, or null if not found/created
 */
export async function ensureSkillEntityServer({
  skill_id,
  skill_name,
  wallet,
  spaceId = SPACE_ID,
}: {
  skill_id?: string;
  skill_name?: string;
  wallet?: string;
  spaceId?: string;
}): Promise<{ key: string; slug: string; name_canonical: string } | null> {
  // Must provide either skill_id or skill_name
  if (!skill_id && !skill_name) {
    console.error('[ensureSkillEntityServer] Either skill_id or skill_name must be provided');
    return null;
  }

  try {
    // If skill_id is provided, verify it exists first
    if (skill_id) {
      const existingByKey = await getSkillByKey(skill_id);
      if (existingByKey) {
        // Verify it's in the correct spaceId
        if (existingByKey.spaceId === spaceId) {
          return {
            key: existingByKey.key,
            slug: existingByKey.slug,
            name_canonical: existingByKey.name_canonical,
          };
        } else {
          // Skill exists but in different spaceId - this is an error
          console.error(`[ensureSkillEntityServer] Skill ${skill_id} exists but in different spaceId (${existingByKey.spaceId} vs ${spaceId})`);
          // Fall through to skill_name lookup/creation if provided
        }
      } else {
        // skill_id provided but doesn't exist - this is an error
        console.error(`[ensureSkillEntityServer] Skill ${skill_id} not found`);
        // Fall through to skill_name lookup/creation if provided
      }
    }

    // If skill_name is provided, find or create by slug
    if (skill_name) {
      const normalizedSlug = normalizeSkillSlug(skill_name.trim());
      if (!normalizedSlug || normalizedSlug.trim() === '') {
        console.error(`[ensureSkillEntityServer] Cannot create skill "${skill_name}": slug normalization resulted in empty string`);
        return null;
      }

      // Check if skill already exists by slug in the target spaceId
      const existingBySlug = await getSkillBySlug(normalizedSlug, spaceId);
      if (existingBySlug) {
        return {
          key: existingBySlug.key,
          slug: existingBySlug.slug,
          name_canonical: existingBySlug.name_canonical,
        };
      }

      // Skill doesn't exist - create it
      // Use server-side signing wallet (getPrivateKey())
      const { key, txHash } = await createSkill({
        name_canonical: skill_name.trim(),
        description: undefined,
        created_by_profile: wallet ? wallet.toLowerCase() : undefined,
        privateKey: getPrivateKey(),
        spaceId: spaceId,
      });

      // Wait a moment for Arkiv to index, then fetch the newly created skill
      // Use retry logic similar to /api/skills
      let newSkill: Awaited<ReturnType<typeof getSkillBySlug>> | null = null;
      const maxRetries = 5;
      const retryDelay = 1000;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        newSkill = await getSkillBySlug(normalizedSlug, spaceId);
        if (newSkill) {
          break;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (newSkill) {
        return {
          key: newSkill.key,
          slug: newSkill.slug,
          name_canonical: newSkill.name_canonical,
        };
      } else {
        // Transaction was successful but entity not yet queryable
        // Return what we know from the creation response
        // The slug should match what we normalized
        return {
          key,
          slug: normalizedSlug,
          name_canonical: skill_name.trim(),
        };
      }
    }

    // If we get here, skill_id was invalid and skill_name was not provided
    return null;
  } catch (error: any) {
    console.error('[ensureSkillEntityServer] Error ensuring skill entity:', error);
    return null;
  }
}

