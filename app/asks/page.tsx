/**
 * Asks page
 * 
 * Browse and create "I am learning" asks.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { BetaBanner } from '@/components/BetaBanner';
import { Alert } from '@/components/Alert';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useGraphqlForAsks } from '@/lib/graph/featureFlags';
import { fetchAsks } from '@/lib/graph/asksQueries';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';

// Component for live countdown timer
function CountdownTimer({ createdAt, ttlSeconds }: { createdAt: string; ttlSeconds: number }) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const created = new Date(createdAt).getTime();
      const expires = created + (ttlSeconds * 1000);
      const now = Date.now();
      const remaining = expires - now;

      if (remaining <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000); // Update every second

    return () => clearInterval(interval);
  }, [createdAt, ttlSeconds]);

  return <span className="text-orange-600 dark:text-orange-400 font-medium">⏰ {timeRemaining} left</span>;
}

export default function AsksPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAsk, setNewAsk] = useState({ 
    skill: '', 
    message: '',
    ttlHours: '1', // Default 1 hour
    customTtlHours: '', // For custom input
  });
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      loadData(address);
    }
  }, [router]);

  const loadData = async (wallet: string) => {
    try {
      setLoading(true);
      
      const useGraphQL = await useGraphqlForAsks();
      
      if (useGraphQL) {
        // Try GraphQL first
        try {
          const [profileData, graphqlAsks] = await Promise.all([
            getProfileByWallet(wallet).catch(() => null),
            fetchAsks({ includeExpired: false, limit: 100 }),
          ]);
          
          // Only use GraphQL results if we got valid data
          if (graphqlAsks && Array.isArray(graphqlAsks) && graphqlAsks.length >= 0) {
            setProfile(profileData);
            setAsks(graphqlAsks.map(ask => ({
              id: ask.id,
              key: ask.key,
              wallet: ask.wallet,
              skill: ask.skill,
              message: ask.message || '',
              status: ask.status,
              createdAt: ask.createdAt,
              expiresAt: ask.expiresAt ? Number(ask.expiresAt) : null,
              ttlSeconds: ask.ttlSeconds,
              txHash: ask.txHash || undefined,
              spaceId: 'local-dev', // Default space ID
            })) as Ask[]);
            return; // Success, exit early
          }
        } catch (graphqlError) {
          console.warn('[AsksPage] GraphQL query failed, falling back to JSON-RPC:', graphqlError);
          // Fall through to JSON-RPC fallback
        }
      }
      
      // Fallback to JSON-RPC (either GraphQL disabled or GraphQL failed)
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      
      const [profileData, asksRes] = await Promise.all([
        getProfileByWallet(wallet).catch(() => null),
        fetch('/api/asks').then(r => r.json()),
      ]);
      
      const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
      const payloadBytes = JSON.stringify(asksRes).length;
      
      // Record performance sample (async, don't block)
      import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
        recordPerfSample({
          source: 'arkiv',
          operation: 'listAsks',
          route: '/asks',
          durationMs: Math.round(durationMs),
          payloadBytes,
          httpRequests: 1, // Single API call
          createdAt: new Date().toISOString(),
        });
      }).catch(() => {
        // Silently fail if metrics module not available
      });
      
      setProfile(profileData);
      if (asksRes.ok) {
        setAsks(asksRes.asks || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsk.skill.trim() || !newAsk.message.trim() || !walletAddress) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Convert hours to seconds for expiresIn
      const ttlValue = newAsk.ttlHours === 'custom' ? newAsk.customTtlHours : newAsk.ttlHours;
      const ttlHours = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHours) || ttlHours <= 0 ? 3600 : Math.floor(ttlHours * 3600); // Default to 1 hour if invalid

      const res = await fetch('/api/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAsk',
          wallet: walletAddress,
          skill: newAsk.skill.trim(),
          message: newAsk.message.trim(),
          expiresIn: expiresIn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (data.pending) {
          setSuccess('Ask submitted! Transaction is being processed. Please refresh in a moment.');
          setNewAsk({ skill: '', message: '', ttlHours: '1', customTtlHours: '' });
          setShowCreateForm(false);
          // Reload asks after a delay using the same method as initial load (GraphQL if enabled)
          setTimeout(async () => {
            await loadData(walletAddress!);
          }, 2000);
        } else {
          setSuccess('Ask created successfully!');
          setNewAsk({ skill: '', message: '', ttlHours: '1', customTtlHours: '' });
          setShowCreateForm(false);
          // Reload asks using the same method as initial load (GraphQL if enabled)
          await loadData(walletAddress!);
        }
      } else {
        setError(data.error || 'Failed to create ask');
      }
    } catch (err: any) {
      console.error('Error creating ask:', err);
      setError(err.message || 'Failed to create ask');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatTimeRemaining = (createdAt: string, ttlSeconds: number) => {
    const created = new Date(createdAt).getTime();
    const expires = created + (ttlSeconds * 1000);
    const now = Date.now();
    const remaining = expires - now;

    if (remaining <= 0) {
      return 'Expired';
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>
          <LoadingSpinner text="Loading asks..." className="py-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/network" />
        </div>

        <PageHeader
          title="Asks"
          description="Browse what others are learning, or post your own learning request."
        />

        <BetaBanner />

        {/* Create Ask Button */}
        {!showCreateForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              + Create Ask
            </button>
          </div>
        )}

        {/* Create Ask Form */}
        {showCreateForm && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Create New Ask</h2>
            <form onSubmit={handleCreateAsk} className="space-y-4">
              <div>
                <label htmlFor="skill" className="block text-sm font-medium mb-2">
                  Skill you want to learn *
                </label>
                <input
                  id="skill"
                  type="text"
                  value={newAsk.skill}
                  onChange={(e) => setNewAsk({ ...newAsk, skill: e.target.value })}
                  placeholder="e.g., React, TypeScript, Solidity"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={newAsk.message}
                  onChange={(e) => setNewAsk({ ...newAsk, message: e.target.value })}
                  placeholder="Describe what you want to learn..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="ttlHours" className="block text-sm font-medium mb-2">
                  Expiration Duration *
                </label>
                <div className="flex gap-2">
                  <select
                    id="ttlHours"
                    value={newAsk.ttlHours === 'custom' ? 'custom' : newAsk.ttlHours}
                    onChange={(e) => setNewAsk({ ...newAsk, ttlHours: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="0.5">30 minutes</option>
                    <option value="1">1 hour</option>
                    <option value="2">2 hours</option>
                    <option value="6">6 hours</option>
                    <option value="12">12 hours</option>
                    <option value="24">24 hours (1 day)</option>
                    <option value="48">48 hours (2 days)</option>
                    <option value="168">1 week</option>
                    <option value="custom">Custom (hours)</option>
                  </select>
                  {newAsk.ttlHours === 'custom' && (
                    <input
                      type="number"
                      min="0.5"
                      max="8760"
                      step="0.5"
                      placeholder="Hours"
                      value={newAsk.customTtlHours}
                      onChange={(e) => {
                        setNewAsk({ ...newAsk, customTtlHours: e.target.value });
                      }}
                      className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  How long should this ask stay active? Default: 1 hour
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Ask'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewAsk({ skill: '', message: '', ttlHours: '1', customTtlHours: '' });
                    setError('');
                    setSuccess('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
            {error && (
              <Alert type="error" message={error} onClose={() => setError('')} className="mt-4" />
            )}
            {success && (
              <Alert type="success" message={success} onClose={() => setSuccess('')} className="mt-4" />
            )}
          </div>
        )}

        {/* Asks List */}
        <div className="space-y-4">
          {asks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No asks yet. Be the first to create one!</p>
            </div>
          ) : (
            asks.map((ask) => (
              <div
                key={ask.key}
                className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {ask.skill}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(ask.createdAt)}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                    {ask.status}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                  {ask.message}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                  <span className="font-mono text-xs">{ask.wallet.slice(0, 6)}...{ask.wallet.slice(-4)}</span>
                  <CountdownTimer createdAt={ask.createdAt} ttlSeconds={ask.ttlSeconds} />
                  {ask.txHash ? (
                    <a
                      href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${ask.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View on Arkiv Explorer
                    </a>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs">Transaction pending...</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
