/**
 * App Feedback Modal
 * 
 * User-facing feedback form for app feedback (to builders/admin).
 * Separate from session feedback (peer-to-peer).
 * 
 * Reference: refs/docs/sprint2.md Section 4.1
 */

'use client';

import { useState, useEffect } from 'react';

interface AppFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWallet: string | null;
}

export function AppFeedbackModal({
  isOpen,
  onClose,
  userWallet,
}: AppFeedbackModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    message: '',
    rating: 0,
    feedbackType: 'feedback' as 'feedback' | 'issue', // 'feedback' or 'issue'
  });
  const [pathname, setPathname] = useState('/');

  useEffect(() => {
    // Get current pathname safely
    if (typeof window !== 'undefined') {
      setPathname(window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Get wallet from localStorage if not provided as prop
    let walletToUse = userWallet;
    if (!walletToUse && typeof window !== 'undefined') {
      walletToUse = localStorage.getItem('wallet_address');
    }

    if (!walletToUse) {
      setError('Please connect your wallet to submit feedback');
      return;
    }

    // Allow submission with just rating OR message (at least one required)
    if (!formData.message.trim() && formData.rating === 0) {
      setError('Please provide either a rating or feedback message');
      return;
    }

    if (formData.rating > 0 && (formData.rating < 1 || formData.rating > 5)) {
      setError('Rating must be between 1 and 5');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/app-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletToUse,
          page: pathname || '/',
          message: formData.message.trim() || undefined, // Allow empty if rating provided
          rating: formData.rating > 0 ? formData.rating : undefined,
          feedbackType: formData.feedbackType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setFormData({ message: '', rating: 0, feedbackType: 'feedback' });
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting app feedback:', err);
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
      setFormData({ message: '', rating: 0, feedbackType: 'feedback' });
      setError('');
      setSuccess(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {formData.feedbackType === 'issue' ? 'Report an Issue' : 'Share Your Feedback'}
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

        {success ? (
          <div className="text-center py-8">
            <div className="text-green-600 dark:text-green-400 text-5xl mb-4">✓</div>
            <p className="text-gray-900 dark:text-gray-100 font-medium">
              Thank you for your feedback!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Your feedback helps us improve p2pmentor.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="feedbackType"
                    value="feedback"
                    checked={formData.feedbackType === 'feedback'}
                    onChange={(e) => setFormData({ ...formData, feedbackType: e.target.value as 'feedback' | 'issue' })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Feedback</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="feedbackType"
                    value="issue"
                    checked={formData.feedbackType === 'issue'}
                    onChange={(e) => setFormData({ ...formData, feedbackType: e.target.value as 'feedback' | 'issue' })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Report Issue</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How would you rate your experience? (Optional)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating })}
                    className={`w-10 h-10 rounded-lg border-2 transition-colors ${
                      formData.rating >= rating
                        ? 'bg-yellow-400 border-yellow-500 dark:bg-yellow-500 dark:border-yellow-400'
                        : 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Feedback {formData.rating === 0 && <span className="text-red-500">*</span>}
                {formData.rating > 0 && <span className="text-gray-500 text-xs font-normal">(optional)</span>}
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder={formData.feedbackType === 'issue' 
                  ? "Describe the issue you encountered, steps to reproduce, and any error messages... (optional if you provided a rating)"
                  : "Tell us what you think about p2pmentor, what works well, what could be improved... (optional if you provided a rating)"}
              />
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (!formData.message.trim() && formData.rating === 0)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : formData.feedbackType === 'issue' ? 'Report Issue' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

