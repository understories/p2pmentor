/**
 * Authentication page
 * 
 * Allows users to connect with MetaMask or use example wallet login.
 * 
 * Reference: refs/mentor-graph/pages/index.tsx
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectWallet } from '@/lib/auth/metamask';
import { BackButton } from '@/components/BackButton';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AuthPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Check if user has already passed invite gate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const inviteCode = localStorage.getItem('beta_invite_code');
      if (!inviteCode) {
        router.push('/beta');
      }
    }
  }, [router]);

  const handleMetaMaskConnect = async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      const address = await connectWallet();
      
      // Store wallet address in localStorage for session persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', address);
      }
      
      router.push('/me');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsConnecting(false);
    }
  };

  const handleExampleWallet = async () => {
    try {
      setLoadingExample(true);
      setError('');
      const res = await fetch('/api/wallet');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 503) {
          throw new Error('Example wallet not available. Please set ARKIV_PRIVATE_KEY in your .env file, or use MetaMask to connect.');
        }
        throw new Error(errorData.error || 'Failed to fetch example wallet');
      }
      const data = await res.json();
      if (!data.address) {
        throw new Error('No example wallet available');
      }
      // Store wallet address in localStorage for session persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', data.address);
      }
      // Redirect to dashboard
      router.push('/me');
    } catch (err: any) {
      console.error('Failed to load example wallet:', err);
      setError(err.message || 'Failed to load example wallet');
      setLoadingExample(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#ffffff',
      color: '#333333',
    }}>
      <ThemeToggle />
      <div style={{
        maxWidth: '600px',
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <BackButton href="/beta" />
        </div>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          color: '#1a1a1a',
        }}>
          Connect to p2pmentor
        </h1>
        <p style={{
          fontSize: '1rem',
          color: '#666666',
          marginBottom: '2rem',
        }}>
          Choose your authentication method:
        </p>

        {error && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            backgroundColor: '#fee',
            color: '#cc0000',
            borderRadius: '6px',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <button
            onClick={handleMetaMaskConnect}
            disabled={isConnecting || loadingExample}
            style={{
              padding: '1rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: (isConnecting || loadingExample) ? 'not-allowed' : 'pointer',
              backgroundColor: (isConnecting || loadingExample) ? '#888' : '#4caf50',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              opacity: (isConnecting || loadingExample) ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isConnecting && !loadingExample) {
                e.currentTarget.style.backgroundColor = '#45a049';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isConnecting && !loadingExample) {
                e.currentTarget.style.backgroundColor = '#4caf50';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect with MetaMask'}
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '0.5rem 0',
          }}>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: '#ddd',
            }}></div>
            <span style={{
              color: '#999',
              fontSize: '0.9rem',
            }}>or</span>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: '#ddd',
            }}></div>
          </div>

          <button
            onClick={handleExampleWallet}
            disabled={isConnecting || loadingExample}
            style={{
              padding: '1rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: (isConnecting || loadingExample) ? 'not-allowed' : 'pointer',
              backgroundColor: (isConnecting || loadingExample) ? '#888' : '#f0f0f0',
              color: '#333333',
              border: '1px solid #ddd',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              opacity: (isConnecting || loadingExample) ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isConnecting && !loadingExample) {
                e.currentTarget.style.backgroundColor = '#e0e0e0';
              }
            }}
            onMouseLeave={(e) => {
              if (!isConnecting && !loadingExample) {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }
            }}
          >
            {loadingExample ? 'Loading...' : 'Log in with Example Wallet'}
          </button>
          <p style={{
            fontSize: '0.85rem',
            color: '#999',
            marginTop: '0.25rem',
            textAlign: 'center',
          }}>
            Try the demo without MetaMask
          </p>
        </div>

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
        }}>
          <strong style={{
            color: '#856404',
            fontSize: '0.95rem',
            display: 'block',
            marginBottom: '0.5rem',
          }}>
            ⚠️ Beta Warning
          </strong>
          <p style={{
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            color: '#856404',
            lineHeight: '1.5',
          }}>
            Do not use a wallet containing real funds. This is a beta environment on testnet.
          </p>
          <p style={{
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            color: '#856404',
            lineHeight: '1.5',
          }}>
            Blockchain data is immutable. All data inputted is viewable forever on the{' '}
            <a
              href="https://explorer.mendoza.hoodi.arkiv.network"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#856404',
                textDecoration: 'underline',
              }}
            >
              Arkiv explorer
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}

