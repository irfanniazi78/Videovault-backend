"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import { formatBytes, formatDuration } from "@/lib/formatters";
import { formatLabel, qualityRank, sortFormats } from "@/lib/formats";
import type { DownloadJob, VideoFormat, VideoMetadata } from "@/lib/types/video";

export interface VideoInfoCardProps {
  metadata: VideoMetadata;
  job: DownloadJob | null;
  isCreating: boolean;
  createError: string | null;
  onDownload: (formatId: string) => void;
  onCancel: () => void;
  preferredQuality?: string;
}

interface QualityGroup {
  quality: string;
  containers: VideoFormat[];
}

function groupByQuality(formats: VideoFormat[]): QualityGroup[] {
  const groups = new Map<string, VideoFormat[]>();
  for (const format of formats) {
    const existing = groups.get(format.quality) ?? [];
    existing.push(format);
    groups.set(format.quality, existing);
  }
  return Array.from(groups.entries())
    .map(([quality, containers]) => ({
      quality,
      containers: containers.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality)),
    }))
    .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
}

const ACTIVE_STATUSES: DownloadJob["status"][] = ["queued", "processing"];

export function VideoInfoCard({
  metadata,
  job,
  isCreating,
  createError,
  onDownload,
  onCancel,
  preferredQuality,
}: VideoInfoCardProps) {
  const groups = useMemo(() => groupByQuality(sortFormats(metadata.formats)), [metadata.formats]);
  const defaultGroup = useMemo(() => {
    if (preferredQuality) {
      const match = groups.find((group) => group.quality === preferredQuality);
      if (match) return match;
    }
    return groups[0];
  }, [groups, preferredQuality]);

  const [selectedQuality, setSelectedQuality] = useState<string>(defaultGroup?.quality ?? "");
  const [selectedFormatId, setSelectedFormatId] = useState<string>(
    defaultGroup?.containers[0]?.id ?? "",
  );

  useEffect(() => {
    if (!defaultGroup) return;
    setSelectedQuality(defaultGroup.quality);
    setSelectedFormatId(defaultGroup.containers[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata.id, preferredQuality]);

  const selectedFormat =
    groups.flatMap((group) => group.containers).find((format) => format.id === selectedFormatId) ??
    groups.flatMap((group) => group.containers)[0];

  const selectedGroup = groups.find((group) => group.quality === selectedQuality);

  const isActiveJob = job != null && ACTIVE_STATUSES.includes(job.status);
  const busy = isCreating || isActiveJob;
  const progress = isActiveJob && job ? job.progress : 0;

  const handleDownload = () => {
    if (selectedFormat) onDownload(selectedFormat.id);
  };

  const buttonLabel = busy
    ? isCreating
      ? "Preparing…"
      : `Downloading… ${Math.round(progress)}%`
    : job?.status === "failed"
      ? "Retry download"
      : job?.status === "completed"
        ? "Download again"
        : selectedFormat
          ? `Download · ${formatLabel(selectedFormat)}`
          : "Download";

  if (metadata.status === "error") {
    return (
      <Card className="p-6">
        <Alert variant="error" title="Analysis incomplete" message={metadata.error ?? "This video could not be analyzed."} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
        {metadata.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={metadata.thumbnailUrl}
            alt=""
            className="h-40 w-full shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-zinc-800 sm:h-auto sm:w-44"
          />
        ) : (
          <div className="flex h-40 w-full shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 sm:h-auto sm:w-44">
            <span className="text-4xl" aria-hidden="true">🎬</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">{metadata.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{formatDuration(metadata.durationSeconds)}</Badge>
            {metadata.formats.length > 0 ? (
              <Badge tone="default">
                {metadata.formats.length} format{metadata.formats.length > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-5 sm:p-6 dark:border-zinc-800">
        {groups.length > 0 ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">Quality</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Select quality">
                {groups.map((group) => (
                  <button
                    key={group.quality}
                    type="button"
                    onClick={() => {
                      setSelectedQuality(group.quality);
                      const first = group.containers[0];
                      if (first) setSelectedFormatId(first.id);
                    }}
                    aria-pressed={selectedQuality === group.quality}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selectedQuality === group.quality
                        ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {group.quality}
                  </button>
                ))}
              </div>
            </div>

            {selectedGroup ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">Format</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {selectedGroup.containers.map((format) => {
                    const isSelected = selectedFormatId === format.id;
                    return (
                      <button
                        key={format.id}
                        type="button"
                        onClick={() => setSelectedFormatId(format.id)}
                        aria-pressed={isSelected}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                          isSelected
                            ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        }`}
                      >
                        <span>{format.container.toUpperCase()}</span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                          {format.quality}
                          {format.fileSizeBytes != null ? ` · ${formatBytes(format.fileSizeBytes)}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <Alert variant="info" message="No downloadable formats were found for this video." />
        )}
      </div>

      <div className="border-t border-slate-200 p-5 sm:p-6 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleDownload} loading={busy} disabled={!selectedFormat || busy}>
            {busy ? (
              <>
                <Spinner size={16} /> {buttonLabel}
              </>
            ) : (
              buttonLabel
            )}
          </Button>
          {isActiveJob ? (
            <Button variant="secondary" onClick={onCancel} disabled={isCreating}>
              Cancel
            </Button>
          ) : null}
        </div>

        {isActiveJob && job ? (
          <div className="mt-4">
            <ProgressBar value={progress} />
            <div className="mt-2 flex items-center justify-between text-sm text-slate-500 dark:text-zinc-400">
              <span>{Math.round(progress)}%</span>
              <span>{job.status}</span>
            </div>
          </div>
        ) : null}

        {createError ? (
          <div className="mt-4">
            <Alert variant="error" message={createError} />
          </div>
        ) : null}

        {job?.status === "failed" ? (
          <div className="mt-4">
            <Alert variant="error" message={job.error ?? "The download failed. Please try again."} />
          </div>
        ) : null}

        {metadata.officialOptions && metadata.officialOptions.length > 0 ? (
          <div className="mt-4 space-y-2">
            {metadata.providerNotes ? (
              <Alert variant="info" message={metadata.providerNotes} />
            ) : null}
            <ul className="space-y-1">
              {metadata.officialOptions.map((option) => (
                <li key={option.url}>
                  <a
                    href={option.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {option.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {job?.status === "completed" ? (
          <div className="mt-4 space-y-3">
            <Alert variant="success" message="Download completed successfully." />
            <a
              href={`/api/jobs/${job.id}/file`}
              download
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
            >
              <Download size={16} aria-hidden="true" />
              Save file
            </a>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
