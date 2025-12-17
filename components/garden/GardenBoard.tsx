/**
 * GardenBoard Component
 * 
 * Reusable component for displaying garden notes with filtering.
 * Used on topic pages (filter by skill tags) and profile pages (filter by targetWallet).
 * 
 * Reuses logic and UI from the main public garden board.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { GardenNoteComposeModal } from '@/components/GardenNoteComposeModal';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import type { GardenNote } from '@/lib/arkiv/gardenNote';
import type { UserProfile } from '@/lib/arkiv/profile';

interface GardenBoardProps {
  /** Filter notes by target wallet (for profile pages) */
  targetWallet?: string;
  /** Filter notes by tags (for topic pages - skill names) */
  tags?: string[];
  /** Channel to filter by (default: 'public_garden_board') */
  channel?: string;
  /** Title to display above the board */
  title?: string;
  /** Description text */
  description?: string;
  /** Whether to show the compose button (default: true if userWallet provided) */
  showCompose?: boolean;
  /** User wallet for compose functionality */
  userWallet?: string | null;
  /** User profile for compose functionality */
  userProfile?: UserProfile | null;
  /** Optional skill name for topic pages (pre-fills tag in compose modal) */
  skillName?: string;
  /** Optional target profile for profile pages (pre-fills targetWallet in compose modal) */
  targetProfile?: UserProfile | null;
}

