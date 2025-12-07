/**
 * Availability management page
 * 
 * Simple text-based availability management.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { UserProfile } from '@/lib/arkiv/profile';

export default function AvailabilityPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availabilityWindow, setAvailabilityWindow] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      loadProfile(address);
    }
  }, [router]);

  const loadProfile = async (wallet: string) => {
    try {
      setLoading(true);
      const profileData = await getProfileByWallet(wallet);
      setProfile(profileData);
      setAvailabilityWindow(profileData?.availabilityWindow || '');
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Update profile with new availability
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          wallet: walletAddress,
          // Preserve existing profile data
          displayName: profile?.displayName,
          username: profile?.username,
          profileImage: profile?.profileImage,
          bio: profile?.bio,
          bioShort: profile?.bioShort,
          bioLong: profile?.bioLong,
          skills: profile?.skills || '',
          skillsArray: profile?.skillsArray,
          timezone: profile?.timezone || 'UTC',
          languages: profile?.languages,
          contactLinks: profile?.contactLinks,
          seniority: profile?.seniority,
          availabilityWindow: availabilityWindow.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccess('Availability updated successfully!');
        await loadProfile(walletAddress);
      } else {
        setError(data.error || 'Failed to update availability');
      }
    } catch (err: any) {
      console.error('Error updating availability:', err);
      setError(err.message || 'Failed to update availability');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Availability</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Set your general availability for mentorship sessions.
          </p>
        </div>

        {/* Beta Warning */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ <strong>Beta Environment:</strong> This is a test environment. All data is on the Mendoza testnet and may be reset.
          </p>
        </div>

        {/* Current Availability */}
        {profile?.availabilityWindow && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
              Current Availability:
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {profile.availabilityWindow}
            </p>
          </div>
        )}

        {/* Availability Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <label htmlFor="availabilityWindow" className="block text-sm font-medium mb-2">
                Availability Window
              </label>
              <input
                id="availabilityWindow"
                type="text"
                value={availabilityWindow}
                onChange={(e) => setAvailabilityWindow(e.target.value)}
                placeholder="e.g., Mon-Fri 9am-5pm EST, Weekends flexible"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Describe when you're generally available for mentorship. Examples:
              </p>
              <ul className="mt-2 text-sm text-gray-500 dark:text-gray-400 list-disc list-inside space-y-1">
                <li>"Mon-Fri 9am-5pm EST"</li>
                <li>"Weekends 10am-2pm EST"</li>
                <li>"Flexible, prefer evenings"</li>
                <li>"Weekdays after 6pm PST"</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-800 dark:text-green-200">
              {success}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Availability'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAvailabilityWindow(profile?.availabilityWindow || '');
                setError('');
                setSuccess('');
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Note:</strong> This is your general availability. When creating offers, you can specify more detailed availability windows for specific skills.
          </p>
        </div>
      </div>
    </div>
  );
}
