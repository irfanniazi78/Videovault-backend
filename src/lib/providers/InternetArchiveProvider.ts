import { randomUUID } from "node:crypto";

import { formatLabel } from "@/lib/formats";
import type { DownloadJob, VideoFormat, VideoMetadata } from "@/lib/types/video";

import type {
  CreateDownloadJobInput,
  ResolvedVideoFormat,
  VideoAnalysis,
  VideoProvider,
} from "./VideoProvider";

const METADATA_ENDPOINT = "https://archive.org/metadata";
const DOWNLOAD_ENDPOINT = "https://archive.org/download";
const THUMBNAIL_ENDPOINT = "https://archive.org/services/img";
const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const USER_AGENT = "VideoVault/0.1 (+https://github.com/videovault)";

/** Extensions we can hand to the browser as a real file. */
const VIDEO_EXTENSIONS: Record<string, VideoFormat["container"]> = {
  mp4: "mp4",
  m4v: "mp4",
  webm: "webm",
  mov: "mov",
  ogv: "ogv",
  ogg: "ogv",
  avi: "avi",
  mkv: "mkv",
  mpg: "mpeg",
  mpeg: "mpeg",
};

/** Internet Archive media types that contain video items. */
const VIDEO_MEDIA_TYPES = new Set(["movies", "video", "television"]);

export interface InternetArchiveFile {
  name?: string;
  format?: string;
  size?: string;
  length?: string;
  height?: string;
  width?: string;
  private?: string;
  source?: string;
}

export interface InternetArchiveMetadata {
  metadata?: {
    identifier?: string;
    title?: string | string[];
    description?: string | string[];
    mediatype?: string;
    licenseurl?: string;
  };
  files?: InternetArchiveFile[];
  server?: string;
  dir?: string;
}

export const UNSUPPORTED_SOURCE_MESSAGE =
  "VideoVault currently supports Internet Archive video links, for example " +
  "https://archive.org/details/BigBuckBunny_124. Other platforms are not supported " +
  "because their terms do not permit third-party downloads.";

/**
 * Extracts the Internet Archive item identifier from a supported URL.
 * Accepts /details/{id}, /download/{id}/..., and /embed/{id}.
 */
export function parseArchiveIdentifier(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "archive.org" && host !== "www.archive.org") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [kind, rawIdentifier] = segments;
  if (kind !== "details" && kind !== "download" && kind !== "embed") return null;

  let identifier: string;
  try {
    identifier = decodeURIComponent(rawIdentifier);
  } catch {
    return null;
  }

  // Identifiers are simple slugs; reject anything that could alter a request path.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(identifier)) return null;

  return identifier;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseDurationSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined;

  if (/^\d+(\.\d+)?$/.test(value)) {
    const seconds = Number.parseFloat(value);
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : undefined;
  }

  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

/** Builds the stable, public download URL for a file inside an item. */
export function buildSourceUrl(identifier: string, fileName: string): string {
  const encodedPath = fileName.split("/").map(encodeURIComponent).join("/");
  return `${DOWNLOAD_ENDPOINT}/${encodeURIComponent(identifier)}/${encodedPath}`;
}

function isVideoFile(file: InternetArchiveFile): boolean {
  const name = file.name ?? "";
  if (!name || name.startsWith("__ia_thumb") || name.includes(".thumbs/")) return false;
  if (file.private === "true") return false;

  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return extension in VIDEO_EXTENSIONS;
}

