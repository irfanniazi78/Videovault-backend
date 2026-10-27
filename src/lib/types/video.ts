/** A single downloadable rendition of a video, e.g. MP4 at 720p. */
export interface VideoFormat {
  /** Stable format identifier, e.g. "mp4-720p". */
  id: string;
  /** Container/codec family, e.g. "mp4" or "webm". */
  container: "mp4" | "webm" | "mov" | "ogv" | "avi" | "mkv" | "mpeg";
  /** Human readable quality label, e.g. "720p". */
  quality: string;
  /** Short human readable label, e.g. "HD · MP4". */
  label: string;
  /** Approximate file size in bytes, when known. */
  fileSizeBytes?: number;
}

export type VideoStatus = "ready" | "error";

export interface OfficialOption {
  /** Short label shown as a link, e.g. "Watch on YouTube". */
  label: string;
  /** Absolute URL of the official page or tool. */
  url: string;
}

export interface VideoMetadata {
  /** Provider-assigned identifier for the video. */
  id: string;
  /** Normalized absolute URL of the video. */
  url: string;
  title: string;
  description?: string;
  /** Duration in seconds, when known. */
  durationSeconds?: number;
  /** Remote thumbnail URL, when available. */
  thumbnailUrl?: string;
  formats: VideoFormat[];
  status: VideoStatus;
  error?: string;
  /** Official viewing/download options offered by the source platform. */
  officialOptions?: OfficialOption[];
  /** Human readable note about what this provider can and cannot do. */
  providerNotes?: string;
}

export type DownloadJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadJob {
  id: string;
  videoId: string;
  url: string;
  formatId: string;
  status: DownloadJobStatus;
  /** 0-100 download progress. */
  progress: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  /** Stored file name, set when the download completes. */
  fileName?: string;
  /** MIME type of the stored file. */
  contentType?: string;
  /** Size of the stored file in bytes. */
  sizeBytes?: number;
}

export type HistoryStatus = "completed" | "failed" | "cancelled";

export interface HistoryEntry {
  id: string;
  url: string;
  title?: string;
  formatLabel?: string;
  status: HistoryStatus;
  createdAt: string;
  finishedAt?: string;
}
