/**
 * Structured logging for entity writes
 *
 * Part of U1.x.1: Explorer Independence + Engineering Hooks
 * Logs all write operations in a structured format for debugging and auditability.
 */

export interface WriteLogEntry {
  entityType: string;
  entityKey: string;
  txHash: string;
  wallet: string;
  timestamp: string;
  operation: 'create' | 'update';
  spaceId?: string;
}

/**
 * Log a write operation
 *
 * @param entry - Write log entry
 */
export function logEntityWrite(entry: WriteLogEntry): void {
  // Structured logging for debugging and auditability
  console.log('[EntityWrite]', JSON.stringify(entry, null, 2));
  
  // Also log in a more readable format for console
  console.log(
    `[EntityWrite] ${entry.operation.toUpperCase()} ${entry.entityType} ` +
    `key=${entry.entityKey.slice(0, 16)}... ` +
    `txHash=${entry.txHash.slice(0, 16)}... ` +
    `wallet=${entry.wallet.slice(0, 10)}... ` +
    `timestamp=${entry.timestamp}`
  );
}

