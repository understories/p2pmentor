/**
 * Transaction utility functions
 * 
 * Handles transaction receipt timeouts and rate limits gracefully (common on testnets).
 * Based on the pattern used in sessions.ts
 */

/**
 * Checks if an error is a rate limit error
 * 
 * @param error - Error object or message
 * @returns True if this is a rate limit error (429)
 */
export function isRateLimitError(error: any): boolean {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  const errorCode = error?.code || error?.status || error?.statusCode;
  
  return errorCode === 429 ||
         errorCode === -32016 || // Arkiv rate limit error code
         errorMessage.includes('rate limit') ||
         errorMessage.includes('over rate limit') ||
         errorMessage.includes('too many requests') ||
         (errorMessage.includes('429') && errorMessage.toLowerCase().includes('limit'));
}

/**
 * Checks if an error is a transaction replacement/nonce error
 * 
 * @param error - Error object or message
 * @returns True if this is a replacement transaction or nonce error
 */
export function isTransactionReplacementError(error: any): boolean {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  return errorMessage.includes('replacement transaction underpriced') ||
         errorMessage.includes('nonce too low') ||
         errorMessage.includes('nonce too high') ||
         errorMessage.includes('already known') ||
         (errorMessage.includes('underpriced') && errorMessage.includes('transaction'));
}

/**
 * Retry with exponential backoff for rate limit errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on rate limit errors
      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`[transaction-utils] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Wraps createEntity calls to handle transaction receipt timeouts and rate limits
 * 
 * @param createEntityFn - Function that returns a promise with createEntity call
 * @returns Entity key and transaction hash, or throws user-friendly error
 */
export async function handleTransactionWithTimeout<T extends { entityKey: string; txHash: string }>(
  createEntityFn: () => Promise<T>
): Promise<T> {
  try {
    // Retry with backoff for rate limit errors
    return await retryWithBackoff(createEntityFn, 3, 1000);
  } catch (error: any) {
    // Handle rate limit errors with user-friendly message
    if (isRateLimitError(error)) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again. The Arkiv network is temporarily limiting requests.');
    }
    
    // Handle transaction replacement/nonce errors
    if (isTransactionReplacementError(error)) {
      // This usually means a transaction with the same nonce is already pending
      // Wait a bit and retry once with a small delay to allow nonce to increment
      console.warn('[transaction-utils] Transaction replacement error, waiting and retrying once...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        return await createEntityFn();
      } catch (retryError: any) {
        // If retry also fails, throw user-friendly error
        throw new Error('Transaction is still processing from a previous request. Please wait a moment and try again.');
      }
    }
    
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
