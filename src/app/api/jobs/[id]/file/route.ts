import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { resolveDownloadPath } from "@/lib/downloads/worker";
import { getJob } from "@/lib/jobs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Serves a finished download to the browser.
 *
 * The file was fetched from the public source by the download worker, so this
 * route never proxies arbitrary URLs — it only streams files the worker wrote.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Download job not found." }, { status: 404 });
  }

  if (job.status !== "completed") {
    return NextResponse.json(
      { error: "The download is not ready yet. Check its progress and try again." },
      { status: 409 },
    );
  }

  const filePath = resolveDownloadPath(job);
  if (!filePath) {
    return NextResponse.json(
      { error: "The downloaded file is no longer available. Please download it again." },
      { status: 410 },
    );
  }

  let sizeBytes: number;
  try {
    sizeBytes = (await stat(filePath)).size;
  } catch {
    return NextResponse.json(
      { error: "The downloaded file is no longer available. Please download it again." },
      { status: 410 },
    );
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "content-type": job.contentType ?? "application/octet-stream",
      "content-length": String(sizeBytes),
      "content-disposition": contentDisposition(job.fileName ?? "download"),
      "cache-control": "private, no-store",
    },
  });
}
