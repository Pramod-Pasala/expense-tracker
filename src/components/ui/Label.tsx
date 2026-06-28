import { cn } from "@/lib/format";

/**
 * A form field label. Paired with Input / Select / TextArea.
 */
export default function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300", className)}
      {...props}
    >
      {children}
    </label>
  );
}
