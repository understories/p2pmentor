/**
 * Session Display Utilities
 * 
 * Formats session titles and skill IDs for display.
 * Handles legacy data and community sessions.
 */

import type { Session } from '@/lib/arkiv/sessions';
import type { Skill } from '@/lib/arkiv/skill';

/**
 * Get skill ID for display
 * Returns skill_id if available, otherwise "[legacy data]"
 */
export function getSessionSkillId(session: Session): string {
  if (session.skill_id) {
    return session.skill_id;
  }
  // Check if it's a community session with community slug
  // Extract from notes if not in payload
  if (session.community) {
    return session.community; // Community slug can be used as skill identifier
  }
  // Try to extract from notes
  if (session.notes?.includes('community:')) {
    const match = session.notes.match(/community:([^,|]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '[legacy data]';
}

/**
 * Get skill title (name_canonical) from skill_id
 * Returns the skill's name_canonical if found in skills map, otherwise returns skill_id
 */
export function getSkillTitle(skillId: string, skillsMap?: Record<string, Skill>): string {
  if (!skillsMap || skillId === '[legacy data]') {
    return skillId;
  }
  const skill = skillsMap[skillId];
  return skill?.name_canonical || skillId;
}

/**
 * Format session title for display
 * Now shows skill title (name_canonical) instead of skill_id
 * 
 * For community sessions: "skill_title community session title"
 * For regular sessions: "skill_title" (just the skill title)
 * For legacy: "[legacy data] skill"
 */
export function formatSessionTitle(session: Session, skillsMap?: Record<string, Skill>): string {
  const skillId = getSessionSkillId(session);
  const skillTitle = getSkillTitle(skillId, skillsMap);
  const isCommunity = session.skill === 'virtual_gathering_rsvp' || session.gatheringKey;
  
  if (isCommunity) {
    // Community session format: "skill_title community session title"
    const title = session.gatheringTitle || session.notes?.split('gatheringTitle:')[1]?.split(',')[0]?.trim() || 'Community Session';
    return `${skillTitle} community session ${title}`;
  }
  
  // Regular session - just show skill title
  if (skillId === '[legacy data]') {
    return `[legacy data] ${session.skill}`;
  }
  
  // Just return the skill title
  return skillTitle;
}

/**
 * Get skill title for sidebar display
 * Returns skill title (name_canonical) if available, otherwise skill_id, with [legacy data] fallback
 */
export function getSidebarSkillId(session: Session, skillsMap?: Record<string, Skill>): string {
  const skillId = getSessionSkillId(session);
  return getSkillTitle(skillId, skillsMap);
}
