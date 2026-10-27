import type { DownloadJob, VideoMetadata } from "@/lib/types/video";

import type { VideoAnalysis, VideoProvider } from "./VideoProvider";

const REQUEST_TIMEOUT_MS = 15_000;

export function parseTwitchClipSlug(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (host === "clips.twitch.tv") {
    const slug = segments[0];
    return slug && /^[A-Za-z0-9_-]+$/.test(slug) ? slug : null;
  }

  if (host === "twitch.tv" || host === "www.twitch.tv") {
    // /{channel}/clip/{slug}
    const clipIndex = segments.indexOf("clip");
    if (clipIndex >= 0 && segments[clipIndex + 1]) {
      const slug = segments[clipIndex + 1];
      return /^[A-Za-z0-9_-]+$/.test(slug) ? slug : null;
    }
  }

  return null;
}

export class TwitchProvider implements VideoProvider {
  readonly id = "twitch";
  readonly name = "Twitch";

  supports(url: string): boolean {
    return parseTwitchClipSlug(url) !== null;
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const slug = parseTwitchClipSlug(url);
    if (!slug) throw new Error("Unsupported source.");

    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "Twitch clips require a free Twitch Client ID. Set TWITCH_CLIENT_ID in your environment to enable metadata.",
      );
    }

    const response = await fetch(`https://api.twitch.tv/helix/clips?id=${encodeURIComponent(slug)}`, {
      headers: {
        "Client-Id": clientId,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Twitch API returned HTTP ${response.status}.`);
    }

    const data = (await response.json().catch(() => null)) as
      | { data?: { id?: string; title?: string; creator_name?: string; thumbnail_url?: string; duration?: number; url?: string }[] }
      | null;
    const clip = data?.data?.[0];
    if (!clip) throw new Error("We couldn't find that Twitch clip.");

    const watchUrl = clip.url ?? url;
    const video: VideoMetadata = {
      id: clip.id ?? slug,
      url: watchUrl,
      title: clip.title ?? `Twitch clip ${slug}`,
      description: clip.creator_name ? `By ${clip.creator_name}` : undefined,
      durationSeconds: typeof clip.duration === "number" && clip.duration > 0 ? Math.round(clip.duration) : undefined,
      thumbnailUrl: clip.thumbnail_url,
      formats: [],
      status: "ready",
      officialOptions: [{ label: "Watch on Twitch", url: watchUrl }],
      providerNotes: "Twitch does not provide a public download API. VideoVault shows metadata and official links only.",
    };

    return { video, formats: {} };
  }

  createDownloadJob(_input: unknown): DownloadJob {
    void _input;
    throw new Error("Downloads are not available for Twitch.");
  }
}
