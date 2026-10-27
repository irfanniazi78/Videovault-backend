import { afterEach, describe, expect, it, vi } from "vitest";

import { NasaProvider, parseNasaId } from "@/lib/providers/NasaProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseNasaId", () => {
  it("parses NASA detail URLs", () => {
    expect(parseNasaId("https://images.nasa.gov/details/NDTV000908_Apollo")).toBe("NDTV000908_Apollo");
  });

  it("rejects other URLs", () => {
    expect(parseNasaId("https://example.com/details/x")).toBeNull();
    expect(parseNasaId("not a url")).toBeNull();
  });
});

describe("NasaProvider", () => {
  const provider = new NasaProvider();

  it("supports NASA detail URLs only", () => {
    expect(provider.supports("https://images.nasa.gov/details/NDTV000908_Apollo")).toBe(true);
    expect(provider.supports("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("analyzes via NASA APIs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search?")) {
        return new Response(
          JSON.stringify({
            collection: {
              items: [
                {
                  data: [{ nasa_id: "NDTV000908_Apollo", title: "Apollo Digest", description: "A video." }],
                  links: [{ href: "https://images-assets.nasa.gov/video/x/thumb.jpg", rel: "preview" }],
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          collection: {
            items: [{ href: "https://images-assets.nasa.gov/video/x/x~orig.mp4" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await provider.analyzeVideo("https://images.nasa.gov/details/NDTV000908_Apollo");
    expect(analysis.video.title).toBe("Apollo Digest");
    expect(analysis.video.formats.length).toBeGreaterThan(0);
    expect(analysis.video.formats[0].container).toBe("mp4");
  });

  it("throws when no MP4 files exist", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search?")) {
        return new Response(
          JSON.stringify({
            collection: {
              items: [{ data: [{ nasa_id: "X", title: "X" }], links: [] }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ collection: { items: [{ href: "https://x/y.jpg" }] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(provider.analyzeVideo("https://images.nasa.gov/details/X")).rejects.toThrow(/no downloadable MP4/i);
  });
});
