/**
 * Beta banner component
 * 
 * Consistent beta environment warning across the app.
 */

export function BetaBanner({ className = '' }: { className?: string }) {
  return (
    <div className={`mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg ${className}`}>
      <div className="flex items-start gap-2">
        <span className="text-yellow-600 dark:text-yellow-400 text-lg flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
            Beta Environment
          </p>
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            This is a test environment on the Mendoza testnet. All data is observable and may be reset. Never use wallets with real funds.
          </p>
        </div>
      </div>
    </div>
  );
}