function uniqueFormatId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`;
  used.add(id);
  return id;
}

/**
 * Pure transformation from an Internet Archive metadata response into the
 * app's analysis shape. Kept separate from network access so it is testable.
 */
export function buildArchiveAnalysis(
  identifier: string,
  data: InternetArchiveMetadata,
): VideoAnalysis {
  const meta = data.metadata ?? {};
  const mediaType = meta.mediatype?.toLowerCase();

  if (mediaType && !VIDEO_MEDIA_TYPES.has(mediaType)) {
    throw new Error(
      "That Internet Archive item is not a video. Paste a link to an item whose media type is video.",
    );
  }

  const files = (data.files ?? []).filter(isVideoFile).sort((a, b) => a.name!.localeCompare(b.name!));

  if (files.length === 0) {
    throw new Error(
      "This Internet Archive item has no downloadable video files. Only items with public video files can be analyzed.",
    );
  }

  const usedIds = new Set<string>();
  const resolved: ResolvedVideoFormat[] = files.map((file) => {
    const fileName = file.name!;
    const extension = fileName.split(".").pop()!.toLowerCase();
    const container = VIDEO_EXTENSIONS[extension];

    const height = Number.parseInt(file.height ?? "", 10);
    const quality = Number.isFinite(height) && height > 0 ? `${height}p` : "Original";

    const size = Number.parseInt(file.size ?? "", 10);
    const id = uniqueFormatId(
      `${container}-${quality.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      usedIds,
    );

    const base: VideoFormat = {
      id,
      container,
      quality,
      label: "",
      ...(Number.isFinite(size) && size > 0 ? { fileSizeBytes: size } : {}),
    };

    return {
      ...base,
      label: formatLabel(base),
      sourceUrl: buildSourceUrl(identifier, fileName),
      fileName: fileName.split("/").pop() ?? `${id}.${extension}`,
    };
  });

  const video: VideoMetadata = {
    id: identifier,
    url: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    title: firstString(meta.title) ?? identifier,
    description: firstString(meta.description)?.replace(/\s+/g, " ").trim().slice(0, 400),
    durationSeconds: files
      .map((file) => parseDurationSeconds(file.length))
      .find((seconds) => seconds != null),
    thumbnailUrl: `${THUMBNAIL_ENDPOINT}/${encodeURIComponent(identifier)}`,
    formats: resolved.map(({ id, container, quality, label, fileSizeBytes }) => ({
      id,
      container,
      quality,
      label,
      ...(fileSizeBytes != null ? { fileSizeBytes } : {}),
    })),
    status: "ready",
  };

  const formats = Object.fromEntries(resolved.map((format) => [format.id, format]));

  return { video, formats };
}

/**
 * Provider for the Internet Archive (archive.org).
 *
 * Every Internet Archive file is served from a public HTTP URL, so analysis
 * and downloads need no API key and no scraping. Only items the Archive itself
 * serves publicly are supported; restricted or private items fail loudly.
 */
export class InternetArchiveProvider implements VideoProvider {
  readonly id = "internet-archive";
  readonly name = "Internet Archive";

  private readonly cache = new Map<string, { expiresAt: number; analysis: VideoAnalysis }>();

  supports(url: string): boolean {
    return parseArchiveIdentifier(url) !== null;
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const identifier = parseArchiveIdentifier(url);
    if (!identifier) throw new Error(UNSUPPORTED_SOURCE_MESSAGE);

    const cached = this.cache.get(identifier);
    if (cached && cached.expiresAt > Date.now()) return cached.analysis;

    const timeoutSignal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        : undefined;

    const response = await fetch(`${METADATA_ENDPOINT}/${encodeURIComponent(identifier)}`, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
      cache: "no-store",
    });

    if (response.status === 404) {
      throw new Error(
        "We couldn't find that Internet Archive item. Check the link and make sure the item exists.",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "That Internet Archive item is restricted and cannot be downloaded. Only public items are supported.",
      );
    }

    if (!response.ok) {
      throw new Error(
        `The Internet Archive returned an unexpected response (HTTP ${response.status}). Please try again in a moment.`,
      );
    }

    const data = (await response.json().catch(() => null)) as InternetArchiveMetadata | null;
    if (!data) {
      throw new Error("The Internet Archive returned an unreadable response. Please try again.");
    }

    const analysis = buildArchiveAnalysis(identifier, data);
    this.cache.set(identifier, { expiresAt: Date.now() + CACHE_TTL_MS, analysis });
    return analysis;
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
