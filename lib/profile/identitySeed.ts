/**
 * Emoji Identity Seeds (EIS) Utilities
 * 
 * Every user's identity is represented by a seed-emoji avatar from a curated
 * set of plant/nature emojis. This creates a cohesive forest aesthetic with
 * zero PII and minimal UI complexity.
 */

/**
 * Curated emoji pool for plant/nature category
 * Phase 0: Random selection from this pool
 * Phase 1: User customization + deterministic hash option
 */
export const PLANT_EMOJI_POOL = [
  '🌱', // sprout
  '🌿', // herb
  '☘️', // shamrock
  '🍀', // four leaf clover
  '🍃', // leaf fluttering in wind
  '🍂', // fallen leaf
  '🌾', // sheaf of rice
  '🌵', // cactus
  '🌻', // sunflower
  '🌼', // daisy
  '🌸', // cherry blossom
  '🍁', // maple leaf
  '🍄', // mushroom
  '🌲', // evergreen tree
  '🌳', // deciduous tree
  '🌴', // palm tree
] as const;

export type PlantEmoji = typeof PLANT_EMOJI_POOL[number];

/**
 * Select a random emoji from the plant pool
 * Phase 0: Pure random
 * Phase 1: Can be made deterministic via wallet hash
 */
export function selectRandomEmoji(): PlantEmoji {
  const index = Math.floor(Math.random() * PLANT_EMOJI_POOL.length);
  return PLANT_EMOJI_POOL[index];
}

/**
 * Validate that an emoji is from the approved plant pool
 * Used for Phase 1 customization
 */
export function isValidPlantEmoji(emoji: string): emoji is PlantEmoji {
  return (PLANT_EMOJI_POOL as readonly string[]).includes(emoji);
}

/**
 * Get default emoji for a wallet (deterministic option for Phase 1)
 * Hashes wallet address to consistently map to an emoji
 */
export function getDeterministicEmoji(wallet: string): PlantEmoji {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    const char = wallet.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % PLANT_EMOJI_POOL.length;
  return PLANT_EMOJI_POOL[index];
}

/**
 * Get emoji for a user profile
 * Falls back to random if not set (for existing profiles)
 */
export function getProfileEmoji(profile: { identity_seed?: string | null } | null | undefined): PlantEmoji {
  if (profile?.identity_seed && isValidPlantEmoji(profile.identity_seed)) {
    return profile.identity_seed;
  }
  // Fallback to random for existing profiles without identity_seed
  return selectRandomEmoji();
}
