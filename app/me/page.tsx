/**
 * User dashboard page
 * 
 * Main landing page after authentication.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
    }
  }, [router]);

  if (!walletAddress) {
    return <div>Loading...</div>;
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Your Dashboard</h1>
      <p>Wallet: {walletAddress}</p>

      <nav style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link href="/me/profile" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          Profile
        </Link>
        <Link href="/me/skills" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          Skills
        </Link>
        <Link href="/me/availability" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          Availability
        </Link>
        <Link href="/me/sessions" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          Sessions
        </Link>
      </nav>

      <div style={{ marginTop: '2rem' }}>
        <Link href="/network">Browse Network</Link>
      </div>
    </main>
  );
}

