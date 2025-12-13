/**
 * Emoji Identity Seed Component
 * 
 * Reusable component for displaying user identity seeds (emoji avatars).
 * Used throughout the app to replace profile pictures with emoji seeds.
 */

'use client';

import { getProfileEmoji, type PlantEmoji } from '@/lib/profile/identitySeed';
import type { UserProfile } from '@/lib/arkiv/profile';

interface EmojiIdentitySeedProps {
  profile: UserProfile | null | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showGlow?: boolean;
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export function EmojiIdentitySeed({
  profile,
  size = 'md',
  className = '',
  showGlow = false,
}: EmojiIdentitySeedProps) {
  const emoji: PlantEmoji = getProfileEmoji(profile);

  return (
    <span
      className={`
        ${sizeClasses[size]}
        ${showGlow ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}
        ${className}
      `}
      role="img"
      aria-label="User identity seed"
    >
      {emoji}
    </span>
  );
}

