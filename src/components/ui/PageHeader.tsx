import { cn } from "@/lib/format";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional action node rendered on the right (button, link, etc.). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page title + optional description + action row. Rendered at the
 * top of every authenticated page.
 */
export default function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
