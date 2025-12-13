/**
 * Emoji Identity Seeds (EIS) Utilities
 * 
 * Every user's identity is represented by a seed-emoji avatar from a curated
 * set of plant/nature emojis. This creates a cohesive forest aesthetic with
 * zero PII and minimal UI complexity.
 */

/**
 * Curated emoji pool for plant/nature/celestial category
 * Phase 0: Random selection from this pool
 * Phase 1: User customization + deterministic hash option
 * 
 * Includes: plants, nature, fruits, vegetables, celestial bodies, natural elements
 */
export const PLANT_EMOJI_POOL = [
  // Plants & Nature
  '🌱', // sprout
  '🌿', // herb
  '🍃', // leaf fluttering in wind
  '🍂', // fallen leaf
  '🍁', // maple leaf
  '☘️', // shamrock
  '🍀', // four leaf clover
  '🌾', // sheaf of rice
  '🎍', // pine decoration
  '🎋', // tanabata tree
  '🌵', // cactus
  '🌴', // palm tree
  '🌲', // evergreen tree
  '🌳', // deciduous tree
  '🌰', // chestnut
  '🪴', // potted plant
  '🍄', // mushroom
  // Flowers
  '🌸', // cherry blossom
  '🌼', // daisy
  '🌻', // sunflower
  '🌺', // hibiscus
  '🌹', // rose
  '🌷', // tulip
  '💮', // white flower
  '🏵️', // rosette
  '🥀', // wilted flower
  // Fruits
  '🍎', // red apple
  '🍏', // green apple
  '🍐', // pear
  '🍊', // tangerine
  '🍋', // lemon
  '🍒', // cherries
  '🍓', // strawberry
  '🫐', // blueberries
  '🥝', // kiwi fruit
  '🍇', // grapes
  '🥥', // coconut
  '🍑', // peach
  '🫘', // beans
  // Vegetables & Spices
  '🌶️', // hot pepper
  '🌽', // ear of corn
  '🥕', // carrot
  // Natural Materials
  '🪶', // feather
  '🪵', // wood
  // Celestial & Space
  '✨', // sparkles
  '🌟', // glowing star
  '💫', // dizzy
  '⭐', // star
  '🌠', // shooting star
  '🌙', // crescent moon
  '☀️', // sun
  '🌤️', // sun behind small cloud
  '☁️', // cloud
  '⛅', // sun behind cloud
  '🌥️', // sun behind large cloud
  '🌑', // new moon
  '🌓', // first quarter moon
  '🌔', // waxing gibbous moon
  '🌕', // full moon
  '🌖', // waning gibbous moon
  '🌗', // last quarter moon
  '🌘', // waning crescent moon
  '🌌', // milky way
  '🪐', // ringed planet
  '🌍', // earth globe Europe-Africa
  '🌎', // earth globe Americas
  '🌏', // earth globe Asia-Australia
  '☄️', // comet
  // Natural Elements
  '🔥', // fire
  '💧', // droplet
  '🌬️', // wind face
  '⚡', // high voltage
  '🌪️', // tornado
  '🌊', // water wave
  // Technology & Mystical
  '🛰️', // satellite
  '📡', // satellite antenna
  '🔮', // crystal ball
  '🧠', // brain
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
