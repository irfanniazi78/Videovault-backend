import { randomUUID } from "node:crypto";

import { formatLabel } from "@/lib/formats";
import type { DownloadJob, VideoFormat, VideoMetadata } from "@/lib/types/video";

import type {
  CreateDownloadJobInput,
  ResolvedVideoFormat,
  VideoAnalysis,
  VideoProvider,
} from "./VideoProvider";

const API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = "VideoVault/0.1 (+https://github.com/videovault)";

const MIME_TO_CONTAINER: Record<string, VideoFormat["container"]> = {
  "video/mp4": "mp4",
  "video/x-m4v": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/ogv": "ogv",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
  "video/mpeg": "mpeg",
};

const EXT_TO_CONTAINER: Record<string, VideoFormat["container"]> = {
  mp4: "mp4",
  m4v: "mp4",
  webm: "webm",
  ogv: "ogv",
  ogg: "ogv",
  mov: "mov",
  mkv: "mkv",
  avi: "avi",
  mpg: "mpeg",
  mpeg: "mpeg",
};

export interface CommonsImageInfo {
  url?: string;
  size?: number;
  mime?: string;
  width?: number;
  height?: number;
  descriptionurl?: string;
  mediatype?: string;
}

export interface CommonsQueryResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: CommonsImageInfo[];
        missing?: boolean;
      }
    >;
  };
}

export function parseCommonsTitle(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "commons.wikimedia.org" && host !== "www.commons.wikimedia.org") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0].toLowerCase() !== "wiki") return null;

  const title = segments.slice(1).join("/").replace(/_/g, " ");
  let decoded: string;
  try {
    decoded = decodeURIComponent(title);
  } catch {
    return null;
  }

  if (!/^File:.+/i.test(decoded)) return null;
  if (decoded.length > 255) return null;
  return decoded;
}

export function containerFromMime(mime: string | undefined, fileName: string): VideoFormat["container"] | null {
  if (mime) {
    const normalized = mime.toLowerCase().split(";")[0].trim();
    if (MIME_TO_CONTAINER[normalized]) return MIME_TO_CONTAINER[normalized];
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_CONTAINER[extension] ?? null;
}

export function buildCommonsAnalysis(title: string, info: CommonsImageInfo): VideoAnalysis {
  const fileName = info.url ? info.url.split("/").pop() ?? title : title;
  const container = containerFromMime(info.mime, fileName);
  if (!container) {
    throw new Error(
      "That Wikimedia Commons file is not a video. Paste a link to a video file such as an .ogv, .webm, or .mp4.",
    );
  }

  if (info.mediatype && info.mediatype.toUpperCase() !== "VIDEO" && info.mediatype.toUpperCase() !== "BITMAP") {
    // Allow through; mediatype reporting varies.
  }

  const height = Number.isFinite(info.height) && (info.height ?? 0) > 0 ? (info.height as number) : undefined;
  const quality = height ? `${height}p` : "Original";

  const base: VideoFormat = {
    id: `${container}-${quality.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    container,
    quality,
    label: "",
    ...(Number.isFinite(info.size) && (info.size ?? 0) > 0 ? { fileSizeBytes: info.size } : {}),
  };

  const format: ResolvedVideoFormat = {
    ...base,
    label: formatLabel(base),
    sourceUrl: info.url!,
    fileName,
  };

  const video: VideoMetadata = {
    id: title,
    url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replace(/%20/g, "_")}`,
    title: title.replace(/^File:/i, ""),
    description: "Freely licensed media from Wikimedia Commons. Check the file page for license and attribution requirements.",
    durationSeconds: undefined,
    thumbnailUrl: info.url,
    formats: [{ id: format.id, container: format.container, quality: format.quality, label: format.label, ...(format.fileSizeBytes != null ? { fileSizeBytes: format.fileSizeBytes } : {}) }],
    status: "ready",
    officialOptions: [
      { label: "View file page on Wikimedia Commons", url: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, "_")}` },
    ],
    providerNotes:
      "Wikimedia Commons hosts freely licensed media. Verify the license and attribution requirements on the file page before reuse.",
  };

  return { video, formats: { [format.id]: format } };
}

export class WikimediaCommonsProvider implements VideoProvider {
  readonly id = "wikimedia-commons";
  readonly name = "Wikimedia Commons";

  supports(url: string): boolean {
    return parseCommonsTitle(url) !== null;
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const title = parseCommonsTitle(url);
    if (!title) throw new Error("Unsupported source.");

    const apiUrl = `${API_ENDPOINT}?action=query&prop=imageinfo&iiprop=url|size|mime|width|height|extmetadata&format=json&titles=${encodeURIComponent(title)}`;

    const response = await fetch(apiUrl, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Wikimedia Commons returned an unexpected response (HTTP ${response.status}).`);
    }

    const data = (await response.json().catch(() => null)) as CommonsQueryResponse | null;
    const page = data?.query?.pages ? Object.values(data.query.pages)[0] : undefined;
    if (!page || page.missing) {
      throw new Error("We couldn't find that Wikimedia Commons file. Check the link and try again.");
    }
    const info = page.imageinfo?.[0];
    if (!info?.url) {
      throw new Error("That Wikimedia Commons file has no downloadable media.");
    }

    return buildCommonsAnalysis(title, info);
  }

  createDownloadJob({ videoId, url, format }: CreateDownloadJobInput): DownloadJob {
    const timestamp = new Date().toISOString();
    return {
      id: `job-${randomUUID()}`,
      videoId,
      url,
      formatId: format.id,
      status: "queued",
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
