"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api/client";
import type { DownloadJob } from "@/lib/types/video";

const POLL_INTERVAL_MS = 2000;

export interface UseDownloadJobResult {
  job: DownloadJob | null;
  isCreating: boolean;
  createError: string | null;
  startDownload: (videoId: string, url: string, formatId: string) => Promise<boolean>;
  cancelDownload: () => Promise<void>;
  retryDownload: (videoId: string, url: string, formatId: string) => Promise<void>;
  clearJob: () => void;
}

export function useDownloadJob(): UseDownloadJobResult {
  const [job, setJob] = useState<DownloadJob | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const terminal =
      job?.status === "completed" || job?.status === "failed" || job?.status === "cancelled";
    if (!job || terminal) {
      clearTimer();
      return;
    }

    timerRef.current = setInterval(async () => {
      try {
        const { job: updated } = await api.getDownloadJob(job.id);
        setJob(updated);
      } catch {
        // Transient polling errors are ignored; the next tick retries.
      }
    }, POLL_INTERVAL_MS);

    return clearTimer;
  }, [job, clearTimer]);

  const startDownload = useCallback(
    async (videoId: string, url: string, formatId: string) => {
      setIsCreating(true);
      setCreateError(null);
      try {
        const { job: created } = await api.createDownload({ videoId, url, formatId });
        setJob(created);
        return true;
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Failed to start the download.");
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  const cancelDownload = useCallback(async () => {
    if (!job) return;
    try {
      const { job: cancelled } = await api.cancelDownloadJob(job.id);
      setJob(cancelled);
    } catch {
      // Ignore cancel failures; user can retry from the UI.
    }
  }, [job]);

  const retryDownload = useCallback(
    async (videoId: string, url: string, formatId: string) => {
      await startDownload(videoId, url, formatId);
    },
    [startDownload],
  );

  const clearJob = useCallback(() => {
    clearTimer();
    setJob(null);
    setCreateError(null);
  }, [clearTimer]);

  return { job, isCreating, createError, startDownload, cancelDownload, retryDownload, clearJob };
}
