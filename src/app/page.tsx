"use client";

import { useCallback, useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { HistoryList } from "@/components/HistoryList";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UrlInput } from "@/components/UrlInput";
import { VideoInfoCard } from "@/components/VideoInfoCard";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { useDownloadJob } from "@/hooks/useDownloadJob";
import { api } from "@/lib/api/client";
import { validateUrlInput } from "@/lib/validators/url";
import type { HistoryEntry, VideoMetadata } from "@/lib/types/video";

const PREFERRED_QUALITY_KEY = "videovault-preferred-quality";
const REDUCED_MOTION_KEY = "videovault-reduced-motion";

export default function Home() {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisDetails, setAnalysisDetails] = useState<{
    platform?: string;
    officialOptions: { label: string; url: string }[];
    providerNotes?: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [preferredQuality, setPreferredQuality] = useState("auto");
  const [reducedMotion, setReducedMotion] = useState(false);

  const { job, isCreating, createError, startDownload, cancelDownload, clearJob } = useDownloadJob();

  useEffect(() => {
    try {
      const storedQuality = window.localStorage.getItem(PREFERRED_QUALITY_KEY);
      if (storedQuality) setPreferredQuality(storedQuality);
      if (window.localStorage.getItem(REDUCED_MOTION_KEY) === "true") setReducedMotion(true);
    } catch {
      // Storage unavailable — defaults apply.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .listHistory()
      .then(({ entries }) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("reduced-motion", reducedMotion);
  }, [reducedMotion]);

  const handlePreferredQualityChange = useCallback((quality: string) => {
    setPreferredQuality(quality);
    try {
      window.localStorage.setItem(PREFERRED_QUALITY_KEY, quality);
    } catch {
      // Storage unavailable — preference applies for this session only.
    }
  }, []);

  const handleReducedMotionChange = useCallback((value: boolean) => {
    setReducedMotion(value);
    try {
      window.localStorage.setItem(REDUCED_MOTION_KEY, String(value));
    } catch {
      // Storage unavailable — preference applies for this session only.
    }
  }, []);

  const handleAnalyze = useCallback(
    async (value: string) => {
      const result = validateUrlInput(value);
      if (!result.valid) {
        setValidationError(result.error);
        setAnalysisError(null);
        setMetadata(null);
        return;
      }

      setValidationError(null);
      setAnalysisError(null);
      setAnalysisDetails(null);
      setIsAnalyzing(true);
      try {
        const { video } = await api.analyzeVideo(result.normalized);
        setMetadata(video);
        clearJob();
      } catch (error) {
        setMetadata(null);
        if (error instanceof Error) {
          setAnalysisError(error.message);
        } else {
          setAnalysisError("Failed to analyze the video.");
        }
        const details = (error as { details?: Record<string, unknown> | null })?.details;
        if (details && (Array.isArray(details.officialOptions) || details.providerNotes)) {
          setAnalysisDetails({
            platform: typeof details.platform === "string" ? details.platform : undefined,
            officialOptions: Array.isArray(details.officialOptions)
              ? (details.officialOptions as { label: string; url: string }[])
              : [],
            providerNotes: typeof details.providerNotes === "string" ? details.providerNotes : undefined,
          });
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [clearJob],
  );

  const handleDownload = useCallback(
    (formatId: string) => {
      if (!metadata) return;
      void startDownload(metadata.id, metadata.url, formatId);
    },
    [metadata, startDownload],
  );

  const handleClearHistory = useCallback(async () => {
    try {
      await api.clearHistory();
    } catch {
      // Ignore persistence failures; still clear local UI state.
    }
    setHistory([]);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-10 sm:pt-14">
        <section className="animate-fade-up text-center">
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300">
            Fast · Clean · Legitimate
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-zinc-50">
            Download videos, beautifully.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-600 dark:text-zinc-400">
            Paste a video link to inspect available formats and download in the quality you need.
          </p>
        </section>

        <section className="animate-fade-up mt-8" style={{ animationDelay: "80ms" }}>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <UrlInput
              value={url}
              onChange={(value) => {
                setUrl(value);
                if (validationError) setValidationError(null);
              }}
              onSubmit={handleAnalyze}
              isLoading={isAnalyzing}
              error={validationError}
            />
          </div>
        </section>

        {analysisError ? (
          <div className="animate-fade-up mt-5">
            <Alert variant="error" title="Analysis failed" message={analysisError} />
          </div>
        ) : null}

        {analysisDetails && (analysisDetails.officialOptions.length > 0 || analysisDetails.providerNotes) ? (
          <div className="animate-fade-up mt-5">
            <Card className="p-5 sm:p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-50">
                {analysisDetails.platform
                  ? `${analysisDetails.platform} — official options`
                  : "Official options"}
              </h3>
              {analysisDetails.providerNotes ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">{analysisDetails.providerNotes}</p>
              ) : null}
              {analysisDetails.officialOptions.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {analysisDetails.officialOptions.map((option) => (
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
              ) : null}
            </Card>
          </div>
        ) : null}

        {metadata ? (
          <section className="animate-fade-up mt-6" style={{ animationDelay: "120ms" }}>
            <VideoInfoCard
              metadata={metadata}
              job={job}
              isCreating={isCreating}
              createError={createError}
              onDownload={handleDownload}
              onCancel={cancelDownload}
              preferredQuality={preferredQuality === "auto" ? undefined : preferredQuality}
            />
          </section>
        ) : null}

        <section className="mt-8">
          <HistoryList entries={history} isLoading={historyLoading} onClear={handleClearHistory} />
        </section>

        <section className="mt-8">
          <SettingsPanel
            preferredQuality={preferredQuality}
            onPreferredQualityChange={handlePreferredQualityChange}
            reducedMotion={reducedMotion}
            onReducedMotionChange={handleReducedMotionChange}
          />
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 dark:border-zinc-800">
        <p className="text-center text-xs text-slate-500 dark:text-zinc-500">
          VideoVault only supports downloads the user is permitted to make. Redistribution or
          circumvention of access controls is not permitted.
        </p>
      </footer>
    </div>
  );
}
