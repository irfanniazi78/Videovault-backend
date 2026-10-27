/** @vitest-environment node */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestCancel,
  resolveDownloadPath,
  startDownload,
} from "@/lib/downloads/worker";
import { recordHistory } from "@/lib/history/store";
import { readPersistedJob, saveJob, updateJob } from "@/lib/jobs/store";
import type { ResolvedVideoFormat } from "@/lib/providers/VideoProvider";
import type { DownloadJob } from "@/lib/types/video";

vi.mock("@/lib/history/store", () => ({
  recordHistory: vi.fn(async (entry: unknown) => entry),
}));

function makeJob(): DownloadJob {
  const timestamp = new Date().toISOString();
  return {
    id: `job-${randomUUID()}`,
    videoId: "video-1",
    url: "https://archive.org/details/test-item",
    formatId: "mp4-360p",
    status: "queued",
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function makeFormat(sourceUrl: string): ResolvedVideoFormat {
  return {
    id: "mp4-360p",
    container: "mp4",
    quality: "360p",
    label: "360p MP4",
    sourceUrl,
    fileName: "clip one.mp4",
  };
}

let server: Server | null = null;
let baseDir: string;
let rootDir: string;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
}

async function waitForJob(
  id: string,
  predicate: (job: DownloadJob) => boolean,
  timeoutMs = 3000,
): Promise<DownloadJob> {
  const startedAt = Date.now();
  for (;;) {
    const job = await readPersistedJob(id);
    if (job && predicate(job)) return job;
    if (Date.now() - startedAt > timeoutMs) throw new Error("Timed out waiting for job state.");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function listen(handler: RequestListener): Promise<string> {
  server = createServer(handler);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/clip.mp4`;
}

beforeEach(async () => {
  baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "videovault-worker-"));
  rootDir = path.join(baseDir, "downloads");
  process.env.VIDEOVAULT_DATA_DIR = path.join(baseDir, "data");
  vi.mocked(recordHistory).mockClear();
});

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  delete process.env.VIDEOVAULT_DATA_DIR;
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe("startDownload", () => {
  it("streams the real bytes to disk and completes with full progress", async () => {
    const payload = Buffer.alloc(3000, 7);
    const sourceUrl = await listen((_request, response) => {
      response.writeHead(200, {
        "content-type": "video/mp4",
        "content-length": String(payload.length),
      });
      response.end(payload);
    });

    const job = makeJob();
    await saveJob(job);

    const finished = await startDownload(
      { job, format: makeFormat(sourceUrl), title: "Clip", formatLabel: "360p MP4" },
      { rootDir },
    );

    expect(finished.status).toBe("completed");
    expect(finished.progress).toBe(100);
    expect(finished.error).toBeUndefined();
    expect(finished.contentType).toBe("video/mp4");
    expect(finished.sizeBytes).toBe(3000);
    expect(finished.fileName).toBe("clip_one.mp4");

    const filePath = resolveDownloadPath(finished, rootDir);
    expect(filePath).not.toBeNull();
    expect(path.basename(filePath!)).toBe("clip_one.mp4");

    const onDisk = await fs.readFile(filePath!);
    expect(onDisk.equals(payload)).toBe(true);

    expect(recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ id: job.id, status: "completed", title: "Clip" }),
    );
  });

  it("publishes real byte progress while transferring", async () => {
    const firstChunk = deferred();
    const release = deferred();

    const sourceUrl = await listen(async (_request, response) => {
      response.writeHead(200, {
        "content-type": "video/mp4",
        "content-length": "2000",
      });
      response.write(Buffer.alloc(1000));
      firstChunk.resolve();
      await release.promise;
      response.end(Buffer.alloc(1000));
    });

    const job = makeJob();
    await saveJob(job);

    const pending = startDownload({ job, format: makeFormat(sourceUrl) }, { rootDir });
    await firstChunk.promise;

    // The server is holding the second half, so the job must be mid-transfer.
    const during = await waitForJob(job.id, (entry) => entry.progress > 0);
    expect(during.status).toBe("processing");
    expect(during.progress).toBe(50);

    release.resolve();
    const finished = await pending;

    expect(finished.status).toBe("completed");
    expect(finished.progress).toBe(100);
  });

  it("cancels an in-flight transfer and records it", async () => {
    const sourceUrl = await listen(async (_request, response) => {
      response.writeHead(200, {
        "content-type": "video/mp4",
        "content-length": "3000",
      });
      response.write(Buffer.alloc(1000));
      await new Promise((resolve) => setTimeout(resolve, 800));
      response.end(Buffer.alloc(2000));
    });

    const job = makeJob();
    await saveJob(job);

    const pending = startDownload({ job, format: makeFormat(sourceUrl) }, { rootDir });
    await new Promise((resolve) => setTimeout(resolve, 120));

    // Simulate the cancel route: abort locally *and* persist the status.
    await updateJob(job.id, { status: "cancelled" });
    requestCancel(job.id);

    const finished = await pending;

    expect(finished.status).toBe("cancelled");
    expect(finished.fileName).toBeUndefined();
    expect(resolveDownloadPath(finished, rootDir)).toBeNull();
    expect(recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );

    await expect(fs.readdir(path.join(rootDir, job.id))).rejects.toThrow();
  });

  it("notices cancellation persisted by another request without an abort", async () => {
    const sourceUrl = await listen(async (_request, response) => {
      response.writeHead(200, {
        "content-type": "video/mp4",
        "content-length": String(64 * 1024),
      });
      for (let i = 0; i < 16; i++) {
        response.write(Buffer.alloc(4096));
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      response.end();
    });

    const job = makeJob();
    await saveJob(job);

    
    const pending = startDownload({ job, format: makeFormat(sourceUrl) }, { rootDir });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await updateJob(job.id, { status: "cancelled" });

    const finished = await pending;
    expect(finished.status).toBe("cancelled");
  });

  it("fails cleanly when the source refuses the download", async () => {
    const sourceUrl = await listen((_request, response) => {
      response.writeHead(500);
      response.end("nope");
    });

    const job = makeJob();
    await saveJob(job);

    const finished = await startDownload({ job, format: makeFormat(sourceUrl) }, { rootDir });

    expect(finished.status).toBe("failed");
    expect(finished.error).toMatch(/HTTP 500/);
    expect(recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    await expect(fs.readdir(path.join(rootDir, job.id))).rejects.toThrow();
  });

  it("treats an empty response body as a failure", async () => {
    const sourceUrl = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "video/mp4" });
      response.end();
    });

    const job = makeJob();
    await saveJob(job);

    const finished = await startDownload({ job, format: makeFormat(sourceUrl) }, { rootDir });

    expect(finished.status).toBe("failed");
    expect(finished.error).toMatch(/empty file/i);
  });

  it("sanitizes the file name written to disk", async () => {
    const payload = Buffer.alloc(64, 1);
    const sourceUrl = await listen((_request, response) => {
      response.writeHead(200, { "content-length": String(payload.length) });
      response.end(payload);
    });

    const job = makeJob();
    await saveJob(job);

    const finished = await startDownload(
      { job, format: { ...makeFormat(sourceUrl), fileName: "../../etc/pass wd.mp4" } },
      { rootDir },
    );

    expect(finished.status).toBe("completed");
    expect(finished.fileName).toBe("pass_wd.mp4");

    const filePath = resolveDownloadPath(finished, rootDir)!;
    expect(filePath.startsWith(path.join(rootDir, job.id))).toBe(true);
  });
});
