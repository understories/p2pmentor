/**
 * Profile completeness utilities
 * 
 * Calculate profile completeness percentage and provide completion guidance.
 */

import type { UserProfile } from '@/lib/arkiv/profile';

export interface ProfileCompleteness {
  percentage: number;
  completed: string[];
  missing: string[];
}

/**
 * Calculate profile completeness
 * 
 * Required fields:
 * - displayName (required)
 * - timezone (required)
 * 
 * Recommended fields:
 * - bio or bioShort (at least one)
 * - skillsArray (at least one skill)
 * - availability (availabilityWindow OR availability entities)
 * 
 * @param profile - User profile to check
 * @param hasAvailability - Optional: whether user has availability entities (modern format)
 * @returns Completeness object with percentage and checklist
 */
export function calculateProfileCompleteness(profile: UserProfile | null, hasAvailability?: boolean): ProfileCompleteness {
  if (!profile) {
    return {
      percentage: 0,
      completed: [],
      missing: ['Display Name', 'Timezone', 'Bio', 'Skills', 'Availability'],
    };
  }

  const completed: string[] = [];
  const missing: string[] = [];

  // Required fields
  if (profile.displayName && profile.displayName.trim()) {
    completed.push('Display Name');
  } else {
    missing.push('Display Name');
  }

  if (profile.timezone && profile.timezone.trim()) {
    completed.push('Timezone');
  } else {
    missing.push('Timezone');
  }

  // Recommended fields
  if (profile.bio || profile.bioShort) {
    completed.push('Bio');
  } else {
    missing.push('Bio');
  }

  if (profile.skillsArray && profile.skillsArray.length > 0) {
    completed.push('Skills');
  } else if (profile.skills && profile.skills.trim()) {
    completed.push('Skills');
  } else {
    missing.push('Skills');
  }

  // Check availability: either legacy availabilityWindow OR modern availability entities
  if (hasAvailability || (profile.availabilityWindow && profile.availabilityWindow.trim())) {
    completed.push('Availability');
  } else {
    missing.push('Availability');
  }

  // Calculate percentage (required fields = 50%, recommended = 50%)
  const requiredCount = completed.filter(f => f === 'Display Name' || f === 'Timezone').length;
  const recommendedCount = completed.filter(f => f !== 'Display Name' && f !== 'Timezone').length;
  const requiredTotal = 2; // displayName, timezone
  const recommendedTotal = 3; // bio, skills, availability

  const requiredPercentage = (requiredCount / requiredTotal) * 50;
  const recommendedPercentage = (recommendedCount / recommendedTotal) * 50;
  const percentage = Math.round(requiredPercentage + recommendedPercentage);

  return {
    percentage,
    completed,
    missing,
  };
}

