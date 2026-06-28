import { cn } from "@/lib/format";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Helper or error text shown under the input. */
  hint?: string;
  /** Marks the field as invalid (red border). */
  error?: boolean;
}

/**
 * A labeled text input. Pass `label` for the visible label and `hint` for
 * helper/error text below. All native input props are forwarded.
 */
export default function Input({
  label,
  hint,
  error = false,
  className,
  id,
  ...props
}: InputProps) {
  // Stable id so the <label htmlFor> works even without an explicit id.
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-10 rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500",
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/40"
            : "border-gray-300",
          className
        )}
        {...props}
      />
      {hint && (
        <p className={cn("text-xs", error ? "text-rose-600" : "text-gray-500")}>
          {hint}
        </p>
      )}
    </div>
  );
}
