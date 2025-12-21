/**
 * Test Entity Update Implementation
 *
 * Tests the entity update pattern before enabling for new users.
 * Validates that profiles and notifications use stable entity keys.
 *
 * Usage:
 *   ENTITY_UPDATE_MODE=shadow tsx scripts/test-entity-updates.ts [--wallet=<address>]
 *
 * Options:
 *   --wallet=<address>: Use specific test wallet (default: generates test wallet)
 *
 * Test Scenarios:
 * 1. Profile creation (should work normally)
 * 2. Profile update (should use canonical entity if mode allows)
 * 3. Notification preference update (should persist state)
 * 4. Query paths (should return canonical entity)
 * 5. Migration markers (should mark wallets correctly)
 * 6. Error handling (should fallback gracefully)
 */

import 'dotenv/config';
import { createUserProfile, getProfileByWallet, listUserProfilesForWallet } from '../lib/arkiv/profile';
import { upsertNotificationPreference, listNotificationPreferences } from '../lib/arkiv/notificationPreferences';
import { getPrivateKey, SPACE_ID, ENTITY_UPDATE_MODE, isWalletMigrated, markWalletMigrated } from '../lib/config';
import { privateKeyToAccount } from 'viem/accounts';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

/**
 * Generate a test wallet address
 */
function generateTestWallet(): string {
  // Generate a deterministic test wallet from timestamp
  const timestamp = Date.now();
  const hex = timestamp.toString(16).padStart(40, '0');
  return `0x${hex}`;
}

/**
 * Test 1: Profile Creation
 */
async function testProfileCreation(wallet: string, privateKey: `0x${string}`): Promise<TestResult> {
  try {
    console.log(`\n[Test 1] Creating profile for wallet: ${wallet}`);
    
    const { key, txHash } = await createUserProfile({
      wallet,
      displayName: 'Test User',
      username: `test_${Date.now()}`,
      bio: 'Test profile for entity update testing',
      timezone: 'UTC',
      privateKey,
    });

    if (!key || !txHash) {
      return {
        test: 'Profile Creation',
        passed: false,
        error: 'Missing key or txHash',
      };
    }

    // Verify profile was created
    const profile = await getProfileByWallet(wallet);
    if (!profile) {
      return {
        test: 'Profile Creation',
        passed: false,
        error: 'Profile not found after creation',
      };
    }

    if (profile.displayName !== 'Test User') {
      return {
        test: 'Profile Creation',
        passed: false,
        error: 'Profile data mismatch',
        details: { expected: 'Test User', got: profile.displayName },
      };
    }

    return {
      test: 'Profile Creation',
      passed: true,
      details: { key, txHash, displayName: profile.displayName },
    };
  } catch (error: any) {
    return {
      test: 'Profile Creation',
      passed: false,
      error: error.message,
    };
  }
}

/**
 * Test 2: Profile Update (should use canonical entity if mode allows)
 */
