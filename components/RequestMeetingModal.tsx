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

interface RequestMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  userWallet: string | null;
  userProfile: UserProfile | null;
  offer?: Offer | null; // Optional offer - if provided, show payment info for paid offers
  onSuccess?: () => void;
}

export function RequestMeetingModal({
  isOpen,
  onClose,
  profile,
  userWallet,
  userProfile,
  offer,
  onSuccess,
}: RequestMeetingModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    skill: '',
    date: '',
    time: '',
    duration: '60',
    notes: '',
    paymentTxHash: '', // Optional payment transaction hash
  });

  // Pre-fill skill from profile's first skill
  useEffect(() => {
    if (profile && isOpen) {
      const firstSkill = profile.skillsArray?.[0] || profile.skills?.split(',')[0]?.trim() || '';
      setFormData(prev => ({
        ...prev,
        skill: firstSkill,
        date: '',
        time: '',
        duration: '60',
        notes: '',
      }));
    }
  }, [profile, isOpen]);

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

    setSubmitting(true);
    setError('');

    try {
      // Combine date and time into ISO string
      const sessionDate = new Date(`${formData.date}T${formData.time}`).toISOString();

      // Determine mentor/learner: if target has mentor roles, they're mentor; if user has mentor roles, they're mentor; otherwise default to target as mentor
      const targetHasMentorRoles = profile.mentorRoles && profile.mentorRoles.length > 0;
      const userHasMentorRoles = userProfile?.mentorRoles && userProfile.mentorRoles.length > 0;
      
      let mentorWallet: string;
      let learnerWallet: string;
      
      // Normalize wallet addresses for comparison
      const targetWallet = profile.wallet?.toLowerCase() || '';
      const normalizedUserWallet = userWallet?.toLowerCase() || '';
      
      // Validate that user and target are different wallets
      if (targetWallet === normalizedUserWallet) {
        setError('Cannot request a meeting with yourself. Please select a different profile.');
        setSubmitting(false);
        return;
      }
      
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

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createSession',
            wallet: userWallet,
            mentorWallet,
            learnerWallet,
            skill: formData.skill.trim(),
            sessionDate,
            duration: formData.duration || '60',
            notes: formData.notes.trim() || '',
            paymentTxHash: formData.paymentTxHash.trim() || undefined,
          }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      // Success - handle both immediate success and pending confirmation
      if (data.pending) {
        // Transaction submitted but confirmation pending
        setError(''); // Clear any previous errors
        alert(`Meeting request submitted! ${data.message || 'Confirmation is pending. Please check your sessions in a moment.'}`);
      } else {
        // Immediate success
        if (data.txHash) {
          const shortHash = data.txHash.slice(0, 10) + '...';
          alert(`Meeting requested successfully! Transaction: ${shortHash}`);
        }
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
      setFormData({ skill: '', date: '', time: '', duration: '60', notes: '', paymentTxHash: '' });
    } catch (err: any) {
      console.error('Error creating session:', err);
      const errorMessage = err.message || 'Failed to request meeting';
      
      // Check if this is a transaction receipt timeout (common on testnets)
      if (errorMessage.includes('Transaction receipt') || 
          errorMessage.includes('confirmation pending') ||
          errorMessage.includes('Transaction submitted')) {
        // This is actually a partial success - transaction was submitted
        setError(''); // Clear error state
        alert(`Meeting request submitted! The transaction is being processed. Please check your sessions in a few moments. If it doesn't appear, the transaction may still be confirming on the testnet.`);
        // Close modal and reset form
        if (onSuccess) {
          onSuccess();
        }
        onClose();
        setFormData({ skill: '', date: '', time: '', duration: '60', notes: '' });
      } else {
        // Real error
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError('');
      setFormData({ skill: '', date: '', time: '', duration: '60', notes: '' });
      onClose();
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isOpen ? 'block' : 'hidden'
      }`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">
              Request Meeting
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

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Schedule a mentorship session with{' '}
            <strong>{profile.displayName || 'this user'}</strong>
          </p>

          {/* Form */}
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
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
                  Time *
                </label>
                <input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium mb-1">
                Duration (minutes)
              </label>
              <input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                min="15"
                max="240"
                step="15"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Any additional details about the session..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Payment Info for Paid Offers */}
            {offer?.isPaid && offer.paymentAddress && (
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
                  Send payment to:
                </p>
                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-purple-300 dark:border-purple-700">
                  <p className="text-xs font-mono text-purple-900 dark:text-purple-100 break-all">
                    {offer.paymentAddress}
                  </p>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  After sending payment, enter the transaction hash below.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="paymentTxHash" className="block text-sm font-medium mb-1">
                Payment Transaction Hash {offer?.isPaid ? '(required)' : '(optional)'}
              </label>
              <input
                id="paymentTxHash"
                type="text"
                value={formData.paymentTxHash}
                onChange={(e) => setFormData({ ...formData, paymentTxHash: e.target.value })}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                required={offer?.isPaid === true}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {offer?.isPaid 
                  ? 'Enter the transaction hash of your payment to this offer'
                  : 'For paid sessions: Enter the transaction hash of your payment'}
              </p>
            </div>

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
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Requesting...' : 'Request Meeting'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

