export interface OfficialOption {
  label: string;
  url: string;
}

export interface VideoFormat {
  id: string;
  container: "mp4" | "webm" | "mov" | "ogv" | "avi" | "mkv" | "mpeg";
  quality: string;
  label: string;
  fileSizeBytes?: number;
}

export type VideoStatus = "ready" | "error";

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  description?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  formats: VideoFormat[];
  status: VideoStatus;
  error?: string;
  officialOptions?: OfficialOption[];
  providerNotes?: string;
}

export type DownloadJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface DownloadJob {
  id: string;
  videoId: string;
  url: string;
  formatId: string;
  status: DownloadJobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title?: string;
  formatLabel?: string;
  status: "completed" | "failed" | "cancelled";
  createdAt: string;
  finishedAt?: string;
}
