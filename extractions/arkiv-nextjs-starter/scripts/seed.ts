/**
 * Seed script for creating demo records
 * 
 * Supports ARKIV_TARGET=local (CI default) or ARKIV_TARGET=mendoza (human workflows).
 * CI uses local for determinism; Mendoza is for ecosystem validation.
 */

import { createRecord } from '../src/lib/arkiv/writes';

async function seed() {
  const target = process.env.ARKIV_TARGET || 'mendoza';
  console.log(`[seed] Targeting: ${target}`);
  
  // Demo wallet addresses (testnet)
  const demoWallets = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    '0x8ba1f109551bD432803012645Hac136c22C929',
  ];
  
  const records = [
    { title: 'Getting Started with Arkiv', description: 'Learn the basics of building on Arkiv' },
    { title: 'Query Patterns', description: 'Best practices for querying Arkiv entities' },
    { title: 'Transaction Handling', description: 'How to handle timeouts and errors gracefully' },
  ];
  
  console.log('[seed] Creating demo records...');
  
  for (let i = 0; i < records.length; i++) {
    const wallet = demoWallets[i % demoWallets.length];
    const record = records[i];
    
    try {
      const result = await createRecord('record', {
        ...record,
        createdAt: new Date().toISOString(),
      }, {
        wallet,
        status: 'active',
      });
      
      console.log(`[seed] Created record: ${record.title}`);
      console.log(`[seed]   Entity Key: ${result.entityKey}`);
      console.log(`[seed]   Tx Hash: ${result.txHash}`);
    } catch (error: any) {
      console.error(`[seed] Failed to create record "${record.title}":`, error?.message);
    }
  }
  
  console.log('[seed] Done!');
}

seed().catch(console.error);

