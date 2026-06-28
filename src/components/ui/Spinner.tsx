import { cn } from "@/lib/format";

interface SpinnerProps {
  /** Tailwind size class for the spinner element, e.g. "h-6 w-6". */
  className?: string;
  /** Optional accessible label. Defaults to "Loading". */
  label?: string;
}

/**
 * A lightweight CSS spinner. No animation library needed — uses Tailwind's
 * `animate-spin`. Inherits `currentColor` so it adapts to its container.
 */
export default function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg
        className={cn("animate-spin h-5 w-5 text-emerald-600", className)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
