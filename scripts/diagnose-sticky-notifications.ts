/**
 * Diagnostic script to identify why notifications are stuck as read/unread
 * 
 * This script:
 * 1. Lists all notifications for a wallet
 * 2. Checks if read/archived state is in payload
 * 3. Attempts to update a notification and verifies the update
 * 4. Identifies any notifications that might be causing issues
 */

import { listNotifications, updateNotificationState } from '../lib/arkiv/notifications';
import { getPrivateKey, SPACE_ID } from '../lib/config';
import { getPublicClient } from '../lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';

async function diagnoseNotifications(wallet: string) {
  console.log(`\n=== Diagnosing notifications for wallet: ${wallet} ===\n`);

  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('No private key configured');
    process.exit(1);
  }

  // List all notifications
  const notifications = await listNotifications({
    wallet: wallet.toLowerCase(),
    spaceId: SPACE_ID,
    limit: 100,
  });

  console.log(`Found ${notifications.length} notifications\n`);

  // Check each notification
  for (const notif of notifications) {
    console.log(`\n--- Notification: ${notif.notificationId} ---`);
    console.log(`Key: ${notif.key}`);
    console.log(`Title: ${notif.title}`);
    console.log(`Read: ${notif.read}`);
    console.log(`Archived: ${notif.archived}`);
    console.log(`Updated: ${notif.updatedAt}`);

    // Query the raw entity to see what's actually stored
    const publicClient = getPublicClient();
    const result = await publicClient.buildQuery()
      .where(eq('type', 'notification'))
      .where(eq('key', notif.key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (result?.entities && result.entities.length > 0) {
      const entity = result.entities[0];
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('  Error decoding payload:', e);
      }

      console.log(`  Payload read: ${payload.read}`);
      console.log(`  Payload archived: ${payload.archived}`);
      console.log(`  Payload keys: ${Object.keys(payload).join(', ')}`);

      // Check if read/archived are missing (old notification)
      if (payload.read === undefined && payload.archived === undefined) {
        console.log('  ⚠️  OLD NOTIFICATION: Missing read/archived in payload');
      }
    }
  }

  // Test updating a notification
  if (notifications.length > 0) {
    const testNotif = notifications[0];
    console.log(`\n=== Testing update for notification: ${testNotif.notificationId} ===\n`);

    try {
      const currentRead = testNotif.read;
      const newRead = !currentRead;

      console.log(`Current read state: ${currentRead}`);
      console.log(`Attempting to set read to: ${newRead}`);

      const { key, txHash } = await updateNotificationState({
        wallet: wallet.toLowerCase(),
        notificationId: testNotif.notificationId,
        read: newRead,
        privateKey,
        spaceId: SPACE_ID,
      });

      console.log(`✅ Update successful!`);
      console.log(`  Key: ${key}`);
      console.log(`  TxHash: ${txHash}`);

      // Wait a bit for indexing
      console.log('\nWaiting 3 seconds for Arkiv to index...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify the update
      const updatedNotifications = await listNotifications({
        wallet: wallet.toLowerCase(),
        spaceId: SPACE_ID,
        limit: 100,
      });

      const updatedNotif = updatedNotifications.find(n => n.notificationId === testNotif.notificationId);
      if (updatedNotif) {
        console.log(`\nVerification:`);
        console.log(`  Expected read: ${newRead}`);
        console.log(`  Actual read: ${updatedNotif.read}`);
        if (updatedNotif.read === newRead) {
          console.log(`  ✅ Update persisted correctly!`);
        } else {
          console.log(`  ❌ Update did NOT persist!`);
        }
      } else {
        console.log(`  ❌ Notification not found after update!`);
      }

      // Restore original state
      console.log(`\nRestoring original read state: ${currentRead}`);
      await updateNotificationState({
        wallet: wallet.toLowerCase(),
        notificationId: testNotif.notificationId,
        read: currentRead,
        privateKey,
        spaceId: SPACE_ID,
      });
      console.log(`✅ Restored`);

    } catch (error: any) {
      console.error(`❌ Update failed:`, error.message);
      console.error(error);
    }
  }

  console.log(`\n=== Diagnosis complete ===\n`);
}

// Get wallet from command line args
const wallet = process.argv[2];
if (!wallet) {
  console.error('Usage: tsx scripts/diagnose-sticky-notifications.ts <wallet>');
  process.exit(1);
}

diagnoseNotifications(wallet).catch(console.error);

