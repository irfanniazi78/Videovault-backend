import { NextResponse } from "next/server";

import { getOfficialOptionsForUrl, getVideoProviderForUrl } from "@/lib/providers";
import { UNSUPPORTED_SOURCE_MESSAGE } from "@/lib/providers/InternetArchiveProvider";
import { validateUrlInput } from "@/lib/validators/url";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { url } = (body ?? {}) as { url?: string };
  const result = validateUrlInput(url);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const provider = getVideoProviderForUrl(result.normalized);
  if (!provider) {
    const official = getOfficialOptionsForUrl(result.normalized);
    return NextResponse.json(
      {
        error: official
          ? `VideoVault currently supports Internet Archive and Wikimedia Commons video links. ${official.platform} is not supported for downloading.`
          : UNSUPPORTED_SOURCE_MESSAGE,
        platform: official?.platform,
        officialOptions: official?.options ?? [],
        providerNotes: official?.notes,
      },
      { status: 422 },
    );
  }

  try {
    const { video } = await provider.analyzeVideo(result.normalized);
    return NextResponse.json({ video });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze the video.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
