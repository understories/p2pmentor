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
import type { Availability } from '@/lib/arkiv/availability';

export default function AvailabilityPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeBlocks, setTimeBlocks] = useState('');
  const [timezone, setTimezone] = useState('UTC');
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
      const [profileData, availabilitiesRes] = await Promise.all([
        getProfileByWallet(wallet).catch(() => null),
        fetch(`/api/availability?wallet=${encodeURIComponent(wallet)}`).then(r => r.json()).catch(() => ({ ok: false, availabilities: [] })),
      ]);
      
      setProfile(profileData);
      if (availabilitiesRes.ok) {
        setAvailabilities(availabilitiesRes.availabilities || []);
      }
      
      // Pre-fill timezone from profile if available
      if (profileData?.timezone) {
        setTimezone(profileData.timezone);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress || !timeBlocks.trim()) {
      setError('Time blocks are required');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Create availability entity
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          timeBlocks: timeBlocks.trim(),
          timezone: timezone || 'UTC',
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccess('Availability created successfully!');
        setTimeBlocks('');
        await loadData(walletAddress);
      } else {
        setError(data.error || 'Failed to create availability');
      }
    } catch (err: any) {
      console.error('Error creating availability:', err);
      setError(err.message || 'Failed to create availability');
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

        {/* Existing Availability Entities (Grouped Chronologically) */}
        {availabilities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Your Availability Blocks</h2>
            <div className="space-y-3">
              {availabilities.map((availability) => (
                <div
                  key={availability.key}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                        {availability.timeBlocks}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Timezone: {availability.timezone}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Created: {new Date(availability.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {availability.txHash && (
                      <a
                        href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${availability.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View on Arkiv
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Profile Availability (for backward compatibility) */}
        {profile?.availabilityWindow && availabilities.length === 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-1">
              Legacy Availability (from profile):
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {profile.availabilityWindow}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
              Create a new availability block below to use the new entity system.
            </p>
          </div>
        )}

        {/* Create New Availability Form */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Add Availability Block</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="mb-4">
                <label htmlFor="timeBlocks" className="block text-sm font-medium mb-2">
                  Time Blocks *
                </label>
                <input
                  id="timeBlocks"
                  type="text"
                  value={timeBlocks}
                  onChange={(e) => setTimeBlocks(e.target.value)}
                  placeholder="e.g., Mon-Fri 9am-5pm EST, Weekends flexible"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Describe when you're available. Examples:
                </p>
                <ul className="mt-2 text-sm text-gray-500 dark:text-gray-400 list-disc list-inside space-y-1">
                  <li>"Mon-Fri 9am-5pm EST"</li>
                  <li>"Weekends 10am-2pm EST"</li>
                  <li>"Flexible, prefer evenings"</li>
                  <li>"Weekdays after 6pm PST"</li>
                </ul>
              </div>
              
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium mb-2">
                  Timezone *
                </label>
                <input
                  id="timezone"
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="UTC, EST, PST, etc."
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Your timezone for this availability block.
                </p>
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
                setTimeBlocks('');
                setTimezone(profile?.timezone || 'UTC');
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
            <strong>Note:</strong> Each availability block is stored as a separate Arkiv entity. You can create multiple blocks for different time periods. When creating offers, you can reference these availability blocks.
          </p>
        </div>
          </form>
        </div>
      </div>
    </div>
  );
}
