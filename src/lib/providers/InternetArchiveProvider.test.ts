import { afterEach, describe, expect, it, vi } from "vitest";

import {
  InternetArchiveProvider,
  buildArchiveAnalysis,
  buildSourceUrl,
  parseArchiveIdentifier,
  type InternetArchiveMetadata,
} from "@/lib/providers/InternetArchiveProvider";

const metadataFixture: InternetArchiveMetadata = {
  metadata: {
    identifier: "BigBuckBunny_124",
    title: "Big Buck Bunny",
    description: "A comedy about a well-tempered rabbit.\n\nLicensed openly.",
    mediatype: "movies",
  },
  files: [
    { name: "__ia_thumb.jpg", format: "Item Tile", size: "8416" },
    { name: "BigBuckBunny_124.thumbs/Content/clip_000001.jpg", format: "Thumbnail", size: "10377" },
    {
      name: "Content/big_buck_bunny_720p_surround.mp4",
      format: "h.264",
      size: "61878609",
      length: "596.5",
      height: "360",
      width: "640",
    },
    {
      name: "Content/big_buck_bunny_720p_surround.ogv",
      format: "Ogg Video",
      size: "46935223",
      length: "596.48",
      height: "300",
    },
    { name: "Content/restricted.mp4", format: "h.264", size: "999", private: "true" },
    { name: "BigBuckBunny_124_meta.xml", format: "Metadata", size: "1514" },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseArchiveIdentifier", () => {
  it("accepts details, download and embed URLs", () => {
    expect(parseArchiveIdentifier("https://archive.org/details/BigBuckBunny_124")).toBe(
      "BigBuckBunny_124",
    );
    expect(
      parseArchiveIdentifier("https://www.archive.org/download/BigBuckBunny_124/clip.mp4"),
    ).toBe("BigBuckBunny_124");
    expect(parseArchiveIdentifier("https://archive.org/embed/BigBuckBunny_124")).toBe(
      "BigBuckBunny_124",
    );
  });

  it("rejects other hosts and non-item paths", () => {
    expect(parseArchiveIdentifier("https://example.com/details/thing")).toBeNull();
    expect(parseArchiveIdentifier("https://archive.org/search?q=bunny")).toBeNull();
    expect(parseArchiveIdentifier("https://archive.org/details/")).toBeNull();
    expect(parseArchiveIdentifier("not a url")).toBeNull();
  });

  it("rejects identifiers that could alter the request path", () => {
    expect(parseArchiveIdentifier("https://archive.org/details/..%2F..%2Fadmin")).toBeNull();
    expect(parseArchiveIdentifier("https://archive.org/details/a%20b")).toBeNull();
  });
});

