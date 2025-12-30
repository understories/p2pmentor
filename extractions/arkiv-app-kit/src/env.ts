/**
 * Environment variable helpers
 * 
 * Provides fail-closed helpers for environment variables with friendly errors.
 * Prohibits "cute fallbacks" - makes it painful to hardcode values, easy to use config.
 */

/**
 * ARKIV_TARGET values
 * 
 * Controls which Arkiv network to target:
 * - 'local': Local node (for CI determinism)
 * - 'mendoza': Mendoza testnet (for ecosystem validation)
 */
export type ArkivTarget = 'local' | 'mendoza';

/**
 * Get ARKIV_TARGET from environment
 * 
 * Validates that ARKIV_TARGET is one of the allowed values.
 * Defaults to 'mendoza' if not set (testnet-first).
 * 
 * @returns Validated ARKIV_TARGET value
 * @throws Error if ARKIV_TARGET is set to an invalid value
 */
export function getArkivTarget(): ArkivTarget {
  const target = process.env.ARKIV_TARGET;
  
  if (!target) {
    // Default to Mendoza (testnet-first)
    return 'mendoza';
  }
  
  if (target !== 'local' && target !== 'mendoza') {
    throw new Error(
      `Invalid ARKIV_TARGET: "${target}". Must be "local" or "mendoza".`
    );
  }
  
  return target;
}

/**
 * Check if targeting local node
 * 
 * @returns True if ARKIV_TARGET is 'local'
 */
export function isLocalTarget(): boolean {
  return getArkivTarget() === 'local';
}

/**
 * Check if targeting Mendoza testnet
 * 
 * @returns True if ARKIV_TARGET is 'mendoza'
 */
export function isMendozaTarget(): boolean {
  return getArkivTarget() === 'mendoza';
}

/**
 * Require an environment variable, throwing a friendly error if missing
 * 
 * This is the canonical way to access environment variables in Arkiv apps.
 * It prevents silent failures and makes configuration errors obvious.
 * 
 * @param name - Environment variable name (e.g., 'ARKIV_PRIVATE_KEY')
 * @returns The environment variable value (never undefined)
 * @throws Error if the environment variable is not set
 * 
 * @example
 * ```ts
 * const privateKey = requireEnv('ARKIV_PRIVATE_KEY');
 * const spaceId = requireEnv('SPACE_ID');
 * ```
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please set it in your .env file or environment.`
    );
  }
  
  return value;
}

/**
 * Get an environment variable with optional default
 * 
 * Use this only when a default value is truly acceptable.
 * Prefer requireEnv() for required configuration.
 * 
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 * 
 * @example
 * ```ts
 * const rpcUrl = getEnv('ARKIV_RPC_URL', 'https://rpc.mendoza.arkiv.network');
 * ```
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

