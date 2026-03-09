/**
 * Beta banner component
 *
 * Consistent beta environment warning across the app.
 */

export function BetaBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20 ${className}`}
    >
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 text-lg text-yellow-600 dark:text-yellow-400">⚠️</span>
        <div className="flex-1">
          <p className="mb-1 text-sm font-semibold text-yellow-900 dark:text-yellow-200">
            Beta Environment
          </p>
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            This is a test environment on the Kaolin testnet. All data is observable and may be
            reset. Never use wallets with real funds.
          </p>
        </div>
      </div>
    </div>
  );
}
