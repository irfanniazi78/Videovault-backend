import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoInfoCard } from "@/components/VideoInfoCard";
import type { DownloadJob, VideoMetadata } from "@/lib/types/video";

const metadata: VideoMetadata = {
  id: "video-1",
  url: "https://example.com/watch?v=1",
  title: "A very good video",
  durationSeconds: 125,
  formats: [
    { id: "mp4-1080p", container: "mp4", quality: "1080p", label: "1080p MP4", fileSizeBytes: 60_000_000 },
    { id: "webm-1080p", container: "webm", quality: "1080p", label: "1080p WebM", fileSizeBytes: 50_000_000 },
    { id: "mp4-720p", container: "mp4", quality: "720p", label: "720p MP4", fileSizeBytes: 30_000_000 },
  ],
  status: "ready",
};

function makeJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: "job-1",
    videoId: "video-1",
    url: metadata.url,
    formatId: "mp4-1080p",
    status: "processing",
    progress: 42,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = () => {};

describe("VideoInfoCard", () => {
  it("renders title, duration, quality and format selectors", () => {
    render(
      <VideoInfoCard
        metadata={metadata}
        job={null}
        isCreating={false}
        createError={null}
        onDownload={noop}
        onCancel={noop}
      />,
    );

    expect(screen.getByText("A very good video")).toBeInTheDocument();
    expect(screen.getByText("2:05")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1080p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "720p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^MP4/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download/ })).toBeInTheDocument();
  });

  it("calls onDownload with the selected format id", () => {
    const onDownload = vi.fn();
    render(
      <VideoInfoCard
        metadata={metadata}
        job={null}
        isCreating={false}
        createError={null}
        onDownload={onDownload}
        onCancel={noop}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "720p" }));
    fireEvent.click(screen.getByRole("button", { name: /Download/ }));

    expect(onDownload).toHaveBeenCalledWith("mp4-720p");
  });

  it("shows progress and a cancel action while downloading", () => {
    render(
      <VideoInfoCard
        metadata={metadata}
        job={makeJob()}
        isCreating={false}
        createError={null}
        onDownload={noop}
        onCancel={noop}
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("shows the error and a retry action when a job fails", () => {
    render(
      <VideoInfoCard
        metadata={metadata}
        job={makeJob({ status: "failed", progress: 0, error: "Provider rejected the request." })}
        isCreating={false}
        createError={null}
        onDownload={noop}
        onCancel={noop}
      />,
    );

    expect(screen.getByText("Provider rejected the request.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry download" })).toBeInTheDocument();
  });

  it("shows a completion message when a job succeeds", () => {
    render(
      <VideoInfoCard
        metadata={metadata}
        job={makeJob({ status: "completed", progress: 100 })}
        isCreating={false}
        createError={null}
        onDownload={noop}
        onCancel={noop}
      />,
    );

    expect(screen.getByText("Download completed successfully.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download again" })).toBeInTheDocument();

    const saveLink = screen.getByRole("link", { name: /Save file/i });
    expect(saveLink).toHaveAttribute("href", "/api/jobs/job-1/file");
    expect(saveLink).toHaveAttribute("download");
  });

  it("offers the finished file through the job file endpoint", () => {
    render(
      <VideoInfoCard
        metadata={metadata}
        job={makeJob({ id: "job-42", status: "completed", progress: 100 })}
        isCreating={false}
        createError={null}
        onDownload={noop}
        onCancel={noop}
      />,
    );

    expect(screen.getByRole("link", { name: /Save file/i })).toHaveAttribute(
      "href",
      "/api/jobs/job-42/file",
    );
  });
});
