/**
 * Garden Note Compose Modal Component
 *
 * Modal for composing and publishing public garden notes (bulletin board).
 *
 * Features:
 * - Educational UI (blockchain teaching moments)
 * - Explicit consent flow
 * - Clear messaging about public nature
 * - Forest/garden aesthetic with soft glowing panels
 */

'use client';

import { useState, useEffect } from 'react';
import type { UserProfile } from '@/lib/arkiv/profile';
import { GARDEN_NOTE_MAX_LENGTH } from '@/lib/arkiv/gardenNote';

interface GardenNoteComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProfile?: UserProfile | null; // Optional: for "note to a specific profile"
  userWallet: string | null;
  userProfile: UserProfile | null;
  initialTags?: string[]; // Optional: pre-fill tags (e.g., skill name for topic pages)
  onSuccess?: () => void;
}

export function GardenNoteComposeModal({
  isOpen,
  onClose,
  targetProfile,
  userWallet,
  userProfile,
  initialTags,
  onSuccess,
}: GardenNoteComposeModalProps) {
  const [message, setMessage] = useState('');
  const [tags, setTags] = useState('');
  const [publishConsent, setPublishConsent] = useState(false);
  const [showBlockchainInfo, setShowBlockchainInfo] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'draft' | 'submitting' | 'confirmed'>('draft');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Reset form when modal opens/closes, or pre-fill initialTags
  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setTags(initialTags && initialTags.length > 0 ? initialTags.join(', ') : '');
      setPublishConsent(false);
      setShowBlockchainInfo(false);
      setShowConfirmDialog(false);
      setSubmitting(false);
      setError('');
      setStatus('draft');
      setTxHash(null);
    }
  }, [isOpen, initialTags]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (message.length > GARDEN_NOTE_MAX_LENGTH) {
      setError(`Message cannot exceed ${GARDEN_NOTE_MAX_LENGTH} characters`);
      return;
    }

    if (!publishConsent) {
      setError('You must consent to publishing this as a public note');
      return;
    }

    if (!userWallet) {
      setError('Please connect your wallet first');
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmPublish = async () => {
    setShowConfirmDialog(false);
    setSubmitting(true);
    setStatus('submitting');
    setError('');

    try {
      // Parse tags (comma-separated, with or without #)
      const tagArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
     
      // Always include initialTags (from topic pages) - these are automatic and required
      // Merge with user-added tags, ensuring initialTags are always included
      const finalTags = initialTags && initialTags.length > 0
        ? [...new Set([...initialTags, ...tagArray])] // Remove duplicates, initialTags take priority
        : tagArray;
      const res = await fetch('/api/garden-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: userWallet,
          targetWallet: targetProfile?.wallet || undefined,
          message: message.trim(),
          tags: finalTags,
          publishConsent: true,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to publish note');
      }

      setStatus('confirmed');
      setTxHash(data.txHash);

      // Call onSuccess after a brief delay to show confirmation
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to publish note');
      setStatus('draft');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (status === 'submitting') {
      // Don't allow closing while submitting
      return;
    }
    onClose();
  };

  const remainingChars = GARDEN_NOTE_MAX_LENGTH - message.length;
  const charWarning = remainingChars < 50;

  // Parse tags for display
  const parsedTags = tags
    .split(',')
    .map(t => t.trim().replace(/^#/, ''))
    .filter(t => t.length > 0);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop with vignette */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.5) 100%)',
        }}
      />

      {/* Modal - Soft glowing forest panel */}
      <div
        className="relative z-[10000] bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50"
        style={{
          boxShadow: '0 0 40px rgba(34, 197, 94, 0.15), 0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {targetProfile ? `Leave a Note in ${targetProfile.displayName || targetProfile.wallet}'s Garden` : 'Post to Public Garden Board'}
          </h2>
          <button
            onClick={handleClose}
            disabled={status === 'submitting'}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {status === 'confirmed' ? (
            // Success state
            <div className="text-center py-8">
              <div className="text-6xl mb-4 animate-pulse">🌱</div>
              <h3 className="text-2xl font-semibold mb-2 text-green-600 dark:text-green-400">
                Note Published!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your note is now part of the public garden.
              </p>
              {txHash && (
                <div className="mt-4 p-4 bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Transaction Hash:
                  </p>
                  <a
                    href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 dark:text-green-400 hover:underline font-mono text-xs break-all"
                  >
                    {txHash.slice(0, 20)}...
                  </a>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    <a
                      href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 dark:text-green-400 hover:underline"
                    >
                      View in Arkiv Explorer →
                    </a>
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                You can always hide it from your UI, but the data itself remains public.
              </p>
            </div>
          ) : status === 'submitting' ? (
            // Submitting state
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Publishing to Arkiv...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This may take a few moments
              </p>
            </div>
          ) : showConfirmDialog ? (
            // Confirmation dialog
            <div className="py-4">
              <h3 className="text-xl font-semibold mb-4 text-center text-gray-900 dark:text-gray-100">
                Make this note public?
              </h3>
              <div className="bg-yellow-50/80 dark:bg-yellow-900/20 backdrop-blur-sm border border-yellow-200/50 dark:border-yellow-800/50 rounded-xl p-4 mb-4">
                <ul className="list-disc list-inside space-y-2 text-sm text-yellow-900 dark:text-yellow-200">
                  <li>Visible to anyone browsing this garden</li>
                  <li>Stored as public data tied to your wallet/profile</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300/50 dark:border-gray-600/50 rounded-xl hover:bg-gray-50/80 dark:hover:bg-gray-700/80 backdrop-blur-sm transition-colors text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white rounded-xl font-medium transition-all duration-300"
                  style={{
                    boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)',
                  }}
                >
                  Publish Public Note
                </button>
              </div>
            </div>
          ) : (
            // Compose form
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Gentle Lantern Warning */}
              <div className="p-5 rounded-2xl border-2 border-green-400/30 dark:border-green-500/40 bg-gradient-to-br from-green-50/80 to-emerald-50/60 dark:from-green-900/20 dark:to-emerald-900/10 backdrop-blur-sm"
                style={{
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.15), inset 0 0 20px rgba(34, 197, 94, 0.05)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">🌱</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                      This note is public and will live as part of your on-chain garden history.
                    </p>
                    <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                      Do not share anything sensitive or private.
                    </p>
                  </div>
                </div>
              </div>

              {/* Arkiv Info - Seedling Icon */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowBlockchainInfo(!showBlockchainInfo)}
                  className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-2 transition-colors group"
                >
                  <span className="text-base animate-pulse">🌱</span>
                  <span>What is Arkiv?</span>
                  <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity">
                    {showBlockchainInfo ? '▼' : '▶'}
                  </span>
                </button>
                {showBlockchainInfo && (
                  <div className="mt-3 p-4 bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-600/50 text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                    style={{
                      animation: 'fadeIn 0.3s ease-out',
                    }}
                  >
                    <p className="mb-2">
                      <strong>Arkiv</strong> is the trustless data layer your notes live on. Everything here is public and permanent.
                    </p>
                  </div>
                )}
              </div>

              {/* Message Input - Softened with garden theme */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Plant a message in the public garden…"
                  required
                  maxLength={GARDEN_NOTE_MAX_LENGTH}
                  className={`w-full px-4 py-3 border-2 border-gray-300/50 dark:border-gray-600/50 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 dark:focus:border-green-500/50 transition-all ${
                    charWarning ? 'border-yellow-400/50' : ''
                  }`}
                  style={{
                    boxShadow: '0 0 10px rgba(34, 197, 94, 0.05)',
                  }}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {remainingChars} characters remaining
                  </p>
                  {charWarning && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠️ Approaching limit
                    </p>
                  )}
                </div>
              </div>

              {/* Tags Input with Sprout Chips */}
              <div>
                <label htmlFor="tags" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                  {initialTags && initialTags.length > 0 ? 'Tags' : 'Tags (optional)'}
                </label>
                {/* Show automatic tags from topic page */}
                {initialTags && initialTags.length > 0 && (
                  <div className="mb-3 p-3 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm rounded-xl border border-green-200/50 dark:border-green-700/50">
                    <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">
                      Automatically tagged for this topic:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {initialTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-gradient-to-r from-green-200 to-emerald-200 dark:from-green-800/50 dark:to-emerald-800/50 text-green-900 dark:text-green-100 rounded-full text-xs font-medium border-2 border-green-300/50 dark:border-green-600/50"
                          style={{
                            boxShadow: '0 0 8px rgba(34, 197, 94, 0.2)',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={initialTags && initialTags.length > 0 ? "Add more tags (optional)..." : "e.g. #gratitude, #looking-for-mentor"}
                  className="w-full px-4 py-3 border-2 border-gray-300/50 dark:border-gray-600/50 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 dark:focus:border-green-500/50 transition-all"
                  style={{
                    boxShadow: '0 0 10px rgba(34, 197, 94, 0.05)',
                  }}
                />
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {parsedTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium border border-green-200/50 dark:border-green-700/50"
                        style={{
                          boxShadow: '0 0 8px rgba(34, 197, 94, 0.1)',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {initialTags && initialTags.length > 0
                    ? "You can add additional tags, but the topic tag is automatically included."
                    : "Separate tags with commas (e.g., #gratitude, #offer-help)"}
                </p>
              </div>

              {/* Consent Checkbox - Muted Golden Glow */}
              <div className="p-5 rounded-xl border-2 border-amber-300/30 dark:border-amber-600/30 bg-gradient-to-br from-amber-50/60 to-yellow-50/40 dark:from-amber-900/15 dark:to-yellow-900/10 backdrop-blur-sm"
                style={{
                  boxShadow: '0 0 20px rgba(251, 191, 36, 0.1), inset 0 0 20px rgba(251, 191, 36, 0.05)',
                }}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishConsent}
                    onChange={(e) => setPublishConsent(e.target.checked)}
                    className="mt-1 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                    required
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🔓</span>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        I understand this note will be public and stored on-chain.
                      </p>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      Anyone can view it as a public Arkiv entry.
                    </p>
                  </div>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/50 dark:border-red-800/50 rounded-xl">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 border-2 border-gray-300/50 dark:border-gray-600/50 rounded-xl hover:bg-gray-50/80 dark:hover:bg-gray-700/80 backdrop-blur-sm transition-colors text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!publishConsent || !message.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    boxShadow: !publishConsent || !message.trim()
                      ? 'none'
                      : '0 0 20px rgba(34, 197, 94, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <span>🌿</span>
                  <span>Continue</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
