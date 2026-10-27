import { afterEach, describe, expect, it, vi } from "vitest";

import { DailymotionProvider, parseDailymotionId } from "@/lib/providers/DailymotionProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseDailymotionId", () => {
  it("parses Dailymotion URL shapes", () => {
    expect(parseDailymotionId("https://www.dailymotion.com/video/xbri2vm")).toBe("xbri2vm");
    expect(parseDailymotionId("https://dai.ly/xbri2vm")).toBe("xbri2vm");
  });

  it("rejects invalid URLs", () => {
    expect(parseDailymotionId("https://example.com/video/x")).toBeNull();
    expect(parseDailymotionId("not a url")).toBeNull();
  });
});

describe("DailymotionProvider", () => {
  const provider = new DailymotionProvider();

  it("supports Dailymotion URLs only", () => {
    expect(provider.supports("https://www.dailymotion.com/video/xbri2vm")).toBe(true);
    expect(provider.supports("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("analyzes via oEmbed", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          title: "Test Video",
          author_name: "Author",
          thumbnail_url: "https://s1.dmcdn.net/v/x.jpg",
          duration: 120,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://www.dailymotion.com/video/xbri2vm");
    expect(analysis.video.title).toBe("Test Video");
    expect(analysis.video.durationSeconds).toBe(120);
    expect(analysis.video.formats).toEqual([]);
    expect(analysis.video.officialOptions?.length).toBeGreaterThan(0);
  });

  it("reports missing videos clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));

    await expect(provider.analyzeVideo("https://www.dailymotion.com/video/missing")).rejects.toThrow(/couldn't find/i);
  });

  it("throws when createDownloadJob is called", () => {
    expect(() =>
      provider.createDownloadJob({ videoId: "x", url: "https://dailymotion.com/video/x", format: {} as never }),
    ).toThrow(/not available/i);
  });
});
