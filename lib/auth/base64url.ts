/**
 * Base64URL Encoding/Decoding Utilities
 * 
 * Node.js Buffer doesn't support 'base64url' encoding in older versions (Node < 20).
 * This module provides compatible base64url encoding/decoding functions.
 * 
 * Reference: https://datatracker.ietf.org/doc/html/rfc4648#section-5
 */

/**
 * Convert base64url string to Buffer
 * 
 * Compatible with all Node.js versions by manually converting base64url to base64.
 * 
 * @param base64url - Base64url-encoded string
 * @returns Buffer containing decoded data
 */
export function base64urlToBuffer(base64url: string): Buffer {
  // Convert base64url to base64:
  // 1. Replace '-' with '+' and '_' with '/'
  // 2. Add padding if needed
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding (base64 requires length to be multiple of 4)
  const padLength = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padLength);
  
  // Now use standard base64 encoding (supported in all Node versions)
  return Buffer.from(base64, 'base64');
}

/**
 * Convert Buffer to base64url string
 * 
 * @param buffer - Buffer to encode
 * @returns Base64url-encoded string
 */
export function bufferToBase64url(buffer: Buffer | Uint8Array): string {
  // Convert to base64 first
  const base64 = buffer instanceof Buffer 
    ? buffer.toString('base64')
    : Buffer.from(buffer).toString('base64');
  
  // Convert base64 to base64url:
  // 1. Remove padding
  // 2. Replace '+' with '-' and '/' with '_'
  return base64
    .replace(/=/g, '') // Remove padding
    .replace(/\+/g, '-') // Replace '+' with '-'
    .replace(/\//g, '_'); // Replace '/' with '_'
}

/**
 * Check if base64url encoding is supported natively
 * 
 * @returns True if Buffer.from supports 'base64url' encoding
 */
export function isBase64urlSupported(): boolean {
  try {
    // Try to create a buffer with base64url encoding
    // This will throw if not supported
    Buffer.from('test', 'base64url');
    return true;
  } catch {
    return false;
  }
}
