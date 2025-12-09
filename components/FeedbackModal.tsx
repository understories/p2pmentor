/**
 * Feedback Modal Component
 * 
 * Modal for submitting post-session feedback (rating, notes, technical DX feedback).
 */

'use client';

import { useState } from 'react';
import type { Session } from '@/lib/arkiv/sessions';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  userWallet: string;
  onSuccess?: () => void;
}

export function FeedbackModal({
  isOpen,
  onClose,
  session,
  userWallet,
  onSuccess,
}: FeedbackModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    rating: 0,
    notes: '',
    technicalDxFeedback: '',
  });

  const isMentor = userWallet.toLowerCase() === session.mentorWallet.toLowerCase();
  const feedbackTo = isMentor ? session.learnerWallet : session.mentorWallet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.rating < 1 || formData.rating > 5) {
      setError('Please provide a rating between 1 and 5');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey: session.key,
          mentorWallet: session.mentorWallet,
          learnerWallet: session.learnerWallet,
          feedbackFrom: userWallet,
          feedbackTo,
          rating: formData.rating,
          notes: formData.notes.trim() || undefined,
          technicalDxFeedback: formData.technicalDxFeedback.trim() || undefined,
          spaceId: session.spaceId,
          sessionStatus: session.status,
          mentorConfirmed: session.mentorConfirmed,
          learnerConfirmed: session.learnerConfirmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      alert('Feedback submitted successfully!');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
      setFormData({ rating: 0, notes: '', technicalDxFeedback: '' });
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError('');
      setFormData({ rating: 0, notes: '', technicalDxFeedback: '' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
          <h2 className="text-2xl font-semibold mb-4">Session Feedback</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Share your experience with this mentorship session
          </p>

          <form onSubmit={handleSubmit}>
            {/* Rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Rating * (1-5 stars)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className={`text-3xl ${
                      formData.rating >= star
                        ? 'text-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'
                    } hover:text-yellow-400 transition-colors`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {formData.rating > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formData.rating} out of 5 stars
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Feedback Notes (optional)
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notes: 'Great session! Very helpful explanations.' })}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  Great session
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notes: 'Clear communication and well-structured content.' })}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  Clear communication
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notes: 'Learned a lot! Would love to continue learning.' })}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  Learned a lot
                </button>
              </div>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                placeholder="How was the session? What did you learn? Any suggestions?"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Technical DX Feedback */}
            <div className="mb-6">
              <label htmlFor="technicalDxFeedback" className="block text-sm font-medium mb-1">
                Technical DX Feedback (optional)
              </label>
              <textarea
                id="technicalDxFeedback"
                value={formData.technicalDxFeedback}
                onChange={(e) => setFormData({ ...formData, technicalDxFeedback: e.target.value })}
                rows={3}
                placeholder="Technical feedback about the platform, tools, or developer experience..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Help us improve the platform with your technical insights
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
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
                disabled={submitting || formData.rating < 1}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