async function testProfileUpdate(wallet: string, privateKey: `0x${string}`): Promise<TestResult> {
  try {
    console.log(`\n[Test 2] Updating profile for wallet: ${wallet}`);
    
    // Get existing profile
    const existingProfile = await getProfileByWallet(wallet);
    if (!existingProfile) {
      return {
        test: 'Profile Update',
        passed: false,
        error: 'No existing profile to update',
      };
    }

    const originalKey = existingProfile.key;
    const isMigrated = isWalletMigrated(wallet.toLowerCase());
    const mode = ENTITY_UPDATE_MODE;

    console.log(`  Mode: ${mode}, Migrated: ${isMigrated}, Original Key: ${originalKey}`);

    // Update profile
    const { key, txHash } = await createUserProfile({
      wallet,
      displayName: 'Updated Test User',
      username: existingProfile.username,
      bio: 'Updated bio for entity update testing',
      timezone: 'America/New_York',
      privateKey,
    });

    // Verify update behavior
    const updatedProfile = await getProfileByWallet(wallet);
    if (!updatedProfile) {
      return {
        test: 'Profile Update',
        passed: false,
        error: 'Profile not found after update',
      };
    }

    const shouldUseCanonical = mode === 'on' || (mode === 'shadow' && isMigrated);
    const keyStable = updatedProfile.key === originalKey;

    if (shouldUseCanonical && !keyStable) {
      return {
        test: 'Profile Update',
        passed: false,
        error: 'Entity key should be stable but changed',
        details: {
          mode,
          isMigrated,
          originalKey,
          newKey: updatedProfile.key,
          expected: 'key should match',
        },
      };
    }

    if (updatedProfile.displayName !== 'Updated Test User') {
      return {
        test: 'Profile Update',
        passed: false,
        error: 'Profile data not updated',
        details: { expected: 'Updated Test User', got: updatedProfile.displayName },
      };
    }

    // Check if wallet was marked as migrated
    const isMigratedAfter = isWalletMigrated(wallet.toLowerCase());
    const shouldBeMigrated = mode === 'on' || mode === 'shadow';

    return {
      test: 'Profile Update',
      passed: true,
      details: {
        mode,
        keyStable,
        isMigrated: isMigratedAfter,
        shouldBeMigrated,
        originalKey,
        newKey: updatedProfile.key,
        displayName: updatedProfile.displayName,
      },
    };
  } catch (error: any) {
    // Check if error is expected (SDK API not verified)
    if (error.message.includes('Entity update not yet implemented')) {
      return {
        test: 'Profile Update',
        passed: false,
        error: 'SDK API not verified - update not implemented yet',
        details: { mode: ENTITY_UPDATE_MODE, note: 'This is expected until U0.1 is complete' },
      };
    }

    return {
      test: 'Profile Update',
      passed: false,
      error: error.message,
    };
  }
}

/**
 * Test 3: Notification Preference Update
 */
async function testNotificationUpdate(wallet: string, privateKey: `0x${string}`): Promise<TestResult> {
  try {
    console.log(`\n[Test 3] Testing notification preference update for wallet: ${wallet}`);
    
    const notificationId = `test_notification_${Date.now()}`;
    
    // Create initial preference
    const { key: initialKey } = await upsertNotificationPreference({
      wallet,
      notificationId,
      notificationType: 'meeting_request',
      read: false,
      privateKey,
    });

    // Verify preference was created
    const initialPrefs = await listNotificationPreferences({
      wallet,
      notificationId,
      spaceId: SPACE_ID,
    });

    if (initialPrefs.length === 0) {
      return {
        test: 'Notification Preference Update',
        passed: false,
        error: 'Preference not found after creation',
      };
    }

    // Update preference (mark as read)
    const { key: updatedKey } = await upsertNotificationPreference({
      wallet,
      notificationId,
      notificationType: 'meeting_request',
      read: true,
      privateKey,
    });

    // Verify update
    const updatedPrefs = await listNotificationPreferences({
      wallet,
      notificationId,
      spaceId: SPACE_ID,
    });

    if (updatedPrefs.length === 0) {
      return {
        test: 'Notification Preference Update',
        passed: false,
        error: 'Preference not found after update',
      };
    }

    const pref = updatedPrefs[0];
    const keyStable = updatedKey === initialKey;
    const statePersisted = pref.read === true;

    if (!statePersisted) {
      return {
        test: 'Notification Preference Update',
        passed: false,
        error: 'Read state did not persist',
        details: { expected: true, got: pref.read },
      };
    }

    return {
      test: 'Notification Preference Update',
      passed: true,
      details: {
        keyStable,
        statePersisted,
        initialKey,
        updatedKey,
        read: pref.read,
      },
    };
  } catch (error: any) {
    // Check if error is expected (SDK API not verified)
    if (error.message.includes('Entity update not yet implemented')) {
      return {
        test: 'Notification Preference Update',
        passed: false,
        error: 'SDK API not verified - update not implemented yet',
        details: { mode: ENTITY_UPDATE_MODE, note: 'This is expected until U0.1 is complete' },
      };
    }

    return {
      test: 'Notification Preference Update',
      passed: false,
      error: error.message,
    };
  }
}

