"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

export type AlertVariant = "error" | "success" | "info";

export interface AlertProps {
  variant: AlertVariant;
  title?: string;
  message?: string;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  info: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-100",
};

const icons: Record<AlertVariant, ReactNode> = {
  error: <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />,
  success: <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />,
  info: <Info className="h-5 w-5 shrink-0" aria-hidden="true" />,
};

export function Alert({
  variant = "info",
  title,
  message,
  onClose,
  children,
  className = "",
}: AlertProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border p-4 ${variantStyles[variant]} ${className}`}
    >
      <span className="mt-0.5 shrink-0">{icons[variant]}</span>
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-sm font-semibold">{title}</p>
        ) : null}
        {message ? (
          <p className="mt-0.5 text-sm">{message}</p>
        ) : null}
        {children}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="rounded-lg p-1 text-current opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
