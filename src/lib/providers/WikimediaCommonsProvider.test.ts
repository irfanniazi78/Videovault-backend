import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WikimediaCommonsProvider,
  buildCommonsAnalysis,
  containerFromMime,
  parseCommonsTitle,
  type CommonsImageInfo,
} from "@/lib/providers/WikimediaCommonsProvider";

const imageInfo: CommonsImageInfo = {
  url: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Big_Buck_Bunny_small.ogv",
  size: 12345,
  mime: "video/ogg",
  width: 320,
  height: 240,
  mediatype: "VIDEO",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseCommonsTitle", () => {
  it("accepts Commons file pages", () => {
    expect(parseCommonsTitle("https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_small.ogv")).toBe(
      "File:Big Buck Bunny small.ogv",
    );
  });

  it("rejects other hosts and non-file pages", () => {
    expect(parseCommonsTitle("https://example.com/wiki/File:x.ogv")).toBeNull();
    expect(parseCommonsTitle("https://commons.wikimedia.org/wiki/Category:Videos")).toBeNull();
    expect(parseCommonsTitle("not a url")).toBeNull();
  });
});

describe("containerFromMime", () => {
  it("maps mime types and falls back to extension", () => {
    expect(containerFromMime("video/ogg", "clip.ogv")).toBe("ogv");
    expect(containerFromMime("video/mp4", "clip.mp4")).toBe("mp4");
    expect(containerFromMime(undefined, "clip.webm")).toBe("webm");
    expect(containerFromMime("application/octet-stream", "clip.txt")).toBeNull();
  });
});

describe("buildCommonsAnalysis", () => {
  it("builds metadata and a downloadable format", () => {
    const { video, formats } = buildCommonsAnalysis("File:Big_Buck_Bunny_small.ogv", imageInfo);

    expect(video.title).toBe("Big_Buck_Bunny_small.ogv");
    expect(video.formats).toHaveLength(1);
    expect(video.formats[0]).toMatchObject({
      id: "ogv-240p",
      container: "ogv",
      quality: "240p",
      fileSizeBytes: 12345,
    });
    expect(Object.keys(formats)).toEqual(["ogv-240p"]);
    expect(formats["ogv-240p"].sourceUrl).toBe(imageInfo.url);
    expect(video.officialOptions?.[0]?.label).toMatch(/Wikimedia Commons/i);
  });

  it("throws for non-video files", () => {
    expect(() =>
      buildCommonsAnalysis("File:photo.jpg", { ...imageInfo, mime: "image/jpeg", url: "https://x/y.jpg" }),
    ).toThrow(/not a video/i);
  });
});

describe("WikimediaCommonsProvider", () => {
  const provider = new WikimediaCommonsProvider();

  it("supports Commons file URLs only", () => {
    expect(provider.supports("https://commons.wikimedia.org/wiki/File:Clip.ogv")).toBe(true);
    expect(provider.supports("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("analyzes a file via the MediaWiki API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          query: {
            pages: {
              "-1": {
                title: "File:Clip.ogv",
                imageinfo: [imageInfo],
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://commons.wikimedia.org/wiki/File:Clip.ogv");
    expect(analysis.video.title).toBe("Clip.ogv");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = (fetchMock as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain("commons.wikimedia.org/w/api.php");
  });

  it("reports missing files clearly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ query: { pages: { "-1": { missing: true } } } }), { status: 200 }),
      ),
    );

    await expect(provider.analyzeVideo("https://commons.wikimedia.org/wiki/File:Missing.ogv")).rejects.toThrow(
      /couldn't find/i,
    );
  });

  it("creates a queued job", () => {
    const { formats } = buildCommonsAnalysis("File:Clip.ogv", imageInfo);
    const job = provider.createDownloadJob({
      videoId: "File:Clip.ogv",
      url: "https://commons.wikimedia.org/wiki/File:Clip.ogv",
      format: formats["ogv-240p"],
    });
    expect(job.status).toBe("queued");
    expect(job.id).toMatch(/^job-/);
  });
});
