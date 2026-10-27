import type { DownloadJob, VideoMetadata } from "@/lib/types/video";

import type { CreateDownloadJobInput, VideoAnalysis, VideoProvider } from "./VideoProvider";

const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = "VideoVault/0.1 (+https://github.com/videovault)";

export function parseVimeoId(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  for (const segment of segments) {
    if (/^\d{6,11}$/.test(segment)) return segment;
  }
  return null;
}

export class VimeoProvider implements VideoProvider {
  readonly id = "vimeo";
  readonly name = "Vimeo";

  supports(url: string): boolean {
    return parseVimeoId(url) !== null;
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const id = parseVimeoId(url);
    if (!id) throw new Error("Unsupported source.");

    const watchUrl = `https://vimeo.com/${id}`;

    let title = `Vimeo video ${id}`;
    let description: string | undefined;
    let durationSeconds: number | undefined;
    let thumbnailUrl: string | undefined;
    let author: string | undefined;

    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(watchUrl)}`, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
        cache: "no-store",
      });
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
        throw new Error("We couldn't find that Vimeo video. It may be private or removed.");
      }
    } catch (error) {
      if (error instanceof Error && /couldn't find/i.test(error.message)) throw error;
      // Metadata unavailable; keep defaults.
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
        { label: "Watch on Vimeo", url: watchUrl },
        { label: "Download (owner only) via Vimeo", url: `https://vimeo.com/manage/videos/${id}` },
      ],
      providerNotes:
        "Vimeo does not allow third-party downloads of other users' videos. VideoVault can show metadata and official links only.",
    };

    return { video, formats: {} };
  }

  createDownloadJob(_input: CreateDownloadJobInput): DownloadJob {
    void _input;
    throw new Error("Downloads are not available for Vimeo. Owners can download from their Vimeo account.");
  }
}
