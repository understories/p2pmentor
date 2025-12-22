/**
 * Availability management page
 * 
 * Simple text-based availability management.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Availability, WeeklyAvailability } from '@/lib/arkiv/availability';
import { 
  deserializeWeeklyAvailability, 
  formatWeeklyAvailabilityForDisplay,
  isStructuredAvailability 
} from '@/lib/arkiv/availability';
import { WeeklyAvailabilityEditor } from '@/components/availability/WeeklyAvailabilityEditor';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { EntityWriteInfo } from '@/components/EntityWriteInfo';

export default function AvailabilityPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null); // Track which availability is being edited
  const [deletingKey, setDeletingKey] = useState<string | null>(null); // Track which availability is being deleted
  const [lastWriteInfo, setLastWriteInfo] = useState<{ key: string; txHash: string; entityType: string } | null>(null);
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();

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

    // Validate structured format
    if (!weeklyAvailability) {
      setError('Please set your availability using the weekly schedule');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    setLastWriteInfo(null); // Clear previous write info

    try {
      // Create availability entity
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          timeBlocks: weeklyAvailability,
          timezone: timezone || 'UTC',
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (data.pending) {
          setSuccess('Availability submitted! Transaction is being processed. Please refresh in a moment.');
          setWeeklyAvailability(null);
          // Reload after a delay to allow entity to be indexed
          setTimeout(() => loadData(walletAddress), 2000);
        } else {
          setSuccess(editingKey ? 'Availability updated successfully!' : 'Availability created successfully!');
          // Store entity info for builder mode display (U1.x.1: Explorer Independence)
          if (data.key && data.txHash) {
            setLastWriteInfo({ key: data.key, txHash: data.txHash, entityType: 'availability' });
          }
          setWeeklyAvailability(null);
          setEditingKey(null);
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

  const handleEdit = (availability: Availability) => {
    // Load availability into form for editing
    const isStructured = isStructuredAvailability(availability.timeBlocks);
    
    if (isStructured) {
      const structured = deserializeWeeklyAvailability(availability.timeBlocks);
      if (structured) {
        setWeeklyAvailability(structured);
        setTimezone(structured.timezone);
        setEditingKey(availability.key);
        setError('');
        setSuccess('');
      } else {
        setError('Cannot edit legacy availability format. Please create a new availability block using the weekly schedule.');
        return;
      }
    } else {
      setError('Cannot edit legacy availability format. Please create a new availability block using the weekly schedule.');
      return;
    }
    
    // Scroll to form
    window.scrollTo({ top: document.getElementById('availability-form')?.offsetTop || 0, behavior: 'smooth' });
  };

  const handleDelete = async (availabilityKey: string) => {
    if (!walletAddress) {
      setError('Wallet address is required');
      return;
    }

    if (!confirm('Are you sure you want to delete this availability block? This action cannot be undone.')) {
      return;
    }

    setDeletingKey(availabilityKey);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityKey,
          wallet: walletAddress,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (data.pending) {
          setSuccess('Deletion submitted! Transaction is being processed. Please refresh in a moment.');
          setTimeout(() => loadData(walletAddress), 2000);
        } else {
          setSuccess('Availability deleted successfully!');
          await loadData(walletAddress);
        }
      } else {
        setError(data.error || 'Failed to delete availability');
      }
    } catch (err: any) {
      console.error('Error deleting availability:', err);
      setError(err.message || 'Failed to delete availability');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setWeeklyAvailability(null);
    setTimezone(profile?.timezone || 'UTC');
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `loadData("${walletAddress?.toLowerCase() || '...'}")`,
                `Queries:`,
                `1. getProfileByWallet("${walletAddress?.toLowerCase() || '...'}")`,
                `   → type='user_profile', wallet='${walletAddress?.toLowerCase() || '...'}'`,
                `2. GET /api/availability?wallet=${walletAddress?.toLowerCase() || '...'}`,
                `   → type='availability', wallet='${walletAddress?.toLowerCase() || '...'}'`,
                `Returns: Availability[] (all availability entities for wallet)`
              ]}
              label="Loading Availability"
            >
              <LoadingSpinner text="Loading availability..." className="py-12" />
            </ArkivQueryTooltip>
          ) : (
            <LoadingSpinner text="Loading availability..." className="py-12" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <PageHeader
          title="Availability"
          description="Set your general availability for mentorship sessions."
        />

        {/* Integral Profile View - Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4" aria-label="Profile sections">
            <Link
              href="/me/profile"
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              Core Identity
            </Link>
            <Link
              href="/me/skills"
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              Skills
            </Link>
            <Link
              href="/me/availability"
              className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 transition-colors"
            >
              Availability
            </Link>
          </nav>
        </div>


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
                const isEditing = editingKey === availability.key;
                const isDeleting = deletingKey === availability.key;

                return (
                  <div
                    key={availability.key}
                    className={`p-4 border rounded-lg ${
                      isEditing
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        {isEditing && (
                          <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                            ✏️ Editing this block
                          </p>
                        )}
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
                      <div className="flex items-center gap-2 ml-4">
                        {!arkivBuilderMode && availability.txHash && (
                          <a
                            href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${availability.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View on Arkiv
                          </a>
                        )}
                        {arkivBuilderMode ? (
                          <ArkivQueryTooltip
                            query={[
                              `Editing creates new entity (original remains immutable)`,
                              `POST /api/availability { wallet, timeBlocks, timezone }`,
                              `Creates: type='availability' entity`,
                              `Attributes: wallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', timeBlocks, timezone`,
                              `Payload: Full availability data`,
                              `TTL: 1 year (31536000 seconds)`
                            ]}
                            label="Edit Availability"
                          >
                            <button
                              onClick={() => handleEdit(availability)}
                              disabled={isEditing || isDeleting}
                              className="ml-4 px-3 py-1 rounded text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                            >
                              {isEditing ? 'Editing...' : 'Edit'}
                            </button>
                          </ArkivQueryTooltip>
                        ) : (
                          <button
                            onClick={() => handleEdit(availability)}
                            disabled={isEditing || isDeleting}
                            className="ml-4 px-3 py-1 rounded text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                          >
                            {isEditing ? 'Editing...' : 'Edit'}
                          </button>
                        )}
                        {arkivBuilderMode ? (
                          <ArkivQueryTooltip
                            query={[
                              `DELETE /api/availability { availabilityKey, wallet }`,
                              `Creates: type='availability_deletion' entity`,
                              `Attributes: availabilityKey='${availability.key.slice(0, 12)}...', wallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...'`,
                              `Payload: { deletedAt: ISO timestamp }`,
                              `TTL: 1 year (31536000 seconds)`,
                              `Note: Creates deletion marker, original entity remains on Arkiv`
                            ]}
                            label="Delete Availability"
                          >
                            <button
                              onClick={() => handleDelete(availability.key)}
                              disabled={isEditing || isDeleting}
                              className="ml-4 px-3 py-1 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                          </ArkivQueryTooltip>
                        ) : (
                          <button
                            onClick={() => handleDelete(availability.key)}
                            disabled={isEditing || isDeleting}
                            className="ml-4 px-3 py-1 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
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
        <div id="availability-form" className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingKey ? 'Edit Availability Block' : 'Add Availability Block'}
          </h2>
          {editingKey && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Editing mode:</strong> Modifying an availability block will create a new entity. The original will remain on Arkiv until it expires.
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Structured Weekly Availability Editor */}
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
          {lastWriteInfo && (
            <EntityWriteInfo
              entityKey={lastWriteInfo.key}
              txHash={lastWriteInfo.txHash}
              entityType={lastWriteInfo.entityType}
              className="mb-4"
            />
          )}

          <div className="flex gap-3">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `POST /api/availability { wallet, timeBlocks, timezone }`,
                  `Creates: type='availability' entity`,
                  `Attributes: wallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', timeBlocks, timezone`,
                  `Payload: Full availability data (structured or text format)`,
                  `TTL: 1 year (31536000 seconds)`,
                  editingKey ? `Note: Creates new entity (original remains immutable)` : ``
                ]}
                label={editingKey ? 'Update Availability' : 'Save Availability'}
              >
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : editingKey ? 'Update Availability' : 'Save Availability'}
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : editingKey ? 'Update Availability' : 'Save Availability'}
              </button>
            )}
            {editingKey ? (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setWeeklyAvailability(null);
                  setTimezone(profile?.timezone || 'UTC');
                  setError('');
                  setSuccess('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Note:</strong> Each availability block is stored as a separate Arkiv entity. You can create multiple blocks for different time periods. When creating offers, you can reference these availability blocks.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            <strong>Arkiv-native editing:</strong> Editing creates a new entity (original remains immutable). Deleting creates a deletion marker entity that filters out the original.
          </p>
        </div>

        {/* Display Availability Blocks Below Form (for better UX) */}
        {availabilities.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">All Availability Blocks</h2>
            <div className="space-y-3">
              {availabilities.map((availability) => {
                // Check if structured format and format accordingly
                const isStructured = isStructuredAvailability(availability.timeBlocks);
                const structuredAvail = isStructured ? deserializeWeeklyAvailability(availability.timeBlocks) : null;
                const displayText = structuredAvail 
                  ? formatWeeklyAvailabilityForDisplay(structuredAvail)
                  : availability.timeBlocks;
                const isEditing = editingKey === availability.key;
                const isDeleting = deletingKey === availability.key;

                return (
                  <div
                    key={availability.key}
                    className={`p-4 border rounded-lg ${
                      isEditing
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        {isEditing && (
                          <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                            ✏️ Editing this block
                          </p>
                        )}
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
                        {arkivBuilderMode && availability.key && (
                          <div className="mt-2 flex items-center gap-2">
                            <ViewOnArkivLink
                              entityKey={availability.key}
                              txHash={availability.txHash}
                              label="View Availability Entity"
                              className="text-xs"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              Key: {availability.key.slice(0, 12)}...
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!arkivBuilderMode && availability.txHash && (
                          <a
                            href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${availability.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View on Arkiv
                          </a>
                        )}
                        {arkivBuilderMode ? (
                          <ArkivQueryTooltip
                            query={[
                              `Editing creates new entity (original remains immutable)`,
                              `POST /api/availability { wallet, timeBlocks, timezone }`,
                              `Creates: type='availability' entity`,
                              `Attributes: wallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', timeBlocks, timezone`,
                              `Payload: Full availability data`,
                              `TTL: 1 year (31536000 seconds)`
                            ]}
                            label="Edit Availability"
                          >
                            <button
                              onClick={() => handleEdit(availability)}
                              disabled={isEditing || isDeleting}
                              className="ml-4 px-3 py-1 rounded text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                            >
                              {isEditing ? 'Editing...' : 'Edit'}
                            </button>
                          </ArkivQueryTooltip>
                        ) : (
                          <button
                            onClick={() => handleEdit(availability)}
                            disabled={isEditing || isDeleting}
                            className="ml-4 px-3 py-1 rounded text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                          >
                            {isEditing ? 'Editing...' : 'Edit'}
                          </button>
                        )}
                        {arkivBuilderMode ? (
                          <ArkivQueryTooltip
                            query={[
                              `DELETE /api/availability { availabilityKey, wallet }`,
                              `Creates: type='availability_deletion' entity`,
                              `Attributes: availabilityKey='${availability.key.slice(0, 12)}...', wallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...'`,
                              `Payload: { deletedAt: ISO timestamp }`,
                              `TTL: 1 year (31536000 seconds)`,
                              `Note: Creates deletion marker, original entity remains on Arkiv`
                            ]}
                            label="Delete Availability"
                          >
                            <button
                              onClick={() => handleDelete(availability.key)}
                              disabled={isEditing || isDeleting}
                              className="ml-4 px-3 py-1 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                          </ArkivQueryTooltip>
                        ) : (
                          <button
                            onClick={() => handleDelete(availability.key)}
                            disabled={isEditing || isDeleting}
                            className="ml-4 px-3 py-1 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
