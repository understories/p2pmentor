/**
 * Empty state component
 *
 * Consistent empty state display across the app.
 */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-12 text-center ${className}`}
    >
      {icon && <div className="mb-4 text-gray-400 dark:text-gray-500">{icon}</div>}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && (
        <p className="mb-4 max-w-md text-sm text-gray-600 dark:text-gray-400">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
