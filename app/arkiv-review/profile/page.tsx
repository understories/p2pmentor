/**
 * Arkiv Review Mode Profile Creation Page
 * 
 * Barebones profile creation form for reviewers to test wallet creation
 * without going through onboarding. Follows M1 acceptance criteria exactly.
 * 
 * Guards:
 * - Wallet must be connected
 * - Arkiv must confirm valid review activation
 * - No profile must exist yet
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { EntityWriteInfo } from '@/components/EntityWriteInfo';

export default function ArkivReviewProfilePage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    timezone: '',
    seniority: '' as 'beginner' | 'intermediate' | 'advanced' | 'expert' | '',
    contactLinks: {
      twitter: '',
      github: '',
      telegram: '',
      discord: '',
    },
    skillsArray: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProfile, setCreatedProfile] = useState<{ key: string; txHash: string } | null>(null);
  const [checkingGuards, setCheckingGuards] = useState(true);
  const arkivBuilderMode = useArkivBuilderMode();

  // Get wallet from connected wallet provider (Arkiv is source of truth)
  // Only fall back to localStorage if provider can't provide it
  useEffect(() => {
    const getConnectedWallet = async () => {
      try {
        // Try to get wallet from connected provider first
        if (typeof window !== 'undefined' && window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
          if (Array.isArray(accounts) && accounts.length > 0) {
            const address = accounts[0];
            setWallet(address);
            // Store in localStorage as cache (not source of truth)
            localStorage.setItem('wallet_address', address);
            
            // Auto-detect timezone
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setFormData(prev => ({ ...prev, timezone }));
            return;
          }
        }
        
        // Fallback to localStorage if provider unavailable (log for debugging)
        const storedWallet = localStorage.getItem('wallet_address');
        if (storedWallet) {
          console.warn('[ArkivReviewProfile] Using localStorage wallet (provider unavailable)');
          setWallet(storedWallet);
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setFormData(prev => ({ ...prev, timezone }));
        } else {
          router.push('/auth');
        }
      } catch (err) {
        console.error('[ArkivReviewProfile] Failed to get wallet:', err);
        router.push('/auth');
      }
    };
    
    getConnectedWallet();
  }, [router]);

  // Check review mode activation on Arkiv (guards)
  useEffect(() => {
    const checkReviewMode = async () => {
      if (!wallet) return;
      
      setCheckingGuards(true);
      
      try {
        const { getLatestValidReviewModeGrant } = await import('@/lib/arkiv/reviewModeGrant');
        const { getProfileByWallet } = await import('@/lib/arkiv/profile');
        
        const [grant, profile] = await Promise.all([
          getLatestValidReviewModeGrant(wallet),
          getProfileByWallet(wallet),
        ]);
        
        // Guards: wallet connected, grant exists, no profile yet
        if (!grant) {
          router.push('/auth');
          return;
        }
        
        if (profile) {
          // Profile already exists - redirect to dashboard
          router.push('/me');
          return;
        }
        
        // All guards passed
        setCheckingGuards(false);
      } catch (err) {
        console.error('[ArkivReviewProfile] Guard check failed:', err);
        router.push('/auth');
      }
    };
    
    checkReviewMode();
  }, [wallet, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!formData.displayName.trim()) {
        throw new Error('Display name is required');
      }
      if (!formData.username.trim()) {
        throw new Error('Username is required');
      }
      if (!formData.bio.trim()) {
        throw new Error('Bio is required');
      }
      if (!formData.timezone) {
        throw new Error('Timezone is required');
      }
      if (!formData.seniority) {
        throw new Error('Seniority is required');
      }

      // Filter out empty contact links
      const contactLinks = Object.fromEntries(
        Object.entries(formData.contactLinks).filter(([_, value]) => value.trim())
      );

      // Create profile using existing API route
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createProfile',
          wallet,
          displayName: formData.displayName.trim(),
          username: formData.username.trim(),
          bio: formData.bio.trim(),
          timezone: formData.timezone,
          seniority: formData.seniority,
          contactLinks: Object.keys(contactLinks).length > 0 ? contactLinks : undefined,
          skillsArray: formData.skillsArray.length > 0 ? formData.skillsArray : undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setCreatedProfile({ key: data.key, txHash: data.txHash });
      } else {
        throw new Error(data.error || 'Failed to create profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingGuards || !wallet) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Checking review mode access...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Arkiv Review Mode: Create Profile</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This is a testing mode for Arkiv team. Following M1 acceptance criteria exactly.
        </p>

        {createdProfile ? (
          <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-green-800 dark:text-green-300">
              Profile Created Successfully
            </h2>
            <div className="space-y-2 mb-4">
              <p><strong>Entity Key:</strong> {createdProfile.key}</p>
              <p><strong>Transaction Hash:</strong> {createdProfile.txHash}</p>
            </div>
            <ViewOnArkivLink entityKey={createdProfile.key} txHash={createdProfile.txHash} />
            <div className="mt-4">
              <button
                onClick={() => router.push('/me')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
            </div>
            
            {/* Builder Mode Info */}
            {arkivBuilderMode && (
              <div className="mt-4">
                <EntityWriteInfo
                  entityKey={createdProfile.key}
                  txHash={createdProfile.txHash}
                  entityType="Profile"
                />
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                required
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                required
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Bio <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                required
                rows={4}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Timezone <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                required
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            {/* Seniority */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Seniority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.seniority}
                onChange={(e) => setFormData(prev => ({ ...prev, seniority: e.target.value as any }))}
                required
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="">Select...</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            {/* Contact Links (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">Contact Links (Optional)</label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Twitter"
                  value={formData.contactLinks.twitter}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactLinks: { ...prev.contactLinks, twitter: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="GitHub"
                  value={formData.contactLinks.github}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactLinks: { ...prev.contactLinks, github: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="Telegram"
                  value={formData.contactLinks.telegram}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactLinks: { ...prev.contactLinks, telegram: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="Discord"
                  value={formData.contactLinks.discord}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactLinks: { ...prev.contactLinks, discord: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Skills Array (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">Skills (Optional, comma-separated)</label>
              <input
                type="text"
                placeholder="e.g., Rust, Solidity, JavaScript"
                value={formData.skillsArray.join(', ')}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  skillsArray: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating Profile...' : 'Create Profile'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

