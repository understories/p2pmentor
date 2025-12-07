/**
 * Beta invite gate page
 * 
 * Simple invite code system to prevent DDOS.
 * For now, requires "growtogether" as the invite code.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BetaPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (inviteCode.toLowerCase() === 'growtogether') {
      // Store invite code in session/localStorage for future checks
      if (typeof window !== 'undefined') {
        localStorage.setItem('beta_invite_code', inviteCode);
      }
      router.push('/auth');
    } else {
      setError('Invalid invite code');
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Welcome to p2pmentor Beta</h1>
      <p>Enter your invite code to continue:</p>
      
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value);
            setError('');
          }}
          placeholder="Invite code"
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            width: '100%',
            marginBottom: '0.5rem',
          }}
        />
        {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Unlock Beta
        </button>
      </form>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
        <strong>⚠️ Beta Warning</strong>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          Do not use a wallet containing real funds. This is a beta environment on testnet.
        </p>
      </div>
    </main>
  );
}

