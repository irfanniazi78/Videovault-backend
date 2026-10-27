import { afterEach, describe, expect, it, vi } from "vitest";

import { YouTubeProvider, parseYouTubeId } from "@/lib/providers/YouTubeProvider";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YOUTUBE_API_KEY;
});

describe("parseYouTubeId", () => {
  it("parses common YouTube URL shapes", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects invalid or non-YouTube URLs", () => {
    expect(parseYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYouTubeId("not a url")).toBeNull();
  });
});

describe("YouTubeProvider", () => {
  const provider = new YouTubeProvider();

  it("supports YouTube URLs only", () => {
    expect(provider.supports("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(provider.supports("https://vimeo.com/123456")).toBe(false);
  });

  it("analyzes via oEmbed when no API key is set", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          title: "Rick Astley - Never Gonna Give You Up",
          author_name: "Rick Astley",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(analysis.video.title).toBe("Rick Astley - Never Gonna Give You Up");
    expect(analysis.video.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(analysis.video.formats).toEqual([]);
    expect(analysis.video.officialOptions?.length).toBeGreaterThan(0);
  });

  it("uses the Data API when a key is configured", async () => {
    process.env.YOUTUBE_API_KEY = "test-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                title: "API Title",
                description: "API description",
                channelTitle: "API Channel",
                thumbnails: { high: { url: "https://img.example/thumb.jpg" } },
              },
              contentDetails: { duration: "PT1M30S" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(analysis.video.title).toBe("API Title");
    expect(analysis.video.durationSeconds).toBe(90);
    expect(analysis.video.description).toBe("API description");
  });

  it("throws when createDownloadJob is called", () => {
    expect(() => provider.createDownloadJob({ videoId: "x", url: "https://youtube.com/watch?v=x", format: {} as never })).toThrow(
      /not available/i,
    );
  });
});
