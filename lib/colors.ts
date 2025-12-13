/**
 * Semantic color constants for p2pmentor
 * 
 * Centralized color system for consistent theming across the application.
 * Colors are defined semantically (asks/offers) rather than by hue.
 * 
 * Design specifications:
 * - Asks (I am learning): Blue #E0F0FF (primary) and #66B2FF (border/accent)
 * - Offers (I am teaching): Green #F0FFF5 (primary) and #00C781 (border/accent)
 * 
 * Usage:
 * ```tsx
 * import { askColors, offerColors } from '@/lib/colors';
 * 
 * <div className={askColors.card}>...</div>
 * <button className={offerColors.button}>...</button>
 * ```
 */

/**
 * Asks (I am learning) color classes
 * Blue theme: #E0F0FF (primary) and #66B2FF (accent)
 */
export const askColors = {
  // Card/container backgrounds
  card: 'bg-ask-primary dark:bg-ask-primary-dark',
  cardHover: 'hover:bg-ask-primary/80 dark:hover:bg-ask-primary-dark/80',
  
  // Borders
  border: 'border-ask-accent dark:border-ask-accent-dark',
  borderLight: 'border-ask-accent/50 dark:border-ask-accent-dark/50',
  
  // Text
  text: 'text-ask-accent dark:text-ask-accent-dark',
  textMuted: 'text-ask-accent/70 dark:text-ask-accent-dark/70',
  
  // Buttons
  button: 'bg-ask-accent hover:bg-ask-accent/90 text-white dark:bg-ask-accent-dark dark:hover:bg-ask-accent-dark/90',
  buttonOutline: 'border-ask-accent text-ask-accent hover:bg-ask-primary dark:border-ask-accent-dark dark:text-ask-accent-dark dark:hover:bg-ask-primary-dark',
  
  // Badges/status
  badge: 'bg-ask-primary text-ask-accent dark:bg-ask-primary-dark dark:text-ask-accent-dark',
  
  // Links
  link: 'text-ask-accent hover:text-ask-accent/80 dark:text-ask-accent-dark dark:hover:text-ask-accent-dark/80',
} as const;

/**
 * Offers (I am teaching) color classes
 * Green theme: #F0FFF5 (primary) and #00C781 (accent)
 */
export const offerColors = {
  // Card/container backgrounds
  card: 'bg-offer-primary dark:bg-offer-primary-dark',
  cardHover: 'hover:bg-offer-primary/80 dark:hover:bg-offer-primary-dark/80',
  
  // Borders
  border: 'border-offer-accent dark:border-offer-accent-dark',
  borderLight: 'border-offer-accent/50 dark:border-offer-accent-dark/50',
  
  // Text
  text: 'text-offer-accent dark:text-offer-accent-dark',
  textMuted: 'text-offer-accent/70 dark:text-offer-accent-dark/70',
  
  // Buttons
  button: 'bg-offer-accent hover:bg-offer-accent/90 text-white dark:bg-offer-accent-dark dark:hover:bg-offer-accent-dark/90',
  buttonOutline: 'border-offer-accent text-offer-accent hover:bg-offer-primary dark:border-offer-accent-dark dark:text-offer-accent-dark dark:hover:bg-offer-primary-dark',
  
  // Badges/status
  badge: 'bg-offer-primary text-offer-accent dark:bg-offer-primary-dark dark:text-offer-accent-dark',
  
  // Links
  link: 'text-offer-accent hover:text-offer-accent/80 dark:text-offer-accent-dark dark:hover:text-offer-accent-dark/80',
} as const;

/**
 * Emoji constants for semantic use
 */
export const askEmojis = {
  default: '🎓', // Graduation cap
  alternatives: ['🔎', '📚'], // Magnifying glass, Stack of books
} as const;

export const offerEmojis = {
  default: '💎', // Diamond
  alternatives: ['🛠️', '🤝'], // Tools, Handshake
} as const;

