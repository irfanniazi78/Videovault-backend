import type { DownloadJob, VideoFormat, VideoMetadata } from "@/lib/types/video";

/**
 * A format that has been resolved to a real, directly downloadable file.
 * This is server-only information: it is never sent to the browser.
 */
export interface ResolvedVideoFormat extends VideoFormat {
  /** Absolute URL of the upstream media file. */
  sourceUrl: string;
  /** Suggested file name (already reduced to a single path segment). */
  fileName: string;
}

/**
 * Result of analyzing a video URL.
 *
 * `video` is safe to return to the browser. `formats` maps a public format id
 * to its upstream source and must stay on the server, so clients cannot point
 * the downloader at arbitrary URLs.
 */
export interface VideoAnalysis {
  video: VideoMetadata;
  formats: Record<string, ResolvedVideoFormat>;
}

export interface CreateDownloadJobInput {
  videoId: string;
  url: string;
  format: ResolvedVideoFormat;
}

export interface VideoProvider {
  /** Short stable id, e.g. "internet-archive". */
  readonly id: string;
  /** Human readable name shown in diagnostics. */
  readonly name: string;
  /** Returns true when this provider can handle the given absolute URL. */
  supports(url: string): boolean;
  /** Resolves real metadata and downloadable sources for a video URL. */
  analyzeVideo(url: string): Promise<VideoAnalysis>;
  /** Builds an (unstarted) download job for a resolved format. */
  createDownloadJob(input: CreateDownloadJobInput): DownloadJob;
}