export function GardenBoard({
  targetWallet,
  tags,
  channel = 'public_garden_board',
  title = 'Garden Board',
  description = 'Shared messages from this community.',
  showCompose = true,
  userWallet,
  userProfile,
  skillName,
  targetProfile,
}: GardenBoardProps) {
  const [notes, setNotes] = useState<GardenNote[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    loadNotes();
  }, [targetWallet, tags, channel]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError('');

      // Build query params (arkiv-native: uses API route which queries Arkiv entities)
      const params = new URLSearchParams();
      params.set('channel', channel);
      if (targetWallet) {
        params.set('targetWallet', targetWallet);
      }
      if (tags && tags.length > 0) {
        params.set('tags', tags.join(','));
      }

      const res = await fetch(`/api/garden-notes?${params.toString()}`);
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load garden notes');
      }

      setNotes(data.notes || []);

      // Load profiles for all note authors and targets
      const uniqueWallets = new Set<string>();
      data.notes?.forEach((note: GardenNote) => {
        uniqueWallets.add(note.authorWallet);
        if (note.targetWallet) {
          uniqueWallets.add(note.targetWallet);
        }
      });

      const profilePromises = Array.from(uniqueWallets).map(async (wallet) => {
        try {
          const profile = await getProfileByWallet(wallet);
          return { wallet, profile };
        } catch {
          return { wallet, profile: null };
        }
      });

      const profileResults = await Promise.all(profilePromises);
      const profileMap: Record<string, UserProfile> = {};
      profileResults.forEach(({ wallet, profile }) => {
        if (profile) {
          profileMap[wallet.toLowerCase()] = profile;
        }
      });

      setProfiles(profileMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load garden notes');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getAuthorProfile = (wallet: string) => {
    return profiles[wallet.toLowerCase()] || null;
  };

  const getTargetProfile = (wallet?: string) => {
    if (!wallet) return null;
    return profiles[wallet.toLowerCase()] || null;
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {arkivBuilderMode && (
            <ArkivQueryTooltip
              query={[
                `loadNotes()`,
                `Queries:`,
                `1. GET /api/garden-notes?channel=${channel}${targetWallet ? `&targetWallet=${targetWallet.toLowerCase().slice(0, 8)}...` : ''}${tags && tags.length > 0 ? `&tags=${tags.join(',')}` : ''}`,
                `   → type='garden_note', channel='${channel}'${targetWallet ? `, targetWallet='${targetWallet.toLowerCase().slice(0, 8)}...'` : ''}`,
                `2. getProfileByWallet(...) for each unique wallet`,
                `   → type='user_profile', wallet='...'`,
                `Returns: GardenNote[] (filtered garden notes)`
              ]}
              label="Garden Board"
            >
              <span className="text-xs text-gray-400 dark:text-gray-500">🔗</span>
            </ArkivQueryTooltip>
          )}
        </div>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      {/* Compose Button */}
      {showCompose && userWallet && (
        <div className="mb-4">
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `Opens GardenNoteComposeModal to create garden note`,
                `POST /api/garden-notes { action: 'createNote', ... }`,
                `Creates: type='garden_note' entity`,
                `Attributes: authorWallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', channel='${channel}'${targetWallet ? `, targetWallet='${targetWallet.toLowerCase().slice(0, 8)}...'` : ''}`,
                `Payload: Full garden note data (message, tags, etc.)`,
                `TTL: 1 year (31536000 seconds)`
              ]}
              label="Plant a Note"
            >
              <button
                onClick={() => setShowComposeModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white rounded-lg font-medium transition-all duration-300 flex items-center gap-2 text-sm"
                style={{
                  boxShadow: '0 0 10px rgba(34, 197, 94, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                <span>🌿</span>
                <span>Plant a Note</span>
              </button>
            </ArkivQueryTooltip>
          ) : (
            <button
              onClick={() => setShowComposeModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white rounded-lg font-medium transition-all duration-300 flex items-center gap-2 text-sm"
              style={{
                boxShadow: '0 0 10px rgba(34, 197, 94, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              <span>🌿</span>
              <span>Plant a Note</span>
            </button>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `loadNotes()`,
                `Queries: GET /api/garden-notes?channel=${channel}${targetWallet ? `&targetWallet=...` : ''}${tags && tags.length > 0 ? `&tags=...` : ''}`,
                `Returns: GardenNote[] (filtered garden notes)`
              ]}
              label="Loading Garden Notes"
            >
              <LoadingSpinner />
            </ArkivQueryTooltip>
          ) : (
            <LoadingSpinner />
          )}
        </div>
      )}


      {/* Notes List */}
      {!loading && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => {
            const authorProfile = getAuthorProfile(note.authorWallet);
            const targetProfileNote = getTargetProfile(note.targetWallet);
            const authorName = authorProfile?.displayName || authorProfile?.username || note.authorWallet.slice(0, 8) + '...';
            const authorWalletShort = note.authorWallet.slice(0, 6) + '...' + note.authorWallet.slice(-4);

            return (
              <div
                key={note.key}
                className="backdrop-blur-sm rounded-lg shadow-md p-4 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg hover:border-green-300/50 dark:hover:border-green-500/30 transition-all duration-300 relative overflow-hidden"
              >
                {/* Light mode background */}
                <div 
                  className="dark:hidden absolute inset-0 -z-10"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98))',
                  }}
                />
                {/* Dark mode background */}
                <div 
                  className="hidden dark:block absolute inset-0 -z-10"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(31, 41, 55, 0.95), rgba(17, 24, 39, 0.98))',
                  }}
                />
                {/* Gradient only behind this card */}
                <div 
                  className="absolute inset-0 -z-10 opacity-20"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
                  }}
                />
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400/20 to-blue-500/20 dark:from-green-400/10 dark:to-blue-500/10 flex items-center justify-center border border-green-300/30 dark:border-green-500/20 flex-shrink-0">
                        <EmojiIdentitySeed profile={authorProfile} size="sm" showGlow={true} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/profiles/${note.authorWallet}`}
                            className="font-semibold text-sm hover:underline"
                          >
                            {authorName}
                          </Link>
                          {targetProfileNote && (
                            <>
                              <span className="text-gray-400 text-xs">→</span>
                              <Link
                                href={`/profiles/${note.targetWallet}`}
                                className="font-medium text-xs text-gray-600 dark:text-gray-400 hover:underline"
                              >
                                {targetProfileNote.displayName || targetProfileNote.username || 'User'}
                              </Link>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">{formatTimeAgo(note.createdAt)}</span>
                          {note.key && (
                            <>
                              <span className="text-gray-400 dark:text-gray-500">·</span>
                              <ViewOnArkivLink 
                                entityKey={note.key}
                                txHash={note.txHash}
                                label="View on Arkiv"
                                className="text-xs"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mb-2">
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap text-sm">
                      {note.message}
                    </p>
                  </div>

                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {note.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium border border-green-200/50 dark:border-green-700/50"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="pt-2 border-t border-gray-300/50 dark:border-gray-600/50 flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-600 dark:text-gray-400">{authorWalletShort}</span>
                    {note.key && (
                      <ViewOnArkivLink 
                        entityKey={note.key}
                        txHash={note.txHash}
                        label="View on Arkiv"
                        className="text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose Modal */}
      {userWallet && (
        <GardenNoteComposeModal
          isOpen={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          userWallet={userWallet}
          userProfile={userProfile || null}
          targetProfile={targetProfile || null}
          initialTags={skillName ? [skillName] : undefined}
          onSuccess={() => {
            // Wait for blockchain confirmation, then refresh (global pattern)
            setTimeout(() => {
              loadNotes();
            }, 3000); // Wait 3 seconds for entity to be indexed
          }}
        />
      )}
    </div>
  );
}

