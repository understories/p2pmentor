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
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { BetaBanner } from '@/components/BetaBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Availability, WeeklyAvailability } from '@/lib/arkiv/availability';
import { 
  deserializeWeeklyAvailability, 
  formatWeeklyAvailabilityForDisplay,
  isStructuredAvailability 
} from '@/lib/arkiv/availability';
import { WeeklyAvailabilityEditor } from '@/components/availability/WeeklyAvailabilityEditor';

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
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability | null>(null);
  const [useStructuredFormat, setUseStructuredFormat] = useState(true); // Default to structured format
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
    
    if (!walletAddress) {
      setError('Wallet address is required');
      return;
    }

    // Validate structured format if using it
    if (useStructuredFormat && !weeklyAvailability) {
      setError('Please set your availability using the weekly schedule');
      return;
    }

    // Validate legacy format if using it
    if (!useStructuredFormat && !timeBlocks.trim()) {
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
          timeBlocks: useStructuredFormat ? weeklyAvailability : timeBlocks.trim(),
          timezone: timezone || 'UTC',
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (data.pending) {
          setSuccess('Availability submitted! Transaction is being processed. Please refresh in a moment.');
          setTimeBlocks('');
          setWeeklyAvailability(null);
          // Reload after a delay to allow entity to be indexed
          setTimeout(() => loadData(walletAddress), 2000);
        } else {
          setSuccess('Availability created successfully!');
          setTimeBlocks('');
          setWeeklyAvailability(null);
          await loadData(walletAddress);
        }
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
      <ThemeToggle />
      <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <LoadingSpinner text="Loading availability..." className="py-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <PageHeader
          title="Availability"
          description="Set your general availability for mentorship sessions."
        />

        <BetaBanner />

        {/* Existing Availability Entities (Grouped Chronologically) */}
        {availabilities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Your Availability Blocks</h2>
            <div className="space-y-3">
              {availabilities.map((availability) => {
                // Check if structured format and format accordingly
                const isStructured = isStructuredAvailability(availability.timeBlocks);
                const structuredAvail = isStructured ? deserializeWeeklyAvailability(availability.timeBlocks) : null;
                const displayText = structuredAvail 
                  ? formatWeeklyAvailabilityForDisplay(structuredAvail)
                  : availability.timeBlocks;

                return (
                  <div
                    key={availability.key}
                    className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                          {displayText}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Timezone: {availability.timezone}
                          {isStructured && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-200 dark:bg-blue-800 rounded text-xs">
                              Structured
                            </span>
                          )}
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
                );
              })}
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
          
          {/* Format Toggle */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setUseStructuredFormat(true)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                useStructuredFormat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Weekly Schedule (Recommended)
            </button>
            <button
              type="button"
              onClick={() => setUseStructuredFormat(false)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                !useStructuredFormat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Text Format (Legacy)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {useStructuredFormat ? (
              /* Structured Weekly Availability Editor */
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <WeeklyAvailabilityEditor
                  value={weeklyAvailability}
                  onChange={(avail) => {
                    setWeeklyAvailability(avail);
                    if (avail) {
                      setTimezone(avail.timezone);
                    }
                  }}
                  timezone={timezone}
                  onTimezoneChange={setTimezone}
                  showBulkActions={true}
                />
              </div>
            ) : (
              /* Legacy Text Input */
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
                    required={!useStructuredFormat}
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
                    required={!useStructuredFormat}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Your timezone for this availability block.
                  </p>
                </div>
              </div>
            )}

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
                setWeeklyAvailability(null);
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
        </div>
      </div>
    </div>
  );
}
