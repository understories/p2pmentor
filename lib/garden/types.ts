/**
 * Garden Types
 * 
 * Types for the Emoji Garden feature (Phase 6).
 * Lightweight, Arkiv-native - derives from profile skills.
 */

export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type GardenSkill = {
  id: string; // Skill name or skillId (normalized)
  name: string; // Display name
  level: SkillLevel; // Expertise level (0-5)
  createdAt?: string; // Optional timestamp
  slotIndex?: number; // Optional: 0-7 for deterministic positioning
};

/**
 * Map skill expertise level to plant emoji
 * 
 * 0-1: 🌱 (Seed)
 * 2:   🌿 (Sprout)
 * 3-4: 🌳 (Tree)
 * 5:   🌴 (Glowing Tree - palm tree for distinction)
 */
export function levelToEmoji(level: SkillLevel): string {
  if (level <= 1) return '🌱';
  if (level === 2) return '🌿';
  if (level >= 3 && level <= 4) return '🌳';
  return '🌴'; // Level 5: Glowing tree (using palm tree emoji for visual distinction)
}

/**
 * Get expertise label for level (human-readable terms)
 */
export function levelToLabel(level: SkillLevel): string {
  const labels = ['Beginner', 'Beginner', 'Intermediate', 'Advanced', 'Advanced', 'Expert'];
  return labels[level] || 'Beginner';
}

/**
 * Assign skills to garden slots deterministically
 * 
 * Uses hash of skill ID to assign consistent slot positions.
 * This ensures the same skill always appears in the same position.
 */
export function assignSkillsToSlots(skills: GardenSkill[], maxSlots: number = 7): (GardenSkill | null)[] {
  const slots: (GardenSkill | null)[] = new Array(maxSlots).fill(null);
  
  // Simple hash function for deterministic slot assignment
  const hash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };
  
  skills.forEach(skill => {
    // Use existing slotIndex if provided, otherwise calculate from hash
    const slotIndex = skill.slotIndex !== undefined 
      ? skill.slotIndex 
      : hash(skill.id) % maxSlots;
    
    // If slot is empty, assign skill
    if (slots[slotIndex] === null) {
      slots[slotIndex] = skill;
    } else {
      // Slot occupied - find next available slot
      for (let i = 0; i < maxSlots; i++) {
        const nextSlot = (slotIndex + i) % maxSlots;
        if (slots[nextSlot] === null) {
          slots[nextSlot] = skill;
          break;
        }
      }
    }
  });
  
  return slots;
}

/**
 * Convert profile skills to garden skills
 * 
 * Derives garden state from Arkiv profile data (Arkiv-native).
 * No new entity type needed - uses existing profile.skillsArray and profile.skillExpertise.
 */
export function profileToGardenSkills(
  skillsArray?: string[],
  skillExpertise?: Record<string, number>
): GardenSkill[] {
  if (!skillsArray || skillsArray.length === 0) {
    return [];
  }
  
  return skillsArray.map((skillName, index) => {
    const normalizedId = skillName.toLowerCase();
    const level = (skillExpertise?.[normalizedId] ?? 
                   skillExpertise?.[skillName.toLowerCase()] ?? 
                   1) as SkillLevel;
    
    return {
      id: normalizedId,
      name: skillName,
      level: Math.min(5, Math.max(0, level)) as SkillLevel, // Clamp 0-5
      slotIndex: index % 7, // Simple assignment for now
    };
  });
}
