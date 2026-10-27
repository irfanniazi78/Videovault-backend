import { getApiUrl } from "./config";
import type { DownloadJob, HistoryEntry, VideoMetadata } from "../types/video";

export class ApiError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown> | null;

  constructor(message: string, status: number, details: Record<string, unknown> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  }).catch(() => {
    throw new ApiError("Couldn't reach the VideoVault server. Check your connection and the backend URL.", 0);
  });

  const data = (await response.json().catch(() => null)) as
    | { error?: string; [key: string]: unknown }
    | null;

  if (!response.ok) {
    throw new ApiError(
      (data?.error as string) ?? `Request failed with status ${response.status}`,
      response.status,
      (data as Record<string, unknown> | null) ?? null,
    );
  }

  return data as T;
}

export const api = {
  analyzeVideo: (url: string) =>
    request<{ video: VideoMetadata }>("/api/analyze", { method: "POST", body: JSON.stringify({ url }) }),

  createDownload: (videoId: string, url: string, formatId: string) =>
    request<{ job: DownloadJob }>("/api/download", {
      method: "POST",
      body: JSON.stringify({ videoId, url, formatId }),
    }),

  getJob: (id: string) => request<{ job: DownloadJob }>(`/api/jobs/${id}`),

  cancelJob: (id: string) => request<{ job: DownloadJob }>(`/api/jobs/${id}`, { method: "DELETE" }),

  getJobFileUrl: (id: string) => `${getApiUrl()}/api/jobs/${id}/file`,

  listHistory: () => request<{ entries: HistoryEntry[] }>("/api/history"),

  clearHistory: () => request<{ ok: boolean }>("/api/history", { method: "DELETE" }),
};
