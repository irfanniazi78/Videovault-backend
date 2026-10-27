import type { DownloadJob, VideoMetadata } from "../types/video";

let currentMetadata: VideoMetadata | null = null;
let currentJob: DownloadJob | null = null;

export const session = {
  getMetadata: () => currentMetadata,
  setMetadata: (m: VideoMetadata | null) => {
    currentMetadata = m;
  },
  getJob: () => currentJob,
  setJob: (j: DownloadJob | null) => {
    currentJob = j;
  },
};
