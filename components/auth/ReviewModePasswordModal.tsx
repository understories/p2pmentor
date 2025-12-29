'use client';

/**
 * Review Mode Password Modal
 * 
 * Password prompt for activating Arkiv review mode.
 * Used after wallet connection to verify reviewer access.
 */

interface ReviewModePasswordModalProps {
  password: string;
  setPassword: (password: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isActivating?: boolean;
}

export function ReviewModePasswordModal({
  password,
  setPassword,
  onConfirm,
  onCancel,
  isActivating = false,
}: ReviewModePasswordModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Arkiv Review Mode</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter password to request review mode grant. This will mint a grant entity on Arkiv signed by the app.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-2 border rounded-lg mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          autoFocus
          disabled={isActivating}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isActivating) {
              onConfirm();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isActivating}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActivating ? 'Activating...' : 'Activate'}
          </button>
          <button
            onClick={onCancel}
            disabled={isActivating}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