describe("buildArchiveAnalysis", () => {
  it("maps real item metadata into the app's video shape", () => {
    const { video, formats } = buildArchiveAnalysis("BigBuckBunny_124", metadataFixture);

    expect(video.id).toBe("BigBuckBunny_124");
    expect(video.title).toBe("Big Buck Bunny");
    expect(video.durationSeconds).toBe(597);
    expect(video.thumbnailUrl).toBe(
      "https://archive.org/services/img/BigBuckBunny_124",
    );
    expect(video.description).toBe("A comedy about a well-tempered rabbit. Licensed openly.");
    expect(video.status).toBe("ready");

    expect(video.formats).toHaveLength(2);
    expect(video.formats.map((format) => format.quality)).toEqual(["360p", "300p"]);
    expect(video.formats[0]).toMatchObject({
      id: "mp4-360p",
      container: "mp4",
      quality: "360p",
      label: "360p MP4 · 59 MB",
      fileSizeBytes: 61878609,
    });

    // Server-only data must never be part of the client payload.
    expect("sourceUrl" in video.formats[0]).toBe(false);
    expect("fileName" in video.formats[0]).toBe(false);

    expect(formats["mp4-360p"].sourceUrl).toBe(
      "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4",
    );
    expect(formats["ogv-300p"].fileName).toBe("big_buck_bunny_720p_surround.ogv");
  });

  it("skips private files and thumbnails", () => {
    const { video, formats } = buildArchiveAnalysis("BigBuckBunny_124", metadataFixture);
    expect(Object.keys(formats)).toHaveLength(2);
    expect(video.formats.some((format) => format.label.includes("restricted"))).toBe(false);
  });

  it("falls back to 'Original' when no height is reported", () => {
    const { video } = buildArchiveAnalysis("item", {
      metadata: { mediatype: "movies", title: "Clip" },
      files: [{ name: "clip.webm" }],
    });

    expect(video.formats[0]).toMatchObject({
      id: "webm-original",
      quality: "Original",
      label: "Original WEBM",
    });
    expect(video.durationSeconds).toBeUndefined();
  });

  it("gives duplicate renditions unique ids", () => {
    const { video } = buildArchiveAnalysis("item", {
      metadata: { mediatype: "movies" },
      files: [
        { name: "a.mp4", height: "720", size: "10" },
        { name: "b.mp4", height: "720", size: "20" },
      ],
    });

    expect(video.formats.map((format) => format.id)).toEqual(["mp4-720p", "mp4-720p-2"]);
  });

  it("refuses items that are not video", () => {
    expect(() =>
      buildArchiveAnalysis("item", {
        metadata: { mediatype: "audio" },
        files: [{ name: "song.mp4", size: "1" }],
      }),
    ).toThrow(/not a video/i);
  });

  it("refuses items without public video files", () => {
    expect(() =>
      buildArchiveAnalysis("item", {
        metadata: { mediatype: "movies" },
        files: [{ name: "notes.txt", size: "1" }],
      }),
    ).toThrow(/no downloadable video files/i);
  });

  it("parses durations given as clock time", () => {
    const { video } = buildArchiveAnalysis("item", {
      metadata: { mediatype: "movies" },
      files: [{ name: "clip.mp4", length: "1:02:03", height: "480" }],
    });
    expect(video.durationSeconds).toBe(3723);
  });
});

describe("buildSourceUrl", () => {
  it("encodes each path segment", () => {
    expect(buildSourceUrl("my item", "folder/clip one.mp4")).toBe(
      "https://archive.org/download/my%20item/folder/clip%20one.mp4",
    );
  });
});

describe("InternetArchiveProvider", () => {
  const provider = new InternetArchiveProvider();

  it("supports archive.org item URLs only", () => {
    expect(provider.supports("https://archive.org/details/BigBuckBunny_124")).toBe(true);
    expect(provider.supports("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("analyzes an item using the public metadata API", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(metadataFixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://archive.org/details/BigBuckBunny_124");

    expect(analysis.video.title).toBe("Big Buck Bunny");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://archive.org/metadata/BigBuckBunny_124",
    );
  });

  it("caches metadata for repeated lookups", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(metadataFixture), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await provider.analyzeVideo("https://archive.org/details/cached-item");
    await provider.analyzeVideo("https://archive.org/details/cached-item");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports missing items clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));

    await expect(
      provider.analyzeVideo("https://archive.org/details/does-not-exist"),
    ).rejects.toThrow(/couldn't find that internet archive item/i);
  });

  it("reports restricted items clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));

    await expect(
      provider.analyzeVideo("https://archive.org/details/private-item"),
    ).rejects.toThrow(/restricted/i);
  });

  it("reports upstream failures with the status code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    await expect(provider.analyzeVideo("https://archive.org/details/broken")).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("creates a queued job for a resolved format", () => {
    const { formats } = buildArchiveAnalysis("BigBuckBunny_124", metadataFixture);
    const job = provider.createDownloadJob({
      videoId: "BigBuckBunny_124",
      url: "https://archive.org/details/BigBuckBunny_124",
      format: formats["mp4-360p"],
    });

    expect(job).toMatchObject({
      videoId: "BigBuckBunny_124",
      formatId: "mp4-360p",
      status: "queued",
      progress: 0,
    });
    expect(job.id).toMatch(/^job-/);
  });
});
