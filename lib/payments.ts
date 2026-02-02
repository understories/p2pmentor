/**
 * Payment and transaction hash handling
 *
 * For paid sessions:
 * - Requestor enters transaction hash
 * - Confirmer validates the transaction
 * - Session is confirmed once payment is validated
 *
 * Based on viem transaction validation patterns.
 */

import { getPublicClient } from './arkiv/client';

/**
 * Validate a transaction hash on the blockchain
 *
 * @param txHash - Transaction hash to validate (0x... format)
 * @param expectedRecipient - Expected recipient address (optional)
 * @returns Validation result with transaction details
 */
export async function validateTransaction(
  txHash: string,
  expectedRecipient?: string
): Promise<{
  valid: boolean;
  confirmed: boolean;
  blockNumber?: bigint;
  recipient?: string;
  amount?: bigint;
  error?: string;
}> {
  try {
    const publicClient = getPublicClient();

    // Get transaction receipt to verify it exists and is confirmed
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return {
        valid: false,
        confirmed: false,
        error: 'Transaction not found or not yet confirmed',
      };
    }

    // Check if transaction is confirmed (status === 'success')
    const confirmed = receipt.status === 'success';

    // If expected recipient provided, verify it matches
    if (expectedRecipient) {
      // For simple ETH transfers, check 'to' field
      // For token transfers, would need to parse logs
      // For now, we'll just verify the transaction exists and is confirmed
      // More sophisticated validation can be added later
    }

    return {
      valid: confirmed,
      confirmed,
      blockNumber: receipt.blockNumber,
      // Note: amount and recipient would require parsing transaction details
      // For beta, we just verify the transaction exists and is confirmed
    };
  } catch (error: unknown) {
    // Transaction might not exist or not be confirmed yet
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found') || message.includes('not be processed')) {
      return {
        valid: false,
        confirmed: false,
        error: 'Transaction not found or not yet confirmed on blockchain',
      };
    }

    return {
      valid: false,
      confirmed: false,
      error: message || 'Failed to validate transaction',
    };
  }
}
