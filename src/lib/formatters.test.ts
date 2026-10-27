import { describe, expect, it } from "vitest";

import { formatBytes, formatDuration } from "@/lib/formatters";

describe("formatDuration", () => {
  it("formats seconds as M:SS", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
  });

  it("formats long durations as H:MM:SS", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("returns a placeholder when duration is unknown", () => {
    expect(formatDuration(undefined)).toBe("—");
  });
});

describe("formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("returns a placeholder when bytes are unknown", () => {
    expect(formatBytes(undefined)).toBe("—");
  });
});
