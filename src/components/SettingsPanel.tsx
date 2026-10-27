"use client";

import { Card } from "@/components/ui/Card";

export interface SettingsPanelProps {
  preferredQuality: string;
  onPreferredQualityChange: (quality: string) => void;
  reducedMotion: boolean;
  onReducedMotionChange: (value: boolean) => void;
}

const QUALITY_OPTIONS = [
  { value: "auto", label: "Automatic (best available)" },
  { value: "2160p", label: "4K (2160p)" },
  { value: "1440p", label: "1440p (QHD)" },
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "720p", label: "720p (HD)" },
  { value: "480p", label: "480p (SD)" },
  { value: "360p", label: "360p" },
];

export function SettingsPanel({
  preferredQuality,
  onPreferredQualityChange,
  reducedMotion,
  onReducedMotionChange,
}: SettingsPanelProps) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50">Settings</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        Preferences are stored locally in your browser.
      </p>

      <div className="mt-6 space-y-6">
        <div>
          <label
            htmlFor="preferred-quality"
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300"
          >
            Preferred quality
          </label>
          <select
            id="preferred-quality"
            value={preferredQuality}
            onChange={(event) => onPreferredQualityChange(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <label
              htmlFor="reduced-motion"
              className="block text-sm font-semibold text-slate-700 dark:text-zinc-300"
            >
              Reduce motion
            </label>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
              Minimize animations throughout the interface.
            </p>
          </div>
          <button
            type="button"
            id="reduced-motion"
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => onReducedMotionChange(!reducedMotion)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900 ${
              reducedMotion ? "bg-brand-600" : "bg-slate-300 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                reducedMotion ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </Card>
  );
}
