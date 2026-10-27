import type { DownloadJob, HistoryEntry, VideoMetadata } from "@/lib/types/video";

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
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(
      "Couldn't reach the VideoVault server. Check your connection and try again.",
      0,
    );
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: string; [key: string]: unknown }
    | null;

  if (!response.ok) {
    throw new ApiError(data?.error ?? `Request failed with status ${response.status}`, response.status, (data as Record<string, unknown> | null) ?? null);
  }

  return data as T;
}

export const api = {
  analyzeVideo: (url: string) =>
    request<{ video: VideoMetadata }>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  createDownload: (payload: {
    videoId: string;
    url: string;
    formatId: string;
  }) =>
    request<{ job: DownloadJob }>("/api/download", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getDownloadJob: (id: string) =>
    request<{ job: DownloadJob }>(`/api/jobs/${id}`),

  cancelDownloadJob: (id: string) =>
    request<{ job: DownloadJob }>(`/api/jobs/${id}`, { method: "DELETE" }),

  listHistory: () =>
    request<{ entries: HistoryEntry[] }>("/api/history"),

  clearHistory: () =>
    request<{ ok: boolean }>("/api/history", { method: "DELETE" }),
};
