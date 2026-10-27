import type { HTMLAttributes } from "react";

export type BadgeTone = "default" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "default", className = "", ...props }: BadgeProps) {
  const toneClasses: Record<BadgeTone, string> = {
    default: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    danger: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
