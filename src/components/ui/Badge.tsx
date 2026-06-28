import { cn } from "@/lib/format";

interface BadgeProps {
  children: React.ReactNode;
  /** Hex color used for the text + a translucent background tint. */
  color?: string | null;
  className?: string;
}

/**
 * A small pill badge for categories/tags. If a `color` is supplied (hex), the
 * text uses that color and the background is a 12% tint of it; otherwise a
 * neutral gray is used.
 */
export default function Badge({ children, color, className }: BadgeProps) {
  const style = color
    ? {
        color,
        backgroundColor: hexWithAlpha(color, 0.12),
      }
    : undefined;

  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        !color && "bg-gray-100 text-gray-600",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Convert a #rrggbb hex to an rgba() string with the given alpha. */
function hexWithAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return hex; // give up gracefully
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
