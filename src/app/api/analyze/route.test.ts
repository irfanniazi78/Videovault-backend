import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/analyze/route";

function analyzeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const metadataPayload = {
  metadata: { identifier: "route-test-item", title: "Route Test Clip", mediatype: "movies" },
  files: [
    { name: "clip.mp4", format: "h.264", size: "2048", length: "12.4", height: "480" },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/analyze", () => {
  it("rejects invalid URLs with a helpful message", async () => {
    const response = await POST(analyzeRequest({ url: "not a url" }));
    expect(response.status).toBe(400);

    const json = (await response.json()) as { error: string };
    expect(json.error).toMatch(/valid URL/i);
  });

  it("rejects a missing URL", async () => {
    const response = await POST(analyzeRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON bodies", async () => {
    const response = await POST(analyzeRequest("{oops"));
    expect(response.status).toBe(400);
  });

  it("explains which sources are supported instead of pretending to analyze others", async () => {
    const response = await POST(
      analyzeRequest({ url: "https://www.facebook.com/watch/?v=123456" }),
    );
    expect(response.status).toBe(422);

    const json = (await response.json()) as { error: string };
    expect(json.error).toMatch(/Internet Archive/i);
    expect(json.error).toMatch(/not supported/i);
  });

  it("returns real metadata for a supported Internet Archive item", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(metadataPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      analyzeRequest({ url: "https://archive.org/details/route-test-item" }),
    );
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      video: { id: string; title: string; durationSeconds: number; formats: { id: string }[] };
    };
    expect(json.video.id).toBe("route-test-item");
    expect(json.video.title).toBe("Route Test Clip");
    expect(json.video.durationSeconds).toBe(12);
    expect(json.video.formats).toEqual([
      expect.objectContaining({ id: "mp4-480p", quality: "480p", fileSizeBytes: 2048 }),
    ]);
  });

  it("surfaces provider errors with a 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );

    const response = await POST(
      analyzeRequest({ url: "https://archive.org/details/missing-item" }),
    );
    expect(response.status).toBe(422);

    const json = (await response.json()) as { error: string };
    expect(json.error).toMatch(/couldn't find/i);
  });

  it("does not leak server-only source URLs to the browser", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(metadataPayload), { status: 200 })),
    );

    const response = await POST(
      analyzeRequest({ url: "https://archive.org/details/route-test-item-2" }),
    );
    const json = (await response.json()) as { video: { formats: Record<string, unknown>[] } };

    expect(JSON.stringify(json)).not.toContain("archive.org/download");
  });
});
