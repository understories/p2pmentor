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
import { validateDateTimeAgainstAvailability } from '@/lib/arkiv/availability';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';

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
  const [formData, setFormData] = useState({
    skill: '',
    date: '',
    time: '',
    duration: '60',
    notes: '',
    // Payment fields for offer mode
    requiresPayment: false,
    paymentAddress: '',
    cost: '',
  });

  // Pre-fill skill from offer, ask, or profile's first skill
  useEffect(() => {
    if (profile && isOpen) {
      // If there's a specific offer or ask, use its skill; otherwise use profile's first skill
      const skill = offer?.skill || ask?.skill || profile.skillsArray?.[0] || profile.skills?.split(',')[0]?.trim() || '';
      setFormData(prev => ({
        ...prev,
        skill: skill,
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
  }, [profile, offer, ask, isOpen]);

  if (!isOpen || !profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWallet) {
      setError('Please connect your wallet first');
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

    // Validate against offer availability if offer is provided (request mode only)
    if (mode === 'request' && offer?.availabilityWindow) {
      const sessionDate = new Date(`${formData.date}T${formData.time}`).toISOString();
      const validation = validateDateTimeAgainstAvailability(sessionDate, offer.availabilityWindow);
      if (!validation.valid) {
        setError(validation.error || 'Selected time does not match mentor availability');
        return;
      }
    }

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
          setError('Cannot start a peer learning session with yourself. Please select a different person.');
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
      const requiresPayment = mode === 'peer'
        ? false // Peer learning is always free
        : (mode === 'offer' 
          ? formData.requiresPayment 
          : (offer?.isPaid || false));
      const paymentAddress = mode === 'peer'
        ? undefined // Peer learning is always free
        : (mode === 'offer'
          ? (formData.requiresPayment ? formData.paymentAddress.trim() : undefined)
          : (offer?.paymentAddress || undefined));
      const cost = mode === 'peer'
        ? undefined // Peer learning is always free
        : (mode === 'offer'
          ? (formData.requiresPayment ? formData.cost.trim() : undefined)
          : (offer?.cost || undefined));

      // Get skill_id from offer/ask if available (Arkiv-native skill entity reference)
      // This ensures sessions display the skill entity name_canonical, not just the skill name string
      let skill_id: string | undefined = undefined;
      if (offer?.skill_id) {
        skill_id = offer.skill_id;
      } else if (ask?.skill_id) {
        skill_id = ask.skill_id;
      } else {
        // Try to resolve skill_id from skill name if not available from offer/ask
        // This handles cases where session is created without an offer/ask context
        // Try to resolve skill_id from skill name if not available from offer/ask
        // This handles cases where session is created without an offer/ask context
        try {
          const { getSkillBySlug, listSkills } = await import('@/lib/arkiv/skill');
          // First try by slug (normalized skill name)
          const normalizedSkill = formData.skill.trim().toLowerCase().replace(/\s+/g, '-');
          let skillEntity = await getSkillBySlug(normalizedSkill);
          // If not found by slug, try searching by name_canonical
          if (!skillEntity) {
            const allSkills = await listSkills({ status: 'active', limit: 200 });
            const foundSkill = allSkills.find(s => 
              s.name_canonical.toLowerCase() === formData.skill.trim().toLowerCase()
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

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createSession',
            wallet: userWallet,
            mentorWallet,
            learnerWallet,
            skill: formData.skill.trim(), // Legacy: kept for backward compatibility
            skill_id: skill_id, // Arkiv-native: skill entity key (preferred)
            sessionDate,
            duration: formData.duration || '60',
            notes: formData.notes.trim() || '',
            requiresPayment,
            paymentAddress,
            cost,
          }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      // Success - handle both immediate success and pending confirmation
      setShowConfirmation(false);
      setSubmitting(false); // Reset submitting state before closing
      
      // Close modal first, then show alert to avoid blocking state updates
      if (onSuccess) {
        onSuccess();
      }
      onClose();
      setFormData({ skill: '', date: '', time: '', duration: '60', notes: '', requiresPayment: false, paymentAddress: '', cost: '' });
      
      // Show success message after modal is closed (non-blocking)
      setTimeout(() => {
        if (data.pending) {
          // Transaction submitted but confirmation pending
          alert(`Meeting request submitted! ${data.message || 'Confirmation is pending. Please check your sessions in a moment.'}`);
        } else {
          // Immediate success
          if (data.txHash) {
            const shortHash = data.txHash.slice(0, 10) + '...';
            alert(`Meeting requested successfully! Transaction: ${shortHash}`);
          } else {
            alert('Meeting requested successfully!');
          }
        }
      }, 100);
    } catch (err: any) {
      console.error('Error creating session:', err);
      const errorMessage = err.message || 'Failed to request meeting';
      
      // Check if this is a transaction receipt timeout (common on testnets)
      if (errorMessage.includes('Transaction receipt') || 
          errorMessage.includes('confirmation pending') ||
          errorMessage.includes('Transaction submitted')) {
        // This is actually a partial success - transaction was submitted
        setError(''); // Clear error state
        setSubmitting(false); // Reset submitting state before closing
        
        // Close modal first, then show alert to avoid blocking state updates
        if (onSuccess) {
          onSuccess();
        }
        onClose();
        setFormData({ skill: '', date: '', time: '', duration: '60', notes: '', requiresPayment: false, paymentAddress: '', cost: '' });
        
        // Show success message after modal is closed (non-blocking)
        setTimeout(() => {
          alert(`Meeting request submitted! The transaction is being processed. Please check your sessions in a few moments. If it doesn't appear, the transaction may still be confirming on the testnet.`);
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
      setFormData({ skill: '', date: '', time: '', duration: '60', notes: '', requiresPayment: false, paymentAddress: '', cost: '' });
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
        className="relative z-[10000] bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">
              {mode === 'offer' ? 'Offer to Help' : mode === 'peer' ? 'Peer Learning' : 'Request Meeting'}
            </h2>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400/20 to-blue-500/20 dark:from-green-400/10 dark:to-blue-500/10 flex items-center justify-center border border-green-300/30 dark:border-green-500/20 flex-shrink-0">
                <EmojiIdentitySeed profile={profile} size="md" showGlow={true} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                  {mode === 'offer' 
                    ? '🌿 Offering to help' 
                    : mode === 'peer'
                    ? '🌱 Starting peer learning session with'
                    : '🌱 Requesting a session with'}
                </p>
                <p className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                  {profile.displayName || profile.wallet.slice(0, 6) + '...' + profile.wallet.slice(-4)}
                </p>
              </div>
            </div>
            {profile.bioShort && (
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 line-clamp-2">
                {profile.bioShort}
              </p>
            )}
            {ask && (
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-2 italic">
                Learning: {ask.message.substring(0, 100)}{ask.message.length > 100 ? '...' : ''}
              </p>
            )}
          </div>

          {/* Confirmation Preview */}
          {showConfirmation ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-blue-900 dark:text-blue-200">
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
                    <strong>Date:</strong> {new Date(formData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p>
                    <strong>Time:</strong> {new Date(`2000-01-01T${formData.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p>
                    <strong>Duration:</strong> {formData.duration} minutes
                  </p>
                  {formData.notes && (
                    <p>
                      <strong>Notes:</strong> {formData.notes}
                    </p>
                  )}
                  {(offer?.isPaid || (mode === 'offer' && formData.requiresPayment)) && (
                    <p className="text-purple-700 dark:text-purple-300">
                      <strong>Payment Required:</strong> {mode === 'offer' ? (formData.cost || 'Amount TBD') : (offer?.cost || 'Amount TBD')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
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
                      `Note: Creates session_txhash entity for transaction tracking`
                    ]}
                    label={mode === 'offer' ? 'Confirm & Offer Help' : mode === 'peer' ? 'Confirm & Start Session' : 'Confirm & Request'}
                  >
                    <button
                      type="button"
                      onClick={handleConfirmSubmit}
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting 
                        ? (mode === 'offer' ? 'Offering...' : mode === 'peer' ? 'Creating...' : 'Requesting...') 
                        : (mode === 'offer' ? 'Confirm & Offer Help' : mode === 'peer' ? 'Confirm & Start Session' : 'Confirm & Request')}
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting 
                      ? (mode === 'offer' ? 'Offering...' : mode === 'peer' ? 'Creating...' : 'Requesting...') 
                      : (mode === 'offer' ? 'Confirm & Offer Help' : mode === 'peer' ? 'Confirm & Start Session' : 'Confirm & Request')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="skill" className="block text-sm font-medium mb-1">
                Skill *
              </label>
              <input
                id="skill"
                type="text"
                value={formData.skill}
                onChange={(e) => setFormData({ ...formData, skill: e.target.value })}
                placeholder="e.g. solidity, react, design"
                required
                readOnly={!!offer || !!ask}
                disabled={!!offer || !!ask}
                className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${(offer || ask) ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
              />
              {(offer || ask) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Skill is set by the {offer ? 'offer' : 'ask'} and cannot be changed
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium mb-1">
                  Date *
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={today}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium mb-1">
                  Time * (15-min intervals)
                </label>
                <input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => {
                    const time = e.target.value;
                    if (!time) {
                      setFormData({ ...formData, time: '' });
                      return;
                    }
                    // Round to nearest 15 minutes
                    const [hours, minutes] = time.split(':').map(Number);
                    const roundedMinutes = Math.round(minutes / 15) * 15;
                    let adjustedHours = hours;
                    let finalMinutes = roundedMinutes;
                    if (roundedMinutes >= 60) {
                      adjustedHours = (hours + 1) % 24;
                      finalMinutes = 0;
                    }
                    const roundedTime = `${String(adjustedHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
                    setFormData({ ...formData, time: roundedTime });
                  }}
                  step="900"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Times are rounded to 15-minute intervals
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium mb-2">
                Duration
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {['30', '60', '90', '120'].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFormData({ ...formData, duration: mins })}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                      formData.duration === mins
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes (optional)
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notes: 'First session - introduction and overview' })}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  First session
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notes: 'Follow-up session - continuing from previous' })}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  Follow-up
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notes: 'Quick question - need help with specific issue' })}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Payment Info for Paid Offers (request mode) */}
            {mode === 'request' && offer?.isPaid && offer.paymentAddress && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
                  💰 Payment Required
                </p>
                {offer.cost && (
                  <p className="text-sm text-purple-800 dark:text-purple-300 mb-2">
                    Cost: <strong>{offer.cost}</strong>
                  </p>
                )}
                <p className="text-xs text-purple-700 dark:text-purple-400 mb-2">
                  Payment address: <span className="font-mono">{offer.paymentAddress}</span>
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  <strong>Note:</strong> After the mentor confirms your session request, you will be able to submit your payment transaction hash.
                </p>
              </div>
            )}

            {/* Payment Settings for Offer Mode */}
            {mode === 'offer' && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresPayment}
                      onChange={(e) => setFormData({ ...formData, requiresPayment: e.target.checked })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-purple-900 dark:text-purple-200">
                      This is a paid session
                    </span>
                  </label>
                </div>

                {formData.requiresPayment && (
                  <div className="space-y-3 mt-3">
                    <div>
                      <label htmlFor="paymentAddress" className="block text-sm font-medium mb-1 text-purple-900 dark:text-purple-200">
                        Payment Address *
                      </label>
                      <input
                        id="paymentAddress"
                        type="text"
                        value={formData.paymentAddress}
                        onChange={(e) => setFormData({ ...formData, paymentAddress: e.target.value })}
                        placeholder="0x..."
                        required={formData.requiresPayment}
                        className="w-full px-4 py-2 border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                        Address where payment will be received
                      </p>
                    </div>

                    <div>
                      <label htmlFor="cost" className="block text-sm font-medium mb-1 text-purple-900 dark:text-purple-200">
                        Cost (optional)
                      </label>
                      <input
                        id="cost"
                        type="text"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        placeholder="e.g., 0.1 ETH, $50"
                        className="w-full px-4 py-2 border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                        Optional: Amount or description of payment
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stake for Accountability (Coming Soon) for Peer Learning */}
            {mode === 'peer' && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg opacity-60">
                <div className="mb-2">
                  <label className="flex items-center gap-2 cursor-not-allowed">
                    <input
                      type="checkbox"
                      disabled
                      className="w-4 h-4 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                    />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Stake for accountability (Coming Soon)
                    </span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Learners can stake to hold themselves accountable. This feature will be available in a future update.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
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
                    `Note: Creates session_txhash entity for transaction tracking`
                  ]}
                  label={mode === 'offer' ? 'Offer to Help' : mode === 'peer' ? 'Start Peer Learning' : 'Request Meeting'}
                >
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting 
                      ? (mode === 'offer' ? 'Offering...' : mode === 'peer' ? 'Creating...' : 'Requesting...') 
                      : (mode === 'offer' ? 'Offer to Help' : mode === 'peer' ? 'Start Peer Learning' : 'Request Meeting')}
                  </button>
                </ArkivQueryTooltip>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting 
                    ? (mode === 'offer' ? 'Offering...' : mode === 'peer' ? 'Creating...' : 'Requesting...') 
                    : (mode === 'offer' ? 'Offer to Help' : mode === 'peer' ? 'Start Peer Learning' : 'Request Meeting')}
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

