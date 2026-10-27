import { promises as fs } from "node:fs";
import path from "node:path";

import type { DownloadJob, DownloadJobStatus } from "@/lib/types/video";

const FALLBACK_DATA_DIR = path.join(process.cwd(), "data");

function dataDir(): string {
  return process.env.VIDEOVAULT_DATA_DIR ?? FALLBACK_DATA_DIR;
}

function jobsFile(): string {
  return path.join(dataDir(), "jobs.json");
}

/**
 * Jobs are mirrored to a JSON file because Next.js loads each route in its own
 * module scope: an in-memory Map is not shared between `/api/download` and
 * `/api/jobs/[id]`. Persisting keeps polling, cancellation and file serving
 * consistent, and lets a job survive a dev-server restart.
 */
const jobs = new Map<string, DownloadJob>();
let loaded = false;
let writeChain: Promise<void> = Promise.resolve();

async function readJobsFile(): Promise<DownloadJob[]> {
  try {
    const raw = await fs.readFile(jobsFile(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is DownloadJob =>
        typeof entry === "object" && entry !== null && typeof (entry as DownloadJob).id === "string",
    );
  } catch {
    return [];
  }
}

function mergeIntoMemory(entries: DownloadJob[]): void {
  for (const entry of entries) {
    if (!jobs.has(entry.id)) jobs.set(entry.id, entry);
  }
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  mergeIntoMemory(await readJobsFile());
  loaded = true;
}

async function persist(): Promise<void> {
  writeChain = writeChain.then(async () => {
    const merged = new Map<string, DownloadJob>();
    for (const entry of await readJobsFile()) merged.set(entry.id, entry);
    for (const [id, job] of jobs) merged.set(id, job);

    try {
      await fs.mkdir(dataDir(), { recursive: true });
      const temporary = `${jobsFile()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(Array.from(merged.values()), null, 2));
      await fs.rename(temporary, jobsFile());
    } catch {
      // Persistence is best-effort; the job still lives in memory.
    }
  });

  await writeChain;
}

/**
 * Reads a job straight from disk, bypassing this module's cache.
 * Used by long-running workers to notice cancellation from another route.
 */
export async function readPersistedJob(id: string): Promise<DownloadJob | null> {
  const entries = await readJobsFile();
  return entries.find((entry) => entry.id === id) ?? null;
}

export async function saveJob(job: DownloadJob): Promise<DownloadJob> {
  await ensureLoaded();
  jobs.set(job.id, job);
  await persist();
  return job;
}

export async function getJob(id: string): Promise<DownloadJob | null> {
  await ensureLoaded();
  const cached = jobs.get(id);
  if (cached) {
    // The job may have changed in another route's module scope.
    const persisted = await readPersistedJob(id);
    if (persisted) {
      jobs.set(id, persisted);
      return persisted;
    }
    return cached;
  }

  const persisted = await readPersistedJob(id);
  if (persisted) jobs.set(id, persisted);
  return persisted;
}

export async function updateJob(
  id: string,
  patch: Partial<DownloadJob>,
): Promise<DownloadJob | null> {
  await ensureLoaded();
  const existing = jobs.get(id) ?? (await readPersistedJob(id));
  if (!existing) return null;

  const updated: DownloadJob = {
    ...existing,
    ...patch,
    id: existing.id,
    url: patch.url ?? existing.url,
    videoId: patch.videoId ?? existing.videoId,
    formatId: patch.formatId ?? existing.formatId,
    status: (patch.status ?? existing.status) as DownloadJobStatus,
    progress: patch.progress ?? existing.progress,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(id, updated);
  await persist();
  return updated;
}
