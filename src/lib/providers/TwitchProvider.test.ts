import { afterEach, describe, expect, it, vi } from "vitest";

import { TwitchProvider, parseTwitchClipSlug } from "@/lib/providers/TwitchProvider";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TWITCH_CLIENT_ID;
});

describe("parseTwitchClipSlug", () => {
  it("parses Twitch clip URLs", () => {
    expect(parseTwitchClipSlug("https://clips.twitch.tv/FunnyClip123")).toBe("FunnyClip123");
    expect(parseTwitchClipSlug("https://www.twitch.tv/somechannel/clip/FunnyClip123")).toBe("FunnyClip123");
  });

  it("rejects invalid URLs", () => {
    expect(parseTwitchClipSlug("https://example.com/clip/x")).toBeNull();
    expect(parseTwitchClipSlug("not a url")).toBeNull();
  });
});

describe("TwitchProvider", () => {
  const provider = new TwitchProvider();

  it("supports Twitch clip URLs only", () => {
    expect(provider.supports("https://clips.twitch.tv/FunnyClip123")).toBe(true);
    expect(provider.supports("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("requires a client id", async () => {
    await expect(provider.analyzeVideo("https://clips.twitch.tv/FunnyClip123")).rejects.toThrow(/Client ID/i);
  });

  it("analyzes via Helix when client id is set", async () => {
    process.env.TWITCH_CLIENT_ID = "test-client-id";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "clip123",
              title: "Funny Clip",
              creator_name: "streamer",
              thumbnail_url: "https://clips-media-assets2.twitch.tv/thumb.jpg",
              duration: 30,
              url: "https://clips.twitch.tv/FunnyClip123",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://clips.twitch.tv/FunnyClip123");
    expect(analysis.video.title).toBe("Funny Clip");
    expect(analysis.video.formats).toEqual([]);
    expect(analysis.video.officialOptions?.length).toBeGreaterThan(0);
  });

  it("throws when createDownloadJob is called", () => {
    expect(() =>
      provider.createDownloadJob({ videoId: "x", url: "https://clips.twitch.tv/x", format: {} as never }),
    ).toThrow(/not available/i);
  });
});