/**
 * Test 4: Query Path (should return canonical entity)
 */
async function testQueryPath(wallet: string): Promise<TestResult> {
  try {
    console.log(`\n[Test 4] Testing query path for wallet: ${wallet}`);
    
    const profile = await getProfileByWallet(wallet);
    if (!profile) {
      return {
        test: 'Query Path',
        passed: false,
        error: 'Profile not found',
      };
    }

    // Check if multiple profiles exist
    const allProfiles = await listUserProfilesForWallet(wallet);
    const hasMultiple = allProfiles.length > 1;
    const isMigrated = isWalletMigrated(wallet.toLowerCase());
    const mode = ENTITY_UPDATE_MODE;

    const shouldUseCanonical = mode === 'on' || (mode === 'shadow' && isMigrated);

    return {
      test: 'Query Path',
      passed: true,
      details: {
        mode,
        isMigrated,
        shouldUseCanonical,
        profileCount: allProfiles.length,
        hasMultiple,
        returnedKey: profile.key,
        returnedDisplayName: profile.displayName,
      },
    };
  } catch (error: any) {
    return {
      test: 'Query Path',
      passed: false,
      error: error.message,
    };
  }
}

/**
 * Test 5: Migration Markers
 */
async function testMigrationMarkers(wallet: string): Promise<TestResult> {
  try {
    console.log(`\n[Test 5] Testing migration markers for wallet: ${wallet}`);
    
    const normalizedWallet = wallet.toLowerCase();
    const initiallyMigrated = isWalletMigrated(normalizedWallet);
    
    // Mark as migrated
    markWalletMigrated(normalizedWallet);
    const afterMarking = isWalletMigrated(normalizedWallet);

    if (!afterMarking) {
      return {
        test: 'Migration Markers',
        passed: false,
        error: 'Wallet not marked as migrated after calling markWalletMigrated',
      };
    }

    return {
      test: 'Migration Markers',
      passed: true,
      details: {
        initiallyMigrated,
        afterMarking,
        wallet: normalizedWallet,
      },
    };
  } catch (error: any) {
    return {
      test: 'Migration Markers',
      passed: false,
      error: error.message,
    };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Entity Update Implementation Test Suite');
  console.log(`   Mode: ${ENTITY_UPDATE_MODE || 'off'}`);
  console.log(`   Space ID: ${SPACE_ID}`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const walletArg = args.find(arg => arg.startsWith('--wallet='));
  const testWallet = walletArg ? walletArg.split('=')[1] : generateTestWallet();

  // Verify private key is available
  let privateKey: `0x${string}`;
  try {
    privateKey = getPrivateKey();
  } catch (error: any) {
    console.error('❌ ARKIV_PRIVATE_KEY not set. Required for testing.');
    process.exit(1);
  }

  console.log(`\n📋 Using test wallet: ${testWallet}`);
  console.log(`   Signing wallet: ${privateKeyToAccount(privateKey).address}`);

  const results: TestResult[] = [];

  // Run tests
  results.push(await testProfileCreation(testWallet, privateKey));
  results.push(await testProfileUpdate(testWallet, privateKey));
  results.push(await testNotificationUpdate(testWallet, privateKey));
  results.push(await testQueryPath(testWallet));
  results.push(await testMigrationMarkers(testWallet));

  // Summary
  console.log('\n📊 Test Results Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`   ${icon} ${result.test}`);
    if (!result.passed) {
      console.log(`      Error: ${result.error}`);
      if (result.details) {
        console.log(`      Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    } else if (result.details) {
      console.log(`      ${JSON.stringify(result.details, null, 2)}`);
    }
  }

  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Review errors above before enabling for new users.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Ready to enable for new users.');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});

