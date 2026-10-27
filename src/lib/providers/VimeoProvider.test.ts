import { afterEach, describe, expect, it, vi } from "vitest";

import { VimeoProvider, parseVimeoId } from "@/lib/providers/VimeoProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseVimeoId", () => {
  it("parses Vimeo URL shapes", () => {
    expect(parseVimeoId("https://vimeo.com/22439234")).toBe("22439234");
    expect(parseVimeoId("https://player.vimeo.com/video/22439234")).toBe("22439234");
  });

  it("rejects invalid URLs", () => {
    expect(parseVimeoId("https://example.com/123456")).toBeNull();
    expect(parseVimeoId("not a url")).toBeNull();
  });
});

describe("VimeoProvider", () => {
  const provider = new VimeoProvider();

  it("supports Vimeo URLs only", () => {
    expect(provider.supports("https://vimeo.com/22439234")).toBe(true);
    expect(provider.supports("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("analyzes via oEmbed", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          title: "The Mountain",
          author_name: "TSO Photography",
          thumbnail_url: "https://i.vimeocdn.com/video/x.jpg",
          duration: 185,
          description: "A timelapse.",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://vimeo.com/22439234");
    expect(analysis.video.title).toBe("The Mountain");
    expect(analysis.video.durationSeconds).toBe(185);
    expect(analysis.video.formats).toEqual([]);
    expect(analysis.video.officialOptions?.length).toBeGreaterThan(0);
  });

  it("reports missing videos clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));

    await expect(provider.analyzeVideo("https://vimeo.com/999999")).rejects.toThrow(/couldn't find/i);
  });

  it("throws when createDownloadJob is called", () => {
    expect(() => provider.createDownloadJob({ videoId: "x", url: "https://vimeo.com/x", format: {} as never })).toThrow(
      /not available/i,
    );
  });
});
