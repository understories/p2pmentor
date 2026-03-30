/**
 * Loading spinner component
 *
 * Consistent loading indicator across the app.
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400`}
      />
      {text && <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>}
    </div>
  );
}
