import { formatCurrency, cn } from "@/lib/format";

interface AmountProps {
  amount: number;
  currency: string;
  /**
   * When true (default), positive amounts are green and negative red. Set
   * false to render in the inherited text color (useful inside tables).
   */
  colored?: boolean;
  className?: string;
}

/**
 * A currency amount rendered with `formatCurrency`. By default positive values
 * are emerald and negative values are rose — the fintech convention. Zero is
 * treated as neutral gray.
 */
export default function Amount({
  amount,
  currency,
  colored = true,
  className,
}: AmountProps) {
  const tone = !colored
    ? "text-gray-900"
    : amount > 0
      ? "text-emerald-600"
      : amount < 0
        ? "text-rose-600"
        : "text-gray-500";

  return (
    <span className={cn("tabular-nums font-medium", tone, className)}>
      {formatCurrency(amount, currency)}
    </span>
  );
}
