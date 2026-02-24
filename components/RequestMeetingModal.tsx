/**
 * Request Meeting Modal Component
 *
 * Modal for requesting a mentorship session with another user.
 *
 * Based on mentor-graph implementation, adapted with modern UI.
 *
 * Reference: refs/mentor-graph/pages/network.tsx (requestMeetingModal)
 */

'use client';

import { useState, useEffect } from 'react';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Offer } from '@/lib/arkiv/offers';
import type { Ask } from '@/lib/arkiv/asks';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { SkillSelector } from '@/components/SkillSelector';
import { QuestSelector } from '@/components/QuestSelector';
import { EntityWriteInfo } from '@/components/EntityWriteInfo';

type MeetingMode = 'request' | 'offer' | 'peer';

interface RequestMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  userWallet: string | null;
  userProfile: UserProfile | null;
  offer?: Offer | null; // Optional offer - if provided, show payment info for paid offers
  ask?: Ask | null; // Optional ask - if provided, user is offering to help
  mode?: MeetingMode; // 'request' (default), 'offer', or 'peer' - determines flow direction
  onSuccess?: () => void;
}

export function RequestMeetingModal({
  isOpen,
  onClose,
  profile,
  userWallet,
  userProfile,
  offer,
  ask,
  mode = 'request', // Default to 'request' for backward compatibility
  onSuccess,
}: RequestMeetingModalProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastWriteInfo, setLastWriteInfo] = useState<{
    key: string;
    txHash: string;
    entityType: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    skill: '',
    skill_id: '', // Arkiv-native: skill entity key (preferred)
    date: '',
    time: '',
    duration: '60',
    notes: '',
    // Quest tagging (optional)
    questId: '',
    questTitle: '',
    // Payment fields for offer mode
    requiresPayment: false,
    paymentAddress: '',
    cost: '',
    // TTL fields (default: 6 months = 4320 hours)
    ttlMonths: '6', // Default 6 months
    customTtlMonths: '',
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Pre-fill skill from offer, ask, or profile's first skill
  useEffect(() => {
    if (profile && isOpen) {
      // If there's a specific offer or ask, use its skill; otherwise use profile's first skill
      const skill =
        offer?.skill ||
        ask?.skill ||
        profile.skillsArray?.[0] ||
        profile.skills?.split(',')[0]?.trim() ||
        '';
      const skill_id = offer?.skill_id || ask?.skill_id || undefined;

      // CRITICAL: If skill is empty but skill_id exists, resolve skill name from skill_id
      // This handles cases where offers/asks have skill_id but no skill attribute (arkiv-native)
      // This is a defensive fix to ensure skill is always populated when requesting from an offer
      if ((!skill || skill.trim() === '') && skill_id) {
        // Resolve skill name from skill_id asynchronously
        (async () => {
          try {
            const { getSkillByKey } = await import('@/lib/arkiv/skill');
            const skillEntity = await getSkillByKey(skill_id);
            if (skillEntity && skillEntity.name_canonical) {
              setFormData((prev) => ({
                ...prev,
                skill: mode === 'peer' ? '' : skillEntity.name_canonical, // Don't pre-fill for peer learning
              }));
            }
          } catch (e) {
            console.warn('[RequestMeetingModal] Could not resolve skill name from skill_id:', e);
            // Continue - validation will catch empty skill and show error to user
          }
        })();
      }

      // For peer learning mode, don't pre-fill skill - user must select from SkillSelector
      // For other modes, pre-fill if available
      setFormData((prev) => ({
        ...prev,
        skill: mode === 'peer' ? '' : skill, // Don't pre-fill for peer learning
        skill_id: mode === 'peer' ? '' : skill_id || '', // Don't pre-fill for peer learning
        date: '',
        time: '',
        duration: '60',
        notes: '',
        // Reset payment fields
        requiresPayment: false,
        paymentAddress: '',
        cost: '',
      }));
    }
  }, [profile, offer, ask, isOpen, mode]);

  if (!isOpen || !profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWallet) {
      setError('Please connect your wallet first');
      return;
    }

    // For peer learning, require skill_id (skill entity selection)
    if (mode === 'peer' && !formData.skill_id) {
      setError('Please select a skill from the skill list');
      return;
    }

    if (!formData.date || !formData.time || !formData.skill) {
      setError('Please fill in date, time, and skill');
      return;
    }

    // Validate payment fields if offering paid session (peer learning is always free)
    if (mode === 'offer' && formData.requiresPayment) {
      if (!formData.paymentAddress || !formData.paymentAddress.trim()) {
        setError('Payment address is required for paid sessions');
        return;
      }
      // Basic address validation (starts with 0x and has reasonable length)
      // Allow both 40-char (standard) and 42-char (with checksum) addresses
      const trimmedAddress = formData.paymentAddress.trim();
      const addressPattern = /^0x[a-fA-F0-9]{40}$/i;
      if (!addressPattern.test(trimmedAddress)) {
        setError('Please enter a valid Ethereum address (0x followed by 40 hex characters)');
        return;
      }
    }

    // Validate time is in 15-minute increments
    const [hours, minutes] = formData.time.split(':').map(Number);
    if (minutes % 15 !== 0) {
      setError('Time must be in 15-minute intervals (e.g., 1:00 PM, 1:15 PM, 1:30 PM, 1:45 PM)');
      return;
    }

    // Note: Availability validation removed - users can request meetings even if no availability is set
    // Availability is only required when creating offers/asks (enforced in API)

    // Show confirmation preview before submitting
    setShowConfirmation(true);
    setError('');
  };

  const handleConfirmSubmit = async () => {
    if (!userWallet) {
      setError('Please connect your wallet first');
      setShowConfirmation(false);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Combine date and time into ISO string
      const sessionDate = new Date(`${formData.date}T${formData.time}`).toISOString();

      // Normalize wallet addresses for comparison
      const targetWallet = profile.wallet?.toLowerCase() || '';
      const normalizedUserWallet = userWallet?.toLowerCase() || '';

      // Validate that user and target are different wallets
      if (targetWallet === normalizedUserWallet) {
        if (mode === 'offer') {
          setError('Cannot offer to help yourself. Please select a different ask.');
        } else if (mode === 'peer') {
          setError(
            'Cannot start a peer learning session with yourself. Please select a different person.'
          );
        } else {
          setError('Cannot request a meeting with yourself. Please select a different profile.');
        }
        setSubmitting(false);
        return;
      }

      let mentorWallet: string;
      let learnerWallet: string;

      if (mode === 'offer') {
        // When offering to help: user is mentor (offering to teach), ask creator is learner
        mentorWallet = normalizedUserWallet;
        learnerWallet = targetWallet;
      } else if (mode === 'peer') {
        // Peer learning: both are peers, use alphabetical order for consistency
        // Initiator goes to mentorWallet slot, other to learnerWallet slot
        // (The distinction doesn't matter for peer learning, but we need to assign them)
        if (normalizedUserWallet < targetWallet) {
          mentorWallet = normalizedUserWallet;
          learnerWallet = targetWallet;
        } else {
          mentorWallet = targetWallet;
          learnerWallet = normalizedUserWallet;
        }
      } else {
        // When requesting meeting: determine based on mentor roles
        const targetHasMentorRoles = profile.mentorRoles && profile.mentorRoles.length > 0;
        const userHasMentorRoles = userProfile?.mentorRoles && userProfile.mentorRoles.length > 0;

        if (targetHasMentorRoles && !userHasMentorRoles) {
          // Target is mentor, user is learner
          mentorWallet = targetWallet;
          learnerWallet = normalizedUserWallet;
        } else if (userHasMentorRoles && !targetHasMentorRoles) {
          // User is mentor, target is learner
          mentorWallet = normalizedUserWallet;
          learnerWallet = targetWallet;
        } else {
          // Default: target is mentor (they're being requested)
          mentorWallet = targetWallet;
          learnerWallet = normalizedUserWallet;
        }
      }

      // Determine payment settings: peer learning is always free, otherwise use offer's payment if requesting, or form data if offering
      const requiresPayment =
        mode === 'peer'
          ? false // Peer learning is always free
          : mode === 'offer'
            ? formData.requiresPayment
            : offer?.isPaid || false;
      const paymentAddress =
        mode === 'peer'
          ? undefined // Peer learning is always free
          : mode === 'offer'
            ? formData.requiresPayment
              ? formData.paymentAddress.trim()
              : undefined
            : offer?.paymentAddress || undefined;
      const cost =
        mode === 'peer'
          ? undefined // Peer learning is always free
          : mode === 'offer'
            ? formData.requiresPayment
              ? formData.cost.trim()
              : undefined
            : offer?.cost || undefined;

      // CRITICAL: Ensure skill is not empty before submitting
      // If skill is still empty at this point, try to resolve from skill_id one more time
      let finalSkill = formData.skill.trim();
      if (!finalSkill && (offer?.skill_id || ask?.skill_id || formData.skill_id)) {
        try {
          const { getSkillByKey } = await import('@/lib/arkiv/skill');
          const skillIdToResolve = offer?.skill_id || ask?.skill_id || formData.skill_id;
          if (skillIdToResolve) {
            const skillEntity = await getSkillByKey(skillIdToResolve);
            if (skillEntity && skillEntity.name_canonical) {
              finalSkill = skillEntity.name_canonical;
            }
          }
        } catch (e) {
          console.warn(
            '[RequestMeetingModal] Could not resolve skill name from skill_id before submit:',
            e
          );
        }
      }

      // Final validation: skill must not be empty
      if (!finalSkill || finalSkill.trim().length === 0) {
        setError('Skill is required. Please select or enter a skill.');
        setSubmitting(false);
        return;
      }

      // Get skill_id from offer/ask if available, or use formData.skill_id (for peer learning)
      // Arkiv-native skill entity reference ensures sessions display the skill entity name_canonical
      let skill_id: string | undefined = undefined;
      if (offer?.skill_id) {
        skill_id = offer.skill_id;
      } else if (ask?.skill_id) {
        skill_id = ask.skill_id;
      } else if (formData.skill_id) {
        // Use skill_id from form (for peer learning mode with SkillSelector)
        skill_id = formData.skill_id;
      } else {
        // Try to resolve skill_id from skill name if not available (legacy fallback)
        // This handles cases where session is created without an offer/ask context
        try {
          const { getSkillBySlug, listSkills } = await import('@/lib/arkiv/skill');
          // First try by slug (normalized skill name)
          const normalizedSkill = finalSkill.toLowerCase().replace(/\s+/g, '-');
          let skillEntity = await getSkillBySlug(normalizedSkill);
          // If not found by slug, try searching by name_canonical
          if (!skillEntity) {
            const allSkills = await listSkills({ status: 'active', limit: 200 });
            const foundSkill = allSkills.find(
              (s) => s.name_canonical.toLowerCase() === finalSkill.toLowerCase()
            );
            skillEntity = foundSkill || null;
          }
          if (skillEntity) {
            skill_id = skillEntity.key;
          }
        } catch (e) {
          console.warn('[RequestMeetingModal] Could not resolve skill_id from skill name:', e);
          // Continue without skill_id - will fall back to legacy skill name display
        }
      }

      // Calculate ttlSeconds from months (default: 6 months)
      // 1 month ≈ 730 hours (30.4 days average)
      const ttlMonths =
        formData.ttlMonths === 'custom'
          ? parseFloat(formData.customTtlMonths || '6')
          : parseFloat(formData.ttlMonths || '6');
      const ttlHours = ttlMonths * 730; // Convert months to hours
      const ttlSeconds = Math.floor(ttlHours * 3600); // Convert hours to seconds

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSession',
          wallet: userWallet,
          mentorWallet,
          learnerWallet,
          skill: finalSkill,
          skill_id: skill_id,
          sessionDate,
          duration: formData.duration || '60',
          notes: formData.notes.trim() || '',
          requiresPayment,
          paymentAddress,
          cost,
          questId: formData.questId || undefined,
          questTitle: formData.questTitle || undefined,
          offerKey: offer?.key,
          askKey: ask?.key,
          mode,
          ttlSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      // Track action completion
      if (data.ok) {
        const { trackActionCompletion } = await import('@/lib/metrics/actionCompletion');
        trackActionCompletion('session_created');

        // Store entity info for builder mode display (U1.x.1: Explorer Independence)
        if (data.key && data.txHash && !data.pending) {
          setLastWriteInfo({ key: data.key, txHash: data.txHash, entityType: 'session' });
        }
      }

      // Success - handle both immediate success and pending confirmation
      setShowConfirmation(false);
      setSubmitting(false); // Reset submitting state before closing

      // Close modal first, then show alert to avoid blocking state updates
      if (onSuccess) {
        onSuccess();
      }
      onClose();
      setFormData({
        skill: '',
        skill_id: '',
        date: '',
        time: '',
        duration: '60',
        notes: '',
        questId: '',
        questTitle: '',
        requiresPayment: false,
        paymentAddress: '',
        cost: '',
        ttlMonths: '6',
        customTtlMonths: '',
      });
      setShowAdvancedOptions(false);

      // Show success message after modal is closed (non-blocking)
      setTimeout(() => {
        const otherPartyName = profile.displayName || 'the other party';
        if (data.pending) {
          // Transaction submitted but confirmation pending
          alert(
            `Meeting request submitted! Check Sessions to see when ${otherPartyName} confirms.`
          );
        } else {
          // Immediate success
          if (data.txHash) {
            const shortHash = data.txHash.slice(0, 10) + '...';
            alert(
              `Meeting requested successfully! Check Sessions to see when ${otherPartyName} confirms. Transaction: ${shortHash}`
            );
          } else {
            alert(
              `Meeting requested successfully! Check Sessions to see when ${otherPartyName} confirms.`
            );
          }
        }
      }, 100);
    } catch (err: any) {
      console.error('Error creating session:', err);
      const errorMessage = err.message || 'Failed to request meeting';

      // Check if this is a transaction receipt timeout (common on testnets)
      if (
        errorMessage.includes('Transaction receipt') ||
        errorMessage.includes('confirmation pending') ||
        errorMessage.includes('Transaction submitted')
      ) {
        // This is actually a partial success - transaction was submitted
        setError(''); // Clear error state
        setSubmitting(false); // Reset submitting state before closing

        // Close modal first, then show alert to avoid blocking state updates
        if (onSuccess) {
          onSuccess();
        }
        onClose();
        setFormData({
          skill: '',
          skill_id: '',
          date: '',
          time: '',
          duration: '60',
          notes: '',
          questId: '',
          questTitle: '',
          requiresPayment: false,
          paymentAddress: '',
          cost: '',
          ttlMonths: '6',
          customTtlMonths: '',
        });
        setShowAdvancedOptions(false);

        // Show success message after modal is closed (non-blocking)
        setTimeout(() => {
          const otherPartyName = profile.displayName || 'the other party';
          alert(
            `Meeting request submitted! Waiting for ${otherPartyName} to confirm. The transaction is being processed. Please check your sessions in a few moments.`
          );
        }, 100);
      } else {
        // Real error
        setError(errorMessage);
        setSubmitting(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError('');
      setShowConfirmation(false);
      setFormData({
        skill: '',
        skill_id: '',
        date: '',
        time: '',
        duration: '60',
        notes: '',
        questId: '',
        questTitle: '',
        requiresPayment: false,
        paymentAddress: '',
        cost: '',
        ttlMonths: '6',
        customTtlMonths: '',
      });
      setShowAdvancedOptions(false);
      onClose();
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-[10000] max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {mode === 'offer'
                ? 'Offer to Help'
                : mode === 'peer'
                  ? 'Peer Learning'
                  : 'Request Meeting'}
            </h2>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-300"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/80">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-green-300/50 bg-gradient-to-br from-green-400/40 to-blue-500/40 backdrop-blur-sm dark:border-green-500/40 dark:from-green-400/30 dark:to-blue-500/30">
                <EmojiIdentitySeed profile={profile} size="md" showGlow={true} />
              </div>
              <div className="flex-1">
                <p className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-200">
                  {mode === 'offer'
                    ? '🌿 Offering to help'
                    : mode === 'peer'
                      ? '🌱 Starting peer learning session with'
                      : '🌱 Requesting a session with'}
                </p>
                <p className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                  {profile.displayName ||
                    profile.wallet.slice(0, 6) + '...' + profile.wallet.slice(-4)}
                </p>
              </div>
            </div>
            {profile.bioShort && (
              <p className="mt-1 line-clamp-2 text-xs text-blue-700 dark:text-blue-400">
                {profile.bioShort}
              </p>
            )}
            {ask && (
              <p className="mt-2 text-xs italic text-blue-700 dark:text-blue-400">
                Learning: {ask.message.substring(0, 100)}
                {ask.message.length > 100 ? '...' : ''}
              </p>
            )}
          </div>

          {/* Confirmation Preview */}
          {showConfirmation ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/80">
                <h3 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-200">
                  {mode === 'offer'
                    ? 'Confirm Help Offer'
                    : mode === 'peer'
                      ? 'Confirm Peer Learning Session'
                      : 'Confirm Meeting Request'}
                </h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Skill:</strong> {formData.skill}
                  </p>
                  <p>
                    <strong>Date:</strong>{' '}
                    {new Date(formData.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p>
                    <strong>Time:</strong>{' '}
                    {new Date(`2000-01-01T${formData.time}`).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <p>
                    <strong>Duration:</strong> {formData.duration} minutes
                  </p>
                  {formData.notes && (
                    <p>
                      <strong>Notes:</strong> {formData.notes}
                    </p>
                  )}
                  {formData.questTitle && (
                    <p>
                      <strong>Learning Quest:</strong> {formData.questTitle}
                    </p>
                  )}
                  {(offer?.isPaid || (mode === 'offer' && formData.requiresPayment)) && (
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Payment Required:</strong>{' '}
                      {mode === 'offer'
                        ? formData.cost || 'Amount TBD'
                        : offer?.cost || 'Amount TBD'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Back to Edit
                </button>
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `POST /api/sessions { action: 'createSession', ... }`,
                      `Creates: type='session' entity`,
                      `Attributes: mentorWallet, learnerWallet, skill, sessionDate, duration, notes`,
                      `Optional: requiresPayment, paymentAddress, cost (if paid session)`,
                      `Payload: Full session data`,
                      `TTL: sessionDate + duration + 1 hour buffer`,
                      `Note: Creates session_txhash entity for transaction tracking`,
                    ]}
                    label={
                      mode === 'offer'
                        ? 'Confirm & Offer Help'
                        : mode === 'peer'
                          ? 'Confirm & Start Session'
                          : 'Confirm & Request'
                    }
                  >
                    <button
                      type="button"
                      onClick={handleConfirmSubmit}
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? mode === 'offer'
                          ? 'Offering...'
                          : mode === 'peer'
                            ? 'Creating...'
                            : 'Requesting...'
                        : mode === 'offer'
                          ? 'Confirm & Offer Help'
                          : mode === 'peer'
                            ? 'Confirm & Start Session'
                            : 'Confirm & Request'}
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? mode === 'offer'
                        ? 'Offering...'
                        : mode === 'peer'
                          ? 'Creating...'
                          : 'Requesting...'
                      : mode === 'offer'
                        ? 'Confirm & Offer Help'
                        : mode === 'peer'
                          ? 'Confirm & Start Session'
                          : 'Confirm & Request'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="skill" className="mb-1 block text-sm font-medium">
                  Skill *
                </label>
                {/* Use SkillSelector for peer learning mode (arkiv-native: skill entity selection) */}
                {mode === 'peer' && !offer && !ask ? (
                  <SkillSelector
                    value={formData.skill_id}
                    onChange={(skillId, skillName) => {
                      setFormData({ ...formData, skill_id: skillId, skill: skillName });
                    }}
                    placeholder="Select a skill..."
                    allowCreate={false}
                    className="mb-2"
                    required
                  />
                ) : (
                  <input
                    id="skill"
                    type="text"
                    value={formData.skill}
                    onChange={(e) => setFormData({ ...formData, skill: e.target.value })}
                    placeholder="e.g. solidity, react, design"
                    required
                    readOnly={!!offer || !!ask}
                    disabled={!!offer || !!ask}
                    className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 ${offer || ask ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}`}
                  />
                )}
                {(offer || ask) && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Skill is set by the {offer ? 'offer' : 'ask'} and cannot be changed
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="mb-1 block text-sm font-medium">
                    Date *
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    min={today}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label htmlFor="time" className="mb-1 block text-sm font-medium">
                    Time * (15-min intervals)
                  </label>
                  <input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    step="900"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Times are rounded to 15-minute intervals
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="duration" className="mb-2 block text-sm font-medium">
                  Duration
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {['30', '60', '90', '120'].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setFormData({ ...formData, duration: mins })}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        formData.duration === mins
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
                <input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  min="15"
                  max="240"
                  step="15"
                  placeholder="Custom (15-240 min)"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              <div>
                <label htmlFor="notes" className="mb-1 block text-sm font-medium">
                  Notes (optional)
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notes: 'First session - introduction and overview',
                      })
                    }
                    className="rounded bg-gray-100 px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    First session
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notes: 'Follow-up session - continuing from previous',
                      })
                    }
                    className="rounded bg-gray-100 px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notes: 'Quick question - need help with specific issue',
                      })
                    }
                    className="rounded bg-gray-100 px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    Quick question
                  </button>
                </div>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any additional details about the session..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              {/* Quest Tag (optional) */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Link to Learning Quest (optional)
                </label>
                <QuestSelector
                  value={formData.questId}
                  onChange={(questId, questTitle) => {
                    setFormData({ ...formData, questId, questTitle });
                  }}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optionally link this session to a learning quest
                </p>
              </div>

              {/* Session Expiration Info */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  ℹ️ This session will expire in{' '}
                  {formData.ttlMonths === 'custom'
                    ? formData.customTtlMonths
                      ? `${formData.customTtlMonths} months`
                      : '...'
                    : `${formData.ttlMonths} months`}
                </p>
              </div>

              {/* Advanced Options Toggle */}
              <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="flex w-full items-center justify-between text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <span>Advanced Options</span>
                  <span>{showAdvancedOptions ? '▲' : '▼'}</span>
                </button>
              </div>

              {/* Advanced Options (Collapsed by Default) */}
              {showAdvancedOptions && (
                <div className="space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div>
                    <label htmlFor="ttlMonths" className="mb-2 block text-sm font-medium">
                      Session Expiration Duration (optional)
                      {arkivBuilderMode ? (
                        <ArkivQueryTooltip
                          query={[
                            `TTL (Time To Live)`,
                            `TLDR: Arkiv entities have an expiration date. After this time, the entity is automatically deleted from the network.`,
                            ``,
                            `Current Selection: ${formData.ttlMonths === 'custom' ? `${formData.customTtlMonths || '...'} months` : `${formData.ttlMonths || '6'} months`}`,
                            `Conversion: months → hours → seconds`,
                            `${formData.ttlMonths === 'custom' ? parseFloat(formData.customTtlMonths || '6') * 730 : parseFloat(formData.ttlMonths || '6') * 730} hours = ${formData.ttlMonths === 'custom' ? Math.floor(parseFloat(formData.customTtlMonths || '6') * 730 * 3600) : Math.floor(parseFloat(formData.ttlMonths || '6') * 730 * 3600)} seconds`,
                            ``,
                            `In Session Entity:`,
                            `→ Arkiv expiresIn: ${formData.ttlMonths === 'custom' ? Math.floor(parseFloat(formData.customTtlMonths || '6') * 730 * 3600) : Math.floor(parseFloat(formData.ttlMonths || '6') * 730 * 3600)} seconds`,
                            ``,
                            `Default: 6 months (allows feedback to persist)`,
                            `Feedback TTL: 1 year (31536000 seconds)`,
                            `Session TTL should be >= feedback TTL to ensure sessions remain queryable`,
                          ]}
                          label="TTL Selection"
                        >
                          <span className="ml-2 cursor-help text-xs text-gray-400 dark:text-gray-500">
                            ℹ️
                          </span>
                        </ArkivQueryTooltip>
                      ) : null}
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="ttlMonths"
                        value={formData.ttlMonths === 'custom' ? 'custom' : formData.ttlMonths}
                        onChange={(e) => setFormData({ ...formData, ttlMonths: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      >
                        <option value="1">1 month</option>
                        <option value="3">3 months</option>
                        <option value="6">6 months - Recommended</option>
                        <option value="12">12 months (1 year)</option>
                        <option value="custom">Custom (months)</option>
                      </select>
                      {formData.ttlMonths === 'custom' && (
                        <input
                          type="number"
                          min="1"
                          max="24"
                          step="1"
                          placeholder="Months"
                          value={formData.customTtlMonths}
                          onChange={(e) => {
                            setFormData({ ...formData, customTtlMonths: e.target.value });
                          }}
                          className="w-32 rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      How long should this session remain queryable? Default: 6 months
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Info for Paid Offers (request mode) */}
              {mode === 'request' && offer?.isPaid && offer.paymentAddress && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 backdrop-blur-sm dark:border-purple-800 dark:bg-purple-900/80">
                  <p className="mb-2 text-sm font-medium text-purple-900 dark:text-purple-200">
                    💰 Payment Required
                  </p>
                  {offer.cost && (
                    <p className="mb-2 text-sm text-purple-800 dark:text-purple-300">
                      Cost: <strong>{offer.cost}</strong>
                    </p>
                  )}
                  <p className="mb-2 text-xs text-purple-700 dark:text-purple-400">
                    Payment address: <span className="font-mono">{offer.paymentAddress}</span>
                  </p>
                  <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                    <strong>Note:</strong> After the mentor confirms your session request, you will
                    be able to submit your payment transaction hash.
                  </p>
                </div>
              )}

              {/* Payment Settings for Offer Mode */}
              {mode === 'offer' && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 backdrop-blur-sm dark:border-purple-800 dark:bg-purple-900/80">
                  <div className="mb-4">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.requiresPayment}
                        onChange={(e) =>
                          setFormData({ ...formData, requiresPayment: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-purple-900 dark:text-purple-200">
                        This is a paid session
                      </span>
                    </label>
                  </div>

                  {formData.requiresPayment && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label
                          htmlFor="paymentAddress"
                          className="mb-1 block text-sm font-medium text-purple-900 dark:text-purple-200"
                        >
                          Payment Address *
                        </label>
                        <input
                          id="paymentAddress"
                          type="text"
                          value={formData.paymentAddress}
                          onChange={(e) =>
                            setFormData({ ...formData, paymentAddress: e.target.value })
                          }
                          placeholder="0x..."
                          required={formData.requiresPayment}
                          className="w-full rounded-lg border border-purple-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-purple-700 dark:bg-gray-700"
                        />
                        <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">
                          Address where payment will be received
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="cost"
                          className="mb-1 block text-sm font-medium text-purple-900 dark:text-purple-200"
                        >
                          Cost (optional)
                        </label>
                        <input
                          id="cost"
                          type="text"
                          value={formData.cost}
                          onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                          placeholder="e.g., 0.1 ETH, $50"
                          className="w-full rounded-lg border border-purple-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-purple-700 dark:bg-gray-700"
                        />
                        <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">
                          Optional: Amount or description of payment
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stake for Accountability (Coming Soon) for Peer Learning */}
              {mode === 'peer' && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 opacity-60 dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-2">
                    <label className="flex cursor-not-allowed items-center gap-2">
                      <input
                        type="checkbox"
                        disabled
                        className="h-4 w-4 cursor-not-allowed rounded border-gray-300 text-gray-400"
                      />
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Stake for accountability (Coming Soon)
                      </span>
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Learners can stake to hold themselves accountable. This feature will be
                    available in a future update.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `POST /api/sessions { action: 'createSession', ... }`,
                      `Creates: type='session' entity`,
                      `Attributes: mentorWallet, learnerWallet, skill, sessionDate, duration, notes`,
                      `Optional: requiresPayment, paymentAddress, cost (if paid session)`,
                      `Payload: Full session data`,
                      `TTL: sessionDate + duration + 1 hour buffer`,
                      `Note: Creates session_txhash entity for transaction tracking`,
                    ]}
                    label={
                      mode === 'offer'
                        ? 'Offer to Help'
                        : mode === 'peer'
                          ? 'Start Peer Learning'
                          : 'Request Meeting'
                    }
                  >
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? mode === 'offer'
                          ? 'Offering...'
                          : mode === 'peer'
                            ? 'Creating...'
                            : 'Requesting...'
                        : mode === 'offer'
                          ? 'Offer to Help'
                          : mode === 'peer'
                            ? 'Start Peer Learning'
                            : 'Request Meeting'}
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? mode === 'offer'
                        ? 'Offering...'
                        : mode === 'peer'
                          ? 'Creating...'
                          : 'Requesting...'
                      : mode === 'offer'
                        ? 'Offer to Help'
                        : mode === 'peer'
                          ? 'Start Peer Learning'
                          : 'Request Meeting'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
