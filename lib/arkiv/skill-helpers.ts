/**
 * Skill helper functions
 * 
 * Utilities for ensuring skill entities exist and handling skill-to-community mapping.
 */

import { listSkills, getSkillBySlug, normalizeSkillSlug } from './skill';

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
    
    // Check if skill already exists by slug
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

