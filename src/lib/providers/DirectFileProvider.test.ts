import { afterEach, describe, expect, it, vi } from "vitest";

import { DirectFileProvider, isDirectVideoUrl } from "@/lib/providers/DirectFileProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isDirectVideoUrl", () => {
  it("detects video file extensions", () => {
    expect(isDirectVideoUrl("https://example.com/clip.mp4")).toBe(true);
    expect(isDirectVideoUrl("https://example.com/clip.webm")).toBe(true);
    expect(isDirectVideoUrl("https://example.com/page.html")).toBe(false);
  });
});

describe("DirectFileProvider", () => {
  const provider = new DirectFileProvider();

  it("supports direct video URLs only", () => {
    expect(provider.supports("https://example.com/clip.mp4")).toBe(true);
    expect(provider.supports("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("analyzes via HEAD", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "12345" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://example.com/clip.mp4");
    expect(analysis.video.title).toBe("clip.mp4");
    expect(analysis.video.formats).toHaveLength(1);
    expect(analysis.video.formats[0].container).toBe("mp4");
    expect(analysis.formats[analysis.video.formats[0].id].sourceUrl).toBe("https://example.com/clip.mp4");
  });

  it("creates a queued job", () => {
    const job = provider.createDownloadJob({
      videoId: "https://example.com/clip.mp4",
      url: "https://example.com/clip.mp4",
      format: {
        id: "mp4-original",
        container: "mp4",
        quality: "Original",
        label: "Original MP4",
        sourceUrl: "https://example.com/clip.mp4",
        fileName: "clip.mp4",
      },
    });
    expect(job.status).toBe("queued");
  });
});
