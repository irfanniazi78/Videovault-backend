import type { DownloadJob, VideoMetadata } from "@/lib/types/video";

import type { CreateDownloadJobInput, VideoAnalysis, VideoProvider } from "./VideoProvider";

const REQUEST_TIMEOUT_MS = 15_000;

export function parseYouTubeId(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return isValidYouTubeId(id) ? id : null;
  }

  if (host !== "youtube.com" && host !== "m.youtube.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments[0] === "watch") {
    const id = parsed.searchParams.get("v");
    return isValidYouTubeId(id) ? id : null;
  }
  if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "v") {
    const id = segments[1];
    return isValidYouTubeId(id) ? id : null;
  }
  return null;
}

function isValidYouTubeId(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
}

function iso8601ToSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : undefined;
}

export class YouTubeProvider implements VideoProvider {
  readonly id = "youtube";
  readonly name = "YouTube";

  supports(url: string): boolean {
    return parseYouTubeId(url) !== null;
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const id = parseYouTubeId(url);
    if (!id) throw new Error("Unsupported source.");

    const watchUrl = `https://www.youtube.com/watch?v=${id}`;
    const apiKey = process.env.YOUTUBE_API_KEY;

    let title = `YouTube video ${id}`;
    let description: string | undefined;
    let durationSeconds: number | undefined;
    let thumbnailUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    let channel: string | undefined;

    if (apiKey) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(id)}&key=${encodeURIComponent(apiKey)}`,
          { signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined, cache: "no-store" },
        );
        if (response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { items?: { snippet?: { title?: string; description?: string; channelTitle?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } } }; contentDetails?: { duration?: string } }[] }
            | null;
          const item = data?.items?.[0];
          if (item) {
            title = item.snippet?.title ?? title;
            description = item.snippet?.description?.replace(/\s+/g, " ").trim().slice(0, 400);
            channel = item.snippet?.channelTitle;
            durationSeconds = iso8601ToSeconds(item.contentDetails?.duration);
            thumbnailUrl = item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? thumbnailUrl;
          }
        }
      } catch {
        // Fall back to oEmbed below.
      }
    }

    if (!apiKey || title === `YouTube video ${id}`) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
        const response = await fetch(oembedUrl, {
          signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { title?: string; author_name?: string; thumbnail_url?: string; width?: number; height?: number }
            | null;
          if (data) {
            title = data.title ?? title;
            channel = data.author_name ?? channel;
            thumbnailUrl = data.thumbnail_url ?? thumbnailUrl;
          }
        }
      } catch {
        // Metadata unavailable; keep defaults.
      }
    }

    const video: VideoMetadata = {
      id,
      url: watchUrl,
      title,
      description: description ?? (channel ? `Channel: ${channel}` : undefined),
      durationSeconds,
      thumbnailUrl,
      formats: [],
      status: "ready",
      officialOptions: [
        { label: "Watch on YouTube", url: watchUrl },
        { label: "Open in YouTube Studio (download your own videos)", url: "https://studio.youtube.com/" },
      ],
      providerNotes:
        "YouTube does not provide a public download API. VideoVault can show metadata and official links only; " +
        "download your own uploads through YouTube Studio.",
    };

    return { video, formats: {} };
  }

  createDownloadJob(_input: CreateDownloadJobInput): DownloadJob {
    void _input;
    throw new Error("Downloads are not available for YouTube. Use YouTube Studio to download your own uploads.");
  }
}
