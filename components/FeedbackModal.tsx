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
  const [step, setStep] = useState<'rating' | 'notes' | 'technical'>('rating');
  const [formData, setFormData] = useState({
    rating: 0,
    notes: '',
    technicalDxFeedback: '',
  });

  const isMentor = userWallet.toLowerCase() === session.mentorWallet.toLowerCase();
  const feedbackTo = isMentor ? session.learnerWallet : session.mentorWallet;

  const handleRatingSubmit = () => {
    if (formData.rating < 1 || formData.rating > 5) {
      setError('Please provide a rating between 1 and 5');
      return;
    }
    // Always continue to notes step - description is required
    setStep('notes');
  };

  const handleNotesNext = () => {
    if (formData.technicalDxFeedback.trim()) {
      setStep('technical');
    } else {
      // Skip technical if empty, submit now
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setError('');

    if (formData.rating < 1 || formData.rating > 5) {
      setError('Please provide a rating between 1 and 5');
      return;
    }

    // Require notes (description) - reuse app feedback pattern
    if (!formData.notes.trim()) {
      setError('Please provide feedback description');
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
          notes: formData.notes.trim(), // Required - validated in handleFinalSubmit
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
      setStep('rating'); // Reset to first step
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
      setStep('rating');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="mb-4 text-2xl font-semibold">Session Feedback</h2>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
            Share your experience with this mentorship session
          </p>

          {/* Progress Indicator */}
          <div className="mb-6 flex items-center gap-2">
            <div
              className={`h-1 flex-1 rounded ${step === 'rating' ? 'bg-blue-600' : 'bg-blue-300 dark:bg-blue-700'}`}
            />
            <div
              className={`h-1 flex-1 rounded ${step === 'notes' ? 'bg-blue-600' : step === 'technical' ? 'bg-blue-300 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700'}`}
            />
            <div
              className={`h-1 flex-1 rounded ${step === 'technical' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            />
          </div>

          {/* Step 1: Rating (Required) */}
          {step === 'rating' && (
            <div>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium">Rating * (1-5 stars)</label>
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
                      } transition-colors hover:text-yellow-400`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {formData.rating > 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formData.rating} out of 5 stars
                  </p>
                )}
              </div>

              {error && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
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
                <button
                  type="button"
                  onClick={handleRatingSubmit}
                  disabled={submitting || formData.rating < 1}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Notes (Required) */}
          {step === 'notes' && (
            <div>
              <div className="mb-6">
                <label htmlFor="notes" className="mb-1 block text-sm font-medium">
                  Feedback Description *
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notes: 'Great session! Very helpful explanations.',
                      })
                    }
                    className="rounded bg-gray-100 px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    Great session
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notes: 'Clear communication and well-structured content.',
                      })
                    }
                    className="rounded bg-gray-100 px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    Clear communication
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notes: 'Learned a lot! Would love to continue learning.',
                      })
                    }
                    className="rounded bg-gray-100 px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    Learned a lot
                  </button>
                </div>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="How was the session? What did you learn? Any suggestions? (e.g., 'Great explanation of ownership concepts!')"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              {error && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep('rating')}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNotesNext}
                  disabled={submitting || !formData.notes.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {formData.technicalDxFeedback.trim() ? 'Continue' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Technical DX Feedback (Optional, Advanced) */}
          {step === 'technical' && (
            <div>
              <div className="mb-6">
                <label htmlFor="technicalDxFeedback" className="mb-1 block text-sm font-medium">
                  Technical DX Feedback (optional, advanced)
                </label>
                <textarea
                  id="technicalDxFeedback"
                  value={formData.technicalDxFeedback}
                  onChange={(e) =>
                    setFormData({ ...formData, technicalDxFeedback: e.target.value })
                  }
                  rows={3}
                  placeholder="Technical feedback about the platform, tools, or developer experience..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Help us improve the platform with your technical insights
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep('notes')}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
