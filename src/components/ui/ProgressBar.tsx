interface ProgressBarProps {
  value?: number;
  indeterminate?: boolean;
  className?: string;
}

export function ProgressBar({ value, indeterminate = false, className = "" }: ProgressBarProps) {
  if (indeterminate) {
    return (
      <div
        className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800 ${className}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={undefined}
        aria-busy="true"
      >
        <div className="h-full w-1/3 animate-shimmer rounded-full bg-brand-500" />
      </div>
    );
  }

  const clamped = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div
        className="h-full rounded-full bg-brand-600 transition-all duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
