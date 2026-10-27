import { promises as fs } from "node:fs";
import path from "node:path";

import { recordHistory } from "@/lib/history/store";
import { readPersistedJob, updateJob } from "@/lib/jobs/store";
import type { DownloadJob } from "@/lib/types/video";
import type { ResolvedVideoFormat } from "@/lib/providers/VideoProvider";

const USER_AGENT = "VideoVault/0.1 (+https://github.com/videovault)";

/** How often an in-flight transfer checks whether it was cancelled elsewhere. */
const CANCEL_POLL_MS = 500;

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  ogg: "video/ogg",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
};

export interface DownloadStartInput {
  job: DownloadJob;
  format: ResolvedVideoFormat;
  title?: string;
  formatLabel?: string;
}

export interface DownloadRunOptions {
  /** Overrides the download root, used by tests. */
  rootDir?: string;
  /** Overrides fetch, used by tests. */
  fetchImpl?: typeof fetch;
}

const controllers = new Map<string, AbortController>();

class DownloadCancelledError extends Error {
  constructor() {
    super("Download cancelled.");
    this.name = "DownloadCancelledError";
  }
}

/** Directory where finished downloads are stored (git-ignored `data/`). */
export function getDownloadRoot(): string {
  return process.env.VIDEOVAULT_DOWNLOAD_DIR ?? path.join(process.cwd(), "data", "downloads");
}

/** Absolute path of a job's stored file, or null when it cannot be resolved. */
export function resolveDownloadPath(
  job: DownloadJob,
  root = getDownloadRoot(),
): string | null {
  if (!job.fileName) return null;

  const fileName = path.basename(job.fileName);
  if (!fileName || fileName === "." || fileName === "..") return null;

  const fullPath = path.join(root, job.id, fileName);
  if (!fullPath.startsWith(root + path.sep)) return null;

  return fullPath;
}

/** Aborts an in-flight download in this process. Safe for unknown jobs. */
export function requestCancel(jobId: string): void {
  controllers.get(jobId)?.abort();
}

function sanitizeFileName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? fallback;
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "");
  const safe = cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
  return /\.\w{1,5}$/.test(safe) ? safe : `${safe}.bin`;
}

function contentTypeFor(fileName: string, upstream: string | null): string {
  if (upstream && upstream !== "application/octet-stream" && upstream.startsWith("video/")) {
    return upstream;
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[extension] ?? upstream ?? "application/octet-stream";
}

async function wasCancelled(jobId: string): Promise<boolean> {
  const persisted = await readPersistedJob(jobId);
  return persisted?.status === "cancelled";
}

/**
 * Downloads a resolved format to disk while publishing real byte progress.
 *
 * The job starts `queued`, moves to `processing` once the upstream response is
 * accepted, and ends `completed`, `failed`, or `cancelled`. Terminal states are
 * written to the persisted download history.
 */
export async function startDownload(
  { job, format, title, formatLabel }: DownloadStartInput,
  options: DownloadRunOptions = {},
): Promise<DownloadJob> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const rootDir = options.rootDir ?? getDownloadRoot();
  const controller = new AbortController();
  controllers.set(job.id, controller);

  const jobDir = path.join(rootDir, job.id);
  const fileName = sanitizeFileName(format.fileName, `${format.id}.${format.container}`);
  const finalPath = path.join(jobDir, fileName);
  const partialPath = `${finalPath}.part`;

  let receivedBytes = 0;

  try {
    await fs.mkdir(jobDir, { recursive: true });

    const response = await fetchImpl(format.sourceUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "*/*", "user-agent": USER_AGENT },
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `The source refused the download (HTTP ${response.status}). The file may have been removed.`,
      );
    }

    const contentType = contentTypeFor(fileName, response.headers.get("content-type"));

    const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    const totalBytes =
      Number.isFinite(declaredLength) && declaredLength > 0
        ? declaredLength
        : (format.fileSizeBytes ?? 0);

    await updateJob(job.id, { status: "processing", progress: 0 });

    const handle = await fs.open(partialPath, "w");
    let lastProgress = 0;
    let lastCancelCheck = 0;

    try {
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          if (Date.now() - lastCancelCheck > CANCEL_POLL_MS) {
            lastCancelCheck = Date.now();
            if (await wasCancelled(job.id)) throw new DownloadCancelledError();
          }

          await handle.write(value);
          receivedBytes += value.byteLength;

          if (totalBytes > 0) {
            const percent = Math.min(99, Math.floor((receivedBytes / totalBytes) * 100));
            if (percent > lastProgress) {
              lastProgress = percent;
              await updateJob(job.id, { progress: percent });
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      await handle.close();
    }

    if (await wasCancelled(job.id)) throw new DownloadCancelledError();

    if (receivedBytes === 0) {
      throw new Error("The source returned an empty file.");
    }

    await fs.rename(partialPath, finalPath);

    const sizeBytes = (await fs.stat(finalPath)).size;
    controllers.delete(job.id);

    const finished = await updateJob(job.id, {
      status: "completed",
      progress: 100,
      error: undefined,
      fileName,
      contentType,
      sizeBytes,
    });

    await recordHistory({
      id: job.id,
      url: job.url,
      title,
      formatLabel,
      status: "completed",
      createdAt: job.createdAt,
      finishedAt: new Date().toISOString(),
    });

    return finished ?? { ...job, status: "completed", progress: 100, fileName, sizeBytes };
  } catch (error) {
    controllers.delete(job.id);

    const cancelled =
      error instanceof DownloadCancelledError ||
      (await wasCancelled(job.id)) ||
      controller.signal.aborted;
    const message = cancelled
      ? undefined
      : error instanceof Error
        ? error.message
        : "The download failed unexpectedly.";

    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined);

    const finished = await updateJob(job.id, {
      status: cancelled ? "cancelled" : "failed",
      progress: 0,
      error: message,
    });

    await recordHistory({
      id: job.id,
      url: job.url,
      title,
      formatLabel,
      status: cancelled ? "cancelled" : "failed",
      createdAt: job.createdAt,
      finishedAt: new Date().toISOString(),
    });

    return finished ?? { ...job, status: cancelled ? "cancelled" : "failed", error: message };
  }
}
