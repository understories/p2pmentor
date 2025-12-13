/**
 * Seed script: Create initial virtual gathering
 * 
 * Creates the beta users community feedback session for Dec 19 2025 12pm UTC
 * 
 * Usage: tsx scripts/seed-virtual-gathering.ts
 */

import { createVirtualGathering } from '../lib/arkiv/virtualGathering';
import { getPrivateKey, CURRENT_WALLET } from '../lib/config';

async function seedGathering() {
  try {
    const privateKey = getPrivateKey();
    
    // Get wallet address from private key
    const { getWalletClientFromPrivateKey } = await import('../lib/arkiv/client');
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    const organizerWallet = walletClient.account.address;

    // Dec 19 2025 12pm UTC
    const sessionDate = new Date('2025-12-19T12:00:00Z').toISOString();

    console.log('Creating virtual gathering...');
    console.log('Organizer:', organizerWallet);
    console.log('Community: beta_users');
    console.log('Title: Beta Feedback Session');
    console.log('Date:', sessionDate);

    const { key, txHash } = await createVirtualGathering({
      organizerWallet,
      community: 'beta_users',
      title: 'Beta Feedback Session',
      description: 'Monthly feedback session for beta users. Share your experience, report issues, and help shape p2pmentor.',
      sessionDate,
      duration: 60,
      privateKey,
    });

    console.log('\n✅ Gathering created!');
    console.log('Key:', key);
    console.log('Transaction Hash:', txHash);
    console.log('\nView on Arkiv:');
    console.log(`https://explorer.mendoza.hoodi.arkiv.network/tx/${txHash}`);
    console.log('\nView gathering:');
    console.log(`http://localhost:3000/communities/gatherings?community=beta_users`);
  } catch (error: any) {
    console.error('❌ Error creating gathering:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedGathering();
}

export { seedGathering };
