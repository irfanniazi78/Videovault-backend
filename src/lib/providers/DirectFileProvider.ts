import type { DownloadJob, VideoFormat, VideoMetadata } from "@/lib/types/video";

import { formatLabel } from "@/lib/formats";
import type { CreateDownloadJobInput, ResolvedVideoFormat, VideoAnalysis, VideoProvider } from "./VideoProvider";

const REQUEST_TIMEOUT_MS = 15_000;
const VIDEO_EXTENSIONS: Record<string, VideoFormat["container"]> = {
  mp4: "mp4",
  m4v: "mp4",
  webm: "webm",
  mov: "mov",
  ogv: "ogv",
  ogg: "ogv",
  mkv: "mkv",
  avi: "avi",
  mpg: "mpeg",
  mpeg: "mpeg",
};

function extensionOf(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return (pathname.split(".").pop() ?? "").toLowerCase();
  } catch {
    return "";
  }
}

export function isDirectVideoUrl(rawUrl: string): boolean {
  const ext = extensionOf(rawUrl);
  return ext in VIDEO_EXTENSIONS;
}

export class DirectFileProvider implements VideoProvider {
  readonly id = "direct-file";
  readonly name = "Direct video file";

  supports(url: string): boolean {
    return isDirectVideoUrl(url);
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const ext = extensionOf(url);
    const container = VIDEO_EXTENSIONS[ext];
    if (!container) throw new Error("Unsupported source.");

    let sizeBytes: number | undefined;

    // Try HEAD first; fall back to a ranged GET if HEAD is unsupported.
    try {
      const head = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
        cache: "no-store",
      });
      if (head.ok) {
        const len = Number.parseInt(head.headers.get("content-length") ?? "", 10);
        if (Number.isFinite(len) && len > 0) sizeBytes = len;
      }
    } catch {
      // Ignore; proceed with defaults.
    }

    let fileName = "video";
    try {
      const pathname = new URL(url).pathname;
      const last = pathname.split("/").filter(Boolean).pop();
      if (last) fileName = decodeURIComponent(last);
    } catch {
      // keep default
    }

    const base: VideoFormat = {
      id: `${container}-original`,
      container,
      quality: "Original",
      label: "",
      ...(sizeBytes != null ? { fileSizeBytes: sizeBytes } : {}),
    };

    const format: ResolvedVideoFormat = {
      ...base,
      label: formatLabel(base),
      sourceUrl: url,
      fileName,
    };

    const video: VideoMetadata = {
      id: url,
      url,
      title: fileName,
      description: "Direct video file. Ensure you have permission to download this content.",
      formats: [{ id: format.id, container: format.container, quality: format.quality, label: format.label, ...(format.fileSizeBytes != null ? { fileSizeBytes: format.fileSizeBytes } : {}) }],
      status: "ready",
      officialOptions: [{ label: "Open original URL", url }],
      providerNotes: "Direct file download. Only use with content you are permitted to download.",
    };

    return { video, formats: { [format.id]: format } };
  }

  createDownloadJob(input: CreateDownloadJobInput): DownloadJob {
    const timestamp = new Date().toISOString();
    return {
      id: `job-${crypto.randomUUID()}`,
      videoId: input.videoId,
      url: input.url,
      formatId: input.format.id,
      status: "queued",
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
