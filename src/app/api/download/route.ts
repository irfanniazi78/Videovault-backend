import { NextResponse } from "next/server";

import { startDownload } from "@/lib/downloads/worker";
import { formatLabel } from "@/lib/formats";
import { saveJob } from "@/lib/jobs/store";
import { getVideoProviderForUrl } from "@/lib/providers";
import { UNSUPPORTED_SOURCE_MESSAGE } from "@/lib/providers/InternetArchiveProvider";
import { validateUrlInput } from "@/lib/validators/url";

interface CreateDownloadRequestBody {
  videoId?: string;
  url?: string;
  formatId?: string;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { videoId, url, formatId } = (body ?? {}) as CreateDownloadRequestBody;

  if (!formatId) {
    return NextResponse.json({ error: "A target format is required." }, { status: 400 });
  }

  const result = validateUrlInput(url);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const provider = getVideoProviderForUrl(result.normalized);
  if (!provider) {
    return NextResponse.json({ error: UNSUPPORTED_SOURCE_MESSAGE }, { status: 422 });
  }

  let analysis;
  try {
    analysis = await provider.analyzeVideo(result.normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze the video.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Resolve the format on the server. The client only sends an id, so it can
  // never redirect the downloader to a different host.
  const format = analysis.formats[formatId];
  if (!format) {
    return NextResponse.json(
      { error: "That format is no longer available. Analyze the video again and retry." },
      { status: 400 },
    );
  }

  let job;
  try {
    job = provider.createDownloadJob({
      videoId: videoId ?? analysis.video.id,
      url: result.normalized,
      format,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Downloads are not available for this source.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  await saveJob(job);

  // The download runs in the background; the client polls /api/jobs/{id}.
  void startDownload({
    job,
    format,
    title: analysis.video.title,
    formatLabel: formatLabel(format),
  }).catch(() => undefined);

  return NextResponse.json({ job }, { status: 201 });
}
