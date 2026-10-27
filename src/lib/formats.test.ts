import { describe, expect, it } from "vitest";

import type { VideoFormat } from "@/lib/types/video";
import { availableQualities, formatLabel, qualityRank, sortFormats } from "@/lib/formats";

const formats: VideoFormat[] = [
  { id: "webm-1080p", container: "webm", quality: "1080p", label: "1080p WebM", fileSizeBytes: 50_000_000 },
  { id: "mp4-720p", container: "mp4", quality: "720p", label: "720p MP4", fileSizeBytes: 30_000_000 },
  { id: "mp4-1080p", container: "mp4", quality: "1080p", label: "1080p MP4", fileSizeBytes: 60_000_000 },
];

describe("qualityRank", () => {
  it("ranks numeric qualities numerically", () => {
    expect(qualityRank("1080p")).toBe(1080);
    expect(qualityRank("720p")).toBe(720);
  });
});

describe("sortFormats", () => {
  it("sorts by quality descending and prefers mp4", () => {
    const sorted = sortFormats(formats);
    expect(sorted[0].id).toBe("mp4-1080p");
    expect(sorted[1].id).toBe("webm-1080p");
    expect(sorted[2].id).toBe("mp4-720p");
  });
});

describe("availableQualities", () => {
  it("returns unique qualities highest first", () => {
    const qualities = availableQualities(formats);
    expect(qualities.map((q) => q.quality)).toEqual(["1080p", "720p"]);
  });
});

describe("formatLabel", () => {
  it("builds a human readable label", () => {
    const label = formatLabel(formats[0]);
    expect(label).toContain("1080p");
    expect(label).toContain("WEBM");
    expect(label).toContain("·");
  });
});
