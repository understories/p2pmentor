/**
 * Diagnostic script to check notification wallet matching
 * 
 * Run with: npx tsx scripts/diagnose-notifications.ts <wallet_address>
 */

import { listNotifications } from '../lib/arkiv/notifications';
import { listUserProfiles } from '../lib/arkiv/profile';

async function diagnoseNotifications(walletAddress: string) {
  console.log('🔍 Diagnosing notifications for wallet:', walletAddress);
  console.log('');

  // Normalize wallet
  const normalizedWallet = walletAddress.toLowerCase().trim();
  console.log('📝 Normalized wallet:', normalizedWallet);
  console.log('');

  // Get all notifications for this wallet
  console.log('📬 Fetching notifications...');
  const notifications = await listNotifications({
    wallet: normalizedWallet,
    status: 'active',
    limit: 100,
  });
  console.log(`Found ${notifications.length} notifications`);
  console.log('');

  // Check each notification's wallet attribute
  console.log('🔎 Checking wallet matching:');
  notifications.forEach((notif, idx) => {
    const notifWallet = notif.wallet?.toLowerCase().trim() || '';
    const matches = notifWallet === normalizedWallet;
    console.log(`  ${idx + 1}. Notification ${notif.key}`);
    console.log(`     Type: ${notif.notificationType}`);
    console.log(`     Wallet in entity: "${notif.wallet}" (normalized: "${notifWallet}")`);
    console.log(`     Matches query wallet: ${matches ? '✅' : '❌'}`);
    if (!matches) {
      console.log(`     ⚠️  MISMATCH! Expected: "${normalizedWallet}", Got: "${notifWallet}"`);
    }
    console.log('');
  });

  // Check all profiles to see wallet formats
  console.log('👥 Checking all profiles for wallet format issues...');
  const allProfiles = await listUserProfiles();
  const walletFormats = new Map<string, number>();
  allProfiles.forEach(profile => {
    if (profile.wallet) {
      const wallet = profile.wallet;
      const normalized = wallet.toLowerCase().trim();
      const format = wallet === normalized ? 'lowercase' : 'mixed-case';
      walletFormats.set(format, (walletFormats.get(format) || 0) + 1);
    }
  });
  console.log('Wallet format distribution:');
  walletFormats.forEach((count, format) => {
    console.log(`  ${format}: ${count} profiles`);
  });
  console.log('');

  // Check if there are any notifications with mismatched wallets
  const mismatched = notifications.filter(n => {
    const notifWallet = n.wallet?.toLowerCase().trim() || '';
    return notifWallet !== normalizedWallet;
  });

  if (mismatched.length > 0) {
    console.log('❌ Found mismatched notifications:');
    mismatched.forEach(notif => {
      console.log(`  - ${notif.key}: wallet="${notif.wallet}" (expected: "${normalizedWallet}")`);
    });
  } else {
    console.log('✅ All notifications match the query wallet');
  }
}

// Run if called directly
if (require.main === module) {
  const walletAddress = process.argv[2];
  if (!walletAddress) {
    console.error('Usage: npx tsx scripts/diagnose-notifications.ts <wallet_address>');
    process.exit(1);
  }
  diagnoseNotifications(walletAddress).catch(console.error);
}

export { diagnoseNotifications };

