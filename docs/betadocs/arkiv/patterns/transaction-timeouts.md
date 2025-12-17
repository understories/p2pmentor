# Transaction Timeout Handling

## Overview

Arkiv transactions can take time to confirm. This document covers patterns for handling transaction timeouts gracefully.

## Pattern: Transaction with Timeout

### Basic Implementation

```typescript
import { handleTransactionWithTimeout } from "@/lib/arkiv/transaction-utils";

async function createEntityWithTimeout(data: EntityData) {
  return await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(data.payload)),
      attributes: data.attributes,
      expiresIn: data.expiresIn,
    });
  }, {
    timeoutMs: 30000, // 30 seconds
    retries: 2,
  });
}
```

### Timeout Configuration

```typescript
interface TimeoutConfig {
  timeoutMs: number;      // Total timeout (default: 30000)
  retries: number;        // Number of retries (default: 0)
  retryDelayMs: number;    // Delay between retries (default: 1000)
}
```

## Receipt Waiting

### Wait for Transaction Receipt

```typescript
async function waitForReceipt(
  txHash: string,
  timeoutMs: number = 30000
): Promise<TransactionReceipt> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      // Receipt not ready yet, continue waiting
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Transaction receipt timeout: ${txHash}`);
}
```

## Graceful Degradation

### Continue Without Receipt

```typescript
async function createEntityGracefully(data: EntityData) {
  try {
    const result = await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(data.payload)),
      attributes: data.attributes,
      expiresIn: data.expiresIn,
    });
    
    // Try to wait for receipt, but don't fail if timeout
    try {
      await waitForReceipt(result.txHash, 10000); // Short timeout
    } catch (timeoutError) {
      console.warn('Receipt timeout, but entity may still be created:', result.txHash);
      // Continue - entity may still be created
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}
```

## Retry Logic

### Retry on Timeout

```typescript
async function createEntityWithRetry(
  data: EntityData,
  maxRetries: number = 2
): Promise<EntityResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await handleTransactionWithTimeout(async () => {
        return await walletClient.createEntity({
          payload: enc.encode(JSON.stringify(data.payload)),
          attributes: data.attributes,
          expiresIn: data.expiresIn,
        });
      }, {
        timeoutMs: 30000,
        retries: 0, // Don't retry inside, we retry outside
      });
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation errors
      if (!error.message.includes('timeout')) {
        throw error;
      }
      
      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Transaction failed after retries');
}
```

## Best Practices

1. **Reasonable Timeouts**: Use 30 seconds for most operations
2. **Retry Strategy**: Retry on timeout, not on validation errors
3. **Graceful Degradation**: Continue if receipt timeout (entity may still be created)
4. **User Feedback**: Show loading state during transaction
5. **Error Messages**: Provide clear error messages to users

## Example: Complete Pattern

```typescript
async function createProfileWithTimeout(profileData: ProfileData): Promise<Profile> {
  // Show loading state
  setLoading(true);
  
  try {
    // Create with timeout and retry
    const result = await createEntityWithRetry({
      payload: profileData,
      attributes: {
        type: 'user_profile',
        wallet: profileData.wallet.toLowerCase(),
        spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config // Default in library functions; API routes use SPACE_ID from config
      },
      expiresIn: undefined, // No expiration
    }, 2); // 2 retries
    
    // Try to wait for receipt (non-blocking)
    waitForReceipt(result.txHash, 10000).catch(err => {
      console.warn('Receipt timeout:', err);
      // Entity may still be created
    });
    
    return result;
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error('Transaction timed out. Please try again.');
    }
    throw error;
  } finally {
    setLoading(false);
  }
}
```

