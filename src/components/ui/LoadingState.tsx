import Spinner from "./Spinner";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/**
 * Centered loading indicator with a label. Used while fetching page data.
 */
export default function LoadingState({
  label = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center gap-3 py-20 text-zinc-500 dark:text-zinc-400 " +
        (className ?? "")
      }
    >
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}
