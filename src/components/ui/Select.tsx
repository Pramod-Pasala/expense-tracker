import { cn } from "@/lib/format";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: boolean;
}

/**
 * A labeled select dropdown. Children should be <option> elements.
 */
export default function Select({
  label,
  hint,
  error = false,
  className,
  id,
  children,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "h-10 rounded-lg border bg-white px-3 text-sm text-gray-900",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500",
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/40"
            : "border-gray-300",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {hint && (
        <p className={cn("text-xs", error ? "text-rose-600" : "text-gray-500")}>
          {hint}
        </p>
      )}
    </div>
  );
}
