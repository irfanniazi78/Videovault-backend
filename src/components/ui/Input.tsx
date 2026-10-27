"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const stateClasses = error
    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/30 dark:border-red-900 dark:bg-zinc-900 dark:focus:border-red-500 dark:focus:ring-red-500/30 dark:bg-zinc-900"
    : "border-slate-300 bg-white focus:border-brand-500 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-brand-500";

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-200">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`h-12 w-full rounded-xl border px-4 text-base shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${stateClasses} ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
