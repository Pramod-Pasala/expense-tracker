import { cn } from "@/lib/format";

interface EmptyStateProps {
  /** Emoji or small inline icon node shown in a circle. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Call-to-action, usually a link or button. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * A centered empty state with an icon, message, and optional CTA. Used when a
 * list/section has no data yet (e.g. no accounts created).
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-gray-500">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
