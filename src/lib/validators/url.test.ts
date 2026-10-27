import { describe, expect, it } from "vitest";

import { isValidVideoUrl, validateUrlInput } from "@/lib/validators/url";

describe("validateUrlInput", () => {
  it("accepts a valid absolute https URL", () => {
    const result = validateUrlInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toEqual({ valid: true, normalized: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  });

  it("normalizes a protocol-relative input to https", () => {
    const result = validateUrlInput("youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.normalized).toContain("https://");
    }
  });

  it("accepts localhost URLs for local development", () => {
    expect(validateUrlInput("http://localhost:3000/video").valid).toBe(true);
  });

  it("rejects non-http protocols", () => {
    const result = validateUrlInput("ftp://example.com/file.mp4");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/http/i);
    }
  });

  it("rejects malformed URLs", () => {
    expect(validateUrlInput("not a url at all").valid).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(validateUrlInput("javascript:alert(1)").valid).toBe(false);
  });

  it("rejects inputs that are too short", () => {
    const result = validateUrlInput("abc");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/at least/i);
    }
  });
});

describe("isValidVideoUrl", () => {
  it("returns true for valid URLs and false otherwise", () => {
    expect(isValidVideoUrl("https://vimeo.com/123456")).toBe(true);
    expect(isValidVideoUrl("definitely-not-a-url")).toBe(false);
  });
});
