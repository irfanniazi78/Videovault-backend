import type { DownloadJob, VideoMetadata } from "@/lib/types/video";

import type { CreateDownloadJobInput, VideoAnalysis, VideoProvider } from "./VideoProvider";

const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = "VideoVault/0.1 (+https://github.com/videovault)";

export function parseDailymotionId(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "dai.ly") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return isValidId(id) ? id : null;
  }

  if (host !== "dailymotion.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  // /video/{id} or /embed/video/{id}
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === "video" && segments[i + 1]) {
      const id = segments[i + 1];
      return isValidId(id) ? id : null;
    }
  }
  return null;
}

function isValidId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9]+$/.test(value) && value.length >= 5;
}

export class DailymotionProvider implements VideoProvider {
  readonly id = "dailymotion";
  readonly name = "Dailymotion";

  supports(url: string): boolean {
    return parseDailymotionId(url) !== null;
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const id = parseDailymotionId(url);
    if (!id) throw new Error("Unsupported source.");

    const watchUrl = `https://www.dailymotion.com/video/${id}`;

    let title = `Dailymotion video ${id}`;
    let description: string | undefined;
    let durationSeconds: number | undefined;
    let thumbnailUrl: string | undefined;
    let author: string | undefined;

    try {
      const response = await fetch(
        `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
        {
          headers: { accept: "application/json", "user-agent": USER_AGENT },
          signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
          cache: "no-store",
        },
      );
      if (response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { title?: string; author_name?: string; thumbnail_url?: string; duration?: number; description?: string }
          | null;
        if (data) {
          title = data.title ?? title;
          author = data.author_name;
          thumbnailUrl = data.thumbnail_url;
          durationSeconds = typeof data.duration === "number" && data.duration > 0 ? data.duration : undefined;
          description = data.description?.replace(/\s+/g, " ").trim().slice(0, 400) || (author ? `By ${author}` : undefined);
        }
      } else if (response.status === 404) {
        throw new Error("We couldn't find that Dailymotion video. It may be private or removed.");
      }
    } catch (error) {
      if (error instanceof Error && /couldn't find/i.test(error.message)) throw error;
    }

    const video: VideoMetadata = {
      id,
      url: watchUrl,
      title,
      description,
      durationSeconds,
      thumbnailUrl,
      formats: [],
      status: "ready",
      officialOptions: [
        { label: "Watch on Dailymotion", url: watchUrl },
      ],
      providerNotes:
        "Dailymotion does not provide a public third-party download API. VideoVault can show metadata and official links only.",
    };

    return { video, formats: {} };
  }

  createDownloadJob(_input: CreateDownloadJobInput): DownloadJob {
    void _input;
    throw new Error("Downloads are not available for Dailymotion.");
  }
}
