/**
 * Transaction utility functions
 * 
 * Handles transaction receipt timeouts gracefully (common on testnets).
 * Based on the pattern used in sessions.ts
 */

/**
 * Wraps createEntity calls to handle transaction receipt timeouts
 * 
 * @param createEntityFn - Function that returns a promise with createEntity call
 * @returns Entity key and transaction hash, or throws user-friendly error
 */
export async function handleTransactionWithTimeout<T extends { entityKey: string; txHash: string }>(
  createEntityFn: () => Promise<T>
): Promise<T> {
  try {
    return await createEntityFn();
  } catch (error: any) {
    // Handle transaction receipt timeout - common on testnets
    // If error mentions receipt not found, the transaction was likely submitted
    const receiptError = error.message?.includes('Transaction receipt') && 
                         (error.message?.includes('could not be found') ||
                          error.message?.includes('not be processed'));
    
    if (receiptError) {
      // Try to extract txHash from error message (format: "hash 0x...")
      const txHashMatch = error.message?.match(/0x[a-fA-F0-9]{40,64}/);
      if (txHashMatch) {
        // We have a txHash, transaction was submitted - throw user-friendly error
        throw new Error(`Transaction submitted (${txHashMatch[0].slice(0, 10)}...) but confirmation pending. Please wait a moment and refresh.`);
      }
      // No txHash found, throw generic user-friendly error
      throw new Error('Transaction submitted but confirmation pending. Please wait a moment and refresh.');
    }
    throw error;
  }
}

/**
 * Checks if an error is a transaction receipt timeout
 * 
 * @param error - Error object or message
 * @returns True if this is a transaction receipt timeout error
 */
export function isTransactionTimeoutError(error: any): boolean {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  return errorMessage.includes('Transaction receipt') ||
         errorMessage.includes('confirmation pending') ||
         errorMessage.includes('Transaction submitted') ||
         (errorMessage.includes('could not be found') && errorMessage.includes('hash'));
}

