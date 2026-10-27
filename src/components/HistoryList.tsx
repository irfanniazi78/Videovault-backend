"use client";

import { DownloadCloud, Trash2 } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { HistoryEntry } from "@/lib/types/video";

export interface HistoryListProps {
  entries: HistoryEntry[];
  isLoading: boolean;
  onClear: () => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function HistoryList({ entries, isLoading, onClear }: HistoryListProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  const statusTone = (status: HistoryEntry["status"]): BadgeTone =>
    status === "completed" ? "success" : status === "failed" ? "danger" : "default";

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50">
          Download history
        </h2>
        {entries.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingClear(true)}
            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear history
          </Button>
        ) : null}
      </div>

      {confirmingClear ? (
        <div className="mt-4">
          <Alert variant="info">
            Clear all download history entries? This cannot be undone.
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onClear();
                  setConfirmingClear(false);
                }}
              >
                Yes, clear history
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirmingClear(false)}>
                Keep history
              </Button>
            </div>
          </Alert>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 dark:bg-zinc-800">
            <DownloadCloud className="h-6 w-6 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
          </span>
          <p className="text-sm text-slate-500 dark:text-zinc-400">No downloads yet. Your history will appear here.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-zinc-800">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {entry.title ?? "Untitled video"}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{entry.url}</p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                  {formatDate(entry.createdAt)}
                  {entry.formatLabel ? ` · ${entry.formatLabel}` : ""}
                </p>
              </div>
              <Badge tone={statusTone(entry.status)}>{entry.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
