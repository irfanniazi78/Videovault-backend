import type { DownloadJob, VideoFormat, VideoMetadata } from "@/lib/types/video";

import { formatLabel } from "@/lib/formats";
import type { CreateDownloadJobInput, ResolvedVideoFormat, VideoAnalysis, VideoProvider } from "./VideoProvider";

const REQUEST_TIMEOUT_MS = 15_000;

interface NasaSearchItem {
  data?: { nasa_id?: string; title?: string; description?: string; date_created?: string }[];
  links?: { href?: string; rel?: string }[];
}

export function parseNasaId(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "images.nasa.gov") return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  // /details/{nasa_id}
  if (segments[0] === "details" && segments[1]) {
    try {
      return decodeURIComponent(segments.slice(1).join("/"));
    } catch {
      return null;
    }
  }
  return null;
}

function qualityFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("orig")) return "Original";
  if (lower.includes("large")) return "Large";
  if (lower.includes("medium")) return "Medium";
  if (lower.includes("small")) return "Small";
  return "Original";
}

export class NasaProvider implements VideoProvider {
  readonly id = "nasa";
  readonly name = "NASA Image and Video Library";

  supports(url: string): boolean {
    return parseNasaId(url) !== null;
  }

  async analyzeVideo(url: string): Promise<VideoAnalysis> {
    const nasaId = parseNasaId(url);
    if (!nasaId) throw new Error("Unsupported source.");

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    let item: NasaSearchItem | undefined;
    let resolvedId = nasaId;

    // Try exact nasa_id match first.
    const exactRes = await fetch(
      `https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(nasaId)}&media_type=video`,
      {
        signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
        cache: "no-store",
      },
    );
    if (exactRes.ok) {
      const exactData = (await exactRes.json().catch(() => null)) as { collection?: { items?: NasaSearchItem[] } } | null;
      item = exactData?.collection?.items?.[0];
      if (item?.data?.[0]?.nasa_id) resolvedId = item.data[0].nasa_id;
    }

    // Fallback: the detail-page slug uses underscores, but the API nasa_id may
    // contain spaces in places. Search by the last few slug tokens and match by
    // normalized id.
    if (!item?.data?.[0]?.nasa_id) {
      const tokens = nasaId.split("_").filter(Boolean);
      const queryTokens = tokens.slice(-3).join(" ");
      const searchRes = await fetch(
        `https://images-api.nasa.gov/search?q=${encodeURIComponent(queryTokens)}&media_type=video&page_size=25`,
        {
          signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
          cache: "no-store",
        },
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json().catch(() => null)) as { collection?: { items?: NasaSearchItem[] } } | null;
        const targetNorm = normalize(nasaId);
        const found = (searchData?.collection?.items ?? []).find(
          (i) => normalize(i.data?.[0]?.nasa_id ?? "") === targetNorm,
        );
        if (found) {
          item = found;
          resolvedId = found.data![0].nasa_id!;
        }
      }
    }

    const meta = item?.data?.[0];
    if (!meta?.nasa_id) throw new Error("We couldn't find that NASA video.");

    const title = meta.title ?? resolvedId;
    const description = meta.description?.replace(/\s+/g, " ").trim().slice(0, 400);
    const thumbnailUrl = item?.links?.find((l) => l.rel === "preview")?.href;

    // Fetch asset manifest for downloadable files.
    const assetRes = await fetch(`https://images-api.nasa.gov/asset/${encodeURIComponent(resolvedId)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
      cache: "no-store",
    });
    if (!assetRes.ok) throw new Error(`NASA asset API returned HTTP ${assetRes.status}.`);

    const assetData = (await assetRes.json().catch(() => null)) as { collection?: { items?: { href?: string }[] } } | null;
    const hrefs = (assetData?.collection?.items ?? []).map((i) => i.href).filter((h): h is string => !!h);
    const mp4s = hrefs.filter((h) => /\.mp4$/i.test(h));

    if (mp4s.length === 0) {
      throw new Error("That NASA item has no downloadable MP4 files.");
    }

    const formats: ResolvedVideoFormat[] = mp4s.map((href, idx) => {
      const fileName = href.split("/").pop() ?? `nasa-${idx}.mp4`;
      const quality = qualityFromName(fileName);
      const base: VideoFormat = {
        id: `mp4-${quality.toLowerCase()}`,
        container: "mp4",
        quality,
        label: "",
      };
      return {
        ...base,
        label: formatLabel(base),
        sourceUrl: href,
        fileName,
      };
    });

    // Deduplicate ids
    const used = new Set<string>();
    for (const f of formats) {
      if (used.has(f.id)) {
        let n = 2;
        while (used.has(`${f.id}-${n}`)) n++;
        f.id = `${f.id}-${n}`;
      }
      used.add(f.id);
    }

    const video: VideoMetadata = {
      id: resolvedId,
      url: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
      title,
      description,
      formats: formats.map(({ id, container, quality, label, fileSizeBytes }) => ({
        id,
        container,
        quality,
        label,
        ...(fileSizeBytes != null ? { fileSizeBytes } : {}),
      })),
      status: "ready",
      thumbnailUrl,
      officialOptions: [{ label: "View on NASA Image and Video Library", url: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}` }],
      providerNotes: "Public domain NASA media. Verify usage rights on the item page.",
    };

    const formatMap = Object.fromEntries(formats.map((f) => [f.id, f]));
    return { video, formats: formatMap };
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
