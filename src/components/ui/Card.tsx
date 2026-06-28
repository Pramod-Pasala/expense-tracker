import { cn } from "@/lib/format";

interface CardProps {
  title?: React.ReactNode;
  /** Optional content rendered flush-right in the card header (actions, links). */
  action?: React.ReactNode;
  className?: string;
  /** Override the padding on the body. Defaults to a comfortable `p-4 sm:p-5`. */
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * A rounded white card with optional title + action header. The fintech building
 * block — used for every dashboard section.
 */
export default function Card({
  title,
  action,
  className,
  bodyClassName,
  children,
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-gray-200 bg-white shadow-sm",
        className
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          {title ? (
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Composable Card sub-parts                                                 */
/*  Some pages (reports) compose cards from Card + CardHeader/CardTitle/      */
/*  CardContent instead of using the title/action props. These are lightweight */
/*  presentational wrappers that match that API.                              */
/* -------------------------------------------------------------------------- */

/** Top region of a composed card. */
export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Title text inside a CardHeader. */
export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <h2 className={cn("text-sm font-semibold text-gray-900", className)}>
      {children}
    </h2>
  );
}

/** Main padded body region of a composed card. */
export function CardContent({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}
