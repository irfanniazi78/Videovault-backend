import { formatBytes } from "@/lib/formatters";
import type { VideoFormat } from "@/lib/types/video";

/** Parses a quality string such as "1080p" into a numeric rank (1080). */
export function qualityRank(quality: string): number {
  const match = /^(\d+)p?$/i.exec(quality.trim());
  return match ? Number.parseInt(match[1], 10) : 0;
}

/** Sorts formats by quality (descending) and stable container preference. */
export function sortFormats(formats: VideoFormat[]): VideoFormat[] {
  const containerOrder: Record<string, number> = {
    mp4: 0,
    webm: 1,
    mov: 2,
    ogv: 3,
    mkv: 4,
    avi: 5,
    mpeg: 6,
  };
  return [...formats].sort((a, b) => {
    const rankDiff = qualityRank(b.quality) - qualityRank(a.quality);
    if (rankDiff !== 0) return rankDiff;
    const aOrder = containerOrder[a.container] ?? 3;
    const bOrder = containerOrder[b.container] ?? 3;
    return aOrder - bOrder;
  });
}

/** Returns the distinct qualities present in the metadata, highest first. */
export function availableQualities(formats: VideoFormat[]): VideoFormat[] {
  const seen = new Map<string, VideoFormat>();
  for (const format of sortFormats(formats)) {
    if (!seen.has(format.quality)) seen.set(format.quality, format);
  }
  return Array.from(seen.values());
}

/** Builds a display label such as "1080p MP4 · 57.7 MB". */
export function formatLabel(format: VideoFormat): string {
  const numeric = /^(\d+)p?$/i.exec(format.quality.trim());
  const quality = numeric ? `${numeric[1]}p` : format.quality;
  const container = format.container.toUpperCase();
  const size = format.fileSizeBytes != null ? ` · ${formatBytes(format.fileSizeBytes)}` : "";
  return `${quality} ${container}${size}`;
}
