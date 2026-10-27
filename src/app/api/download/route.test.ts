import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/download/route";
import { startDownload } from "@/lib/downloads/worker";

vi.mock("@/lib/downloads/worker", () => ({
  startDownload: vi.fn(async () => undefined),
}));

let dataDir: string;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "videovault-route-"));
  process.env.VIDEOVAULT_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.VIDEOVAULT_DATA_DIR;
  await fs.rm(dataDir, { recursive: true, force: true });
});

function downloadRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/download", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function stubMetadata(identifier: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          metadata: { identifier, title: "Download Test Clip", mediatype: "movies" },
          files: [{ name: "clip.mp4", size: "4096", length: "30", height: "720" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(startDownload).mockClear();
});

describe("POST /api/download", () => {
  it("requires a format id", async () => {
    const response = await POST(
      downloadRequest({ url: "https://archive.org/details/dl-test-a" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/format is required/i);
  });

  it("rejects invalid URLs", async () => {
    const response = await POST(
      downloadRequest({ url: "not a url", formatId: "mp4-720p" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects unsupported sources without contacting them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      downloadRequest({ url: "https://www.facebook.com/watch/?v=123456", formatId: "mp4-720p" }),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/Internet Archive/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a format id that the source no longer offers", async () => {
    stubMetadata("dl-test-b");

    const response = await POST(
      downloadRequest({ url: "https://archive.org/details/dl-test-b", formatId: "mp4-9999p" }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/no longer available/i);
    expect(startDownload).not.toHaveBeenCalled();
  });

  it("creates a queued job and starts the real transfer", async () => {
    stubMetadata("dl-test-c");

    const response = await POST(
      downloadRequest({
        url: "https://archive.org/details/dl-test-c",
        videoId: "dl-test-c",
        formatId: "mp4-720p",
      }),
    );

    expect(response.status).toBe(201);
    const json = (await response.json()) as {
      job: { id: string; status: string; progress: number; formatId: string };
    };

    expect(json.job.status).toBe("queued");
    expect(json.job.progress).toBe(0);
    expect(json.job.formatId).toBe("mp4-720p");

    expect(startDownload).toHaveBeenCalledTimes(1);
    const call = vi.mocked(startDownload).mock.calls[0][0];
    expect(call.format.sourceUrl).toBe(
      "https://archive.org/download/dl-test-c/clip.mp4",
    );
    expect(call.format.fileName).toBe("clip.mp4");
    expect(call.title).toBe("Download Test Clip");
    expect(call.formatLabel).toBe("720p MP4 · 4 KB");

    // The response must not expose upstream URLs.
    expect(JSON.stringify(json)).not.toContain("archive.org/download");
  });
});
