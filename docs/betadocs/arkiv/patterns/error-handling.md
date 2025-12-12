# Error Handling Patterns

## Overview

Robust error handling is essential for reliable Arkiv integration. This document covers common error patterns and handling strategies.

## Transaction Errors

### Timeout Handling

```typescript
import { handleTransactionWithTimeout } from "@/lib/arkiv/transaction-utils";

async function createEntityWithTimeout(data: EntityData) {
  try {
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
  } catch (error) {
    if (error.message.includes('timeout')) {
      // Handle timeout
      console.error('Transaction timeout:', error);
      throw new Error('Transaction timed out. Please try again.');
    }
    throw error;
  }
}
```

### Receipt Waiting

```typescript
async function waitForReceipt(txHash: string, timeoutMs: number = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      // Receipt not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  }
  
  throw new Error('Transaction receipt timeout');
}
```

## Query Errors

### Handle Empty Results

```typescript
async function getProfile(wallet: string): Promise<Profile | null> {
  try {
    const result = await publicClient.buildQuery()
      .where(eq('type', 'user_profile'))
      .where(eq('wallet', wallet.toLowerCase()))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();
    
    if (result.entities.length === 0) {
      return null; // Not found
    }
    
    return parseProfile(result.entities[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw new Error('Failed to fetch profile');
  }
}
```

### Handle Network Errors

```typescript
async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error.message.includes('not found') || 
          error.message.includes('invalid')) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError || new Error('Query failed after retries');
}
```

## Validation Errors

### Validate Before Creation

```typescript
function validateProfile(profile: Partial<Profile>): void {
  if (!profile.wallet) {
    throw new Error('Wallet address is required');
  }
  
  if (!profile.displayName || profile.displayName.trim().length === 0) {
    throw new Error('Display name is required');
  }
  
  if (!profile.timezone) {
    throw new Error('Timezone is required');
  }
  
  // Validate timezone format
  try {
    Intl.DateTimeFormat(undefined, { timeZone: profile.timezone });
  } catch {
    throw new Error('Invalid timezone');
  }
}
```

## Error Types

### Common Error Categories

```typescript
enum ArkivErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  VALIDATION_ERROR = 'validation_error',
  NOT_FOUND = 'not_found',
  UNAUTHORIZED = 'unauthorized',
  RATE_LIMIT = 'rate_limit',
}

function categorizeError(error: Error): ArkivErrorType {
  if (error.message.includes('timeout')) {
    return ArkivErrorType.TIMEOUT;
  }
  
  if (error.message.includes('not found')) {
    return ArkivErrorType.NOT_FOUND;
  }
  
  if (error.message.includes('network') || error.message.includes('fetch')) {
    return ArkivErrorType.NETWORK_ERROR;
  }
  
  return ArkivErrorType.VALIDATION_ERROR;
}
```

## Best Practices

1. **Timeout Handling**: Always use timeouts for transactions
2. **Retry Logic**: Implement retry for transient errors
3. **Validation**: Validate data before creating entities
4. **Error Categorization**: Categorize errors for appropriate handling
5. **User-Friendly Messages**: Convert technical errors to user-friendly messages

## Example: Complete Error Handling

```typescript
async function createProfileSafely(data: ProfileData): Promise<Profile> {
  try {
    // 1. Validate
    validateProfile(data);
    
    // 2. Create with timeout
    const result = await handleTransactionWithTimeout(async () => {
      return await createProfile({
        ...data,
        privateKey: userPrivateKey,
      });
    });
    
    // 3. Wait for receipt
    await waitForReceipt(result.txHash);
    
    return result;
  } catch (error) {
    const errorType = categorizeError(error);
    
    switch (errorType) {
      case ArkivErrorType.TIMEOUT:
        throw new Error('Request timed out. Please try again.');
      case ArkivErrorType.VALIDATION_ERROR:
        throw error; // Already user-friendly
      case ArkivErrorType.NETWORK_ERROR:
        throw new Error('Network error. Please check your connection.');
      default:
        throw new Error('An unexpected error occurred.');
    }
  }
}
```

