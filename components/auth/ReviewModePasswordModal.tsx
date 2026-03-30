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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-bold">Arkiv Review Mode</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Enter password to request review mode grant. This will issue a grant entity on Arkiv
          signed by the app.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mb-4 w-full rounded-lg border px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isActivating ? 'Activating...' : 'Activate'}
          </button>
          <button
            onClick={onCancel}
            disabled={isActivating}
            className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
