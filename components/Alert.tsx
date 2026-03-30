/**
 * Alert component for success/error/warning messages
 *
 * Consistent alert display across the app.
 */

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export function Alert({ type, title, message, onClose, className = '' }: AlertProps) {
  const styles = {
    success: {
      container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-200',
      title: 'text-green-900 dark:text-green-100',
      icon: '✓',
    },
    error: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      title: 'text-red-900 dark:text-red-100',
      icon: '✕',
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      title: 'text-yellow-900 dark:text-yellow-100',
      icon: '⚠',
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-200',
      title: 'text-blue-900 dark:text-blue-100',
      icon: 'ℹ',
    },
  };

  const style = styles[type];

  return (
    <div className={`rounded-lg border p-4 ${style.container} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 text-lg ${style.text}`}>{style.icon}</div>
        <div className="min-w-0 flex-1">
          {title && <h4 className={`mb-1 text-sm font-semibold ${style.title}`}>{title}</h4>}
          <p className={`text-sm ${style.text}`}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`flex-shrink-0 text-lg ${style.text} transition-opacity hover:opacity-70`}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
