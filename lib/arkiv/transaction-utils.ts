/**
 * Transaction utility functions
 *
 * Handles transaction receipt timeouts and rate limits gracefully (common on testnets).
 * Based on the pattern used in sessions.ts
 *
 * Arkiv SDK 0.8 wraps every failed mutation in an `EntityMutationError`
 * ("Transaction failed: <inner message>", with `cause` and `txHash`), so RPC codes such as
 * 429 / -32016 live on the `cause` chain, not on the top-level error. The helpers below
 * read messages and codes across the whole chain.
 */

/** Errors on the `cause` chain, outermost first (bounded to avoid cycles) */
function errorChain(error: any): any[] {
  const chain: any[] = [];
  let current = error;
  while (current && chain.length < 10 && !chain.includes(current)) {
    chain.push(current);
    current = typeof current === 'object' ? current.cause : undefined;
  }
  return chain;
}

/** All messages on the error chain, joined (also accepts a plain string) */
function errorText(error: any): string {
  if (typeof error === 'string') return error;
  return errorChain(error)
    .map((e) => (typeof e === 'string' ? e : [e?.message, e?.shortMessage, e?.details].join(' ')))
    .join(' | ');
}

/** First numeric/string error code found on the error chain */
function errorCodeOf(error: any): any {
  for (const e of errorChain(error)) {
    const code = e?.code ?? e?.status ?? e?.statusCode;
    if (code !== undefined && code !== null) return code;
  }
  return undefined;
}

/** Transaction hash carried by the error (SDK 0.8 `EntityMutationError.txHash`), if any */
function errorTxHash(error: any): string | undefined {
  for (const e of errorChain(error)) {
    if (typeof e?.txHash === 'string' && e.txHash.startsWith('0x')) return e.txHash;
  }
  return undefined;
}

/**
 * Checks if an error is a rate limit error
 *
 * @param error - Error object or message
 * @returns True if this is a rate limit error (429)
 */
export function isRateLimitError(error: any): boolean {
  const errorMessage = errorText(error).toLowerCase();
  const errorCodes =
    typeof error === 'string'
      ? []
      : errorChain(error).map((e) => e?.code ?? e?.status ?? e?.statusCode);

  return (
    errorCodes.includes(429) ||
    errorCodes.includes(-32016) || // Arkiv rate limit error code
    errorMessage.includes('rate limit') ||
    errorMessage.includes('over rate limit') ||
    errorMessage.includes('too many requests') ||
    (errorMessage.includes('429') && errorMessage.includes('limit'))
  );
}

/**
 * Checks if an error is a transaction replacement/nonce error
 *
 * @param error - Error object or message
 * @returns True if this is a replacement transaction or nonce error
 */
export function isTransactionReplacementError(error: any): boolean {
  const errorMessage = errorText(error);
  return (
    errorMessage.includes('replacement transaction underpriced') ||
    errorMessage.includes('nonce too low') ||
    errorMessage.includes('nonce too high') ||
    errorMessage.includes('already known') ||
    (errorMessage.includes('underpriced') && errorMessage.includes('transaction'))
  );
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
      console.warn(
        `[transaction-utils] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wraps entity writes (createArkivEntity / replaceArkivEntity / SDK mutations) to handle
 * transaction receipt timeouts and rate limits
 *
 * @param createEntityFn - Function that returns a promise with the write call
 * @returns Entity key and transaction hash, or throws user-friendly error
 */
export async function handleTransactionWithTimeout<T extends { entityKey: string; txHash: string }>(
  createEntityFn: () => Promise<T>
): Promise<T> {
  try {
    // Retry with backoff for rate limit errors
    return await retryWithBackoff(createEntityFn, 3, 1000);
  } catch (error: any) {
    const errorMessage = errorText(error) || String(error || '');
    const errorCode = errorCodeOf(error);

    // Log the full error for debugging
    console.error('[handleTransactionWithTimeout] Error details:', {
      message: errorMessage,
      code: errorCode,
      name: error?.name,
      error: error,
    });

    // Handle rate limit errors with user-friendly message
    if (isRateLimitError(error)) {
      throw new Error(
        'Rate limit exceeded. Please wait a moment and try again. The Arkiv network is temporarily limiting requests.'
      );
    }

    // A transaction that the SDK reports as applied must never be retried
    // (e.g. "Transaction 0x… succeeded — do not retry it — but emitted …")
    if (errorMessage.includes('do not retry')) {
      throw error;
    }

    // Handle RPC/network errors (viem errors)
    if (
      errorMessage.includes('An internal error was received') ||
      errorMessage.includes('did not get any valid response from any backend') ||
      errorMessage.includes('Internal error') ||
      (typeof errorCode === 'number' && errorCode < 0)
    ) {
      console.error(
        '[handleTransactionWithTimeout] RPC error detected, this may be a temporary network issue'
      );
      throw new Error(
        'Network error: Unable to connect to Arkiv. Please check your connection and try again in a moment.'
      );
    }

    // Handle transaction replacement/nonce errors
    if (isTransactionReplacementError(error)) {
      // This usually means a transaction with the same nonce is already pending
      // Wait a bit and retry once with a small delay to allow nonce to increment
      console.warn(
        '[transaction-utils] Transaction replacement error, waiting and retrying once...'
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        return await createEntityFn();
      } catch (retryError: any) {
        // If retry also fails, throw user-friendly error
        throw new Error(
          'Transaction is still processing from a previous request. Please wait a moment and try again.'
        );
      }
    }

    // Handle transaction receipt timeout - common on testnets
    // If error mentions receipt not found / wait timed out, the transaction was likely submitted
    const receiptError =
      (errorMessage.includes('Transaction receipt') &&
        (errorMessage.includes('could not be found') ||
          errorMessage.includes('not be processed'))) ||
      errorMessage.includes('Timed out while waiting for transaction');

    if (receiptError) {
      // Prefer the SDK's txHash; otherwise extract it from the message (format: "hash 0x...")
      const txHash = errorTxHash(error) || errorMessage.match(/0x[a-fA-F0-9]{40,64}/)?.[0];
      if (txHash) {
        // We have a txHash, transaction was submitted - throw user-friendly error
        throw new Error(
          `Transaction submitted (${txHash.slice(0, 10)}...) but confirmation pending. Please wait a moment and refresh.`
        );
      }
      // No txHash found, throw generic user-friendly error
      throw new Error(
        'Transaction submitted but confirmation pending. Please wait a moment and refresh.'
      );
    }

    // Re-throw with original error for other cases (will be caught by API route)
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
  const errorMessage = errorText(error);
  return (
    errorMessage.includes('Transaction receipt') ||
    errorMessage.includes('Timed out while waiting for transaction') ||
    errorMessage.includes('confirmation pending') ||
    errorMessage.includes('Transaction submitted') ||
    (errorMessage.includes('could not be found') && errorMessage.includes('hash'))
  );
}
