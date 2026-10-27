import { describe, expect, it } from "vitest";

import { GET as startGET } from "@/app/api/auth/[provider]/start/route";
import { GET as callbackGET } from "@/app/api/auth/[provider]/callback/route";

function ctx(provider: string) {
  return { params: Promise.resolve({ provider }) };
}

describe("OAuth scaffolding routes", () => {
  it("start returns 501 with setup info for supported providers", async () => {
    const res = await startGET(new Request("http://localhost:3000/api/auth/youtube/start"), ctx("youtube"));
    expect(res.status).toBe(501);
    const json = (await res.json()) as { status: string; requiredEnv: string[]; redirectUri: string };
    expect(json.status).toBe("not-implemented");
    expect(json.requiredEnv).toContain("YOUTUBE_API_KEY");
    expect(json.redirectUri).toContain("/api/auth/youtube/callback");
  });

  it("start returns 404 for unknown providers", async () => {
    const res = await startGET(new Request("http://localhost:3000/api/auth/foo/start"), ctx("foo"));
    expect(res.status).toBe(404);
  });

  it("callback returns 501", async () => {
    const res = await callbackGET(new Request("http://localhost:3000/api/auth/youtube/callback"), ctx("youtube"));
    expect(res.status).toBe(501);
  });
});
