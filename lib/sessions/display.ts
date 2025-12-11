/**
 * Session Display Utilities
 * 
 * Formats session titles and skill IDs for display.
 * Handles legacy data and community sessions.
 */

import type { Session } from '@/lib/arkiv/sessions';

/**
 * Get skill ID for display
 * Returns skill_id if available, otherwise "[legacy data]"
 */
export function getSessionSkillId(session: Session): string {
  if (session.skill_id) {
    return session.skill_id;
  }
  // Check if it's a community session with community slug
  if (session.community) {
    return session.community; // Community slug can be used as skill identifier
  }
  return '[legacy data]';
}

/**
 * Format session title for display
 * Format: "skill_id + community session + title"
 * 
 * For community sessions: "skill_id community session title"
 * For regular sessions: "skill_id session title" (if title exists in notes)
 * For legacy: "[legacy data] skill"
 */
export function formatSessionTitle(session: Session): string {
  const skillId = getSessionSkillId(session);
  const isCommunity = session.skill === 'virtual_gathering_rsvp' || session.gatheringKey;
  
  if (isCommunity) {
    // Community session format: "skill_id community session title"
    const title = session.gatheringTitle || session.notes?.split('gatheringTitle:')[1]?.split(',')[0]?.trim() || 'Community Session';
    return `${skillId} community session ${title}`;
  }
  
  // Regular session - check if we have a title in notes
  // For now, just show skill_id + skill name (legacy)
  if (skillId === '[legacy data]') {
    return `[legacy data] ${session.skill}`;
  }
  
  // Try to extract title from notes if available
  const titleMatch = session.notes?.match(/title[:\s]+([^,\n]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;
  
  if (title) {
    return `${skillId} ${title}`;
  }
  
  // Fallback: just skill_id
  return skillId;
}

/**
 * Get skill ID for sidebar display
 * Returns skill_id only, with [legacy data] fallback
 */
export function getSidebarSkillId(session: Session): string {
  return getSessionSkillId(session);
}
