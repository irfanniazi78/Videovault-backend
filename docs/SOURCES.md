# Supported Video Sources

VideoVault only ever points at public video sources that can legally and reliably be
downloaded through official, documented channels. The app refuses to analyze or download
from any source whose terms do not permit third-party downloads (DRM, paywalls, authentication
walls, platform terms) — it never bypasses such restrictions.

## Currently supported

### Internet Archive (`archive.org`) — ✅ implemented

VideoVault supports public Internet Archive items, for example:

- `https://archive.org/details/BigBuckBunny_124`
- `https://archive.org/details/big_buck_bunny_720p_1mb`
- `https://archive.org/download/{identifier}/{file}` (file-level links)
- `https://archive.org/embed/{identifier}`

How it works:

1. The app calls the official public metadata API:
   `GET https://archive.org/metadata/{identifier}` (JSON).
2. It maps the item's files into renditions with a stable format id, e.g. `mp4-720p` or
   `ogv-300p`, including container, quality label, approximate size and duration.
3. The chosen format is fetched from a public file URL on the same origin
   (`https://archive.org/download/{identifier}/{file}`).
4. The download is streamed to the server (`data/downloads/{jobId}/`) with real byte progress,
   then served back to the browser via `/api/jobs/{id}/file`.

Requirements / notes:

- **No API key or credentials are required** — the Internet Archive metadata API is public.
- Only items that are publicly available are accepted; restricted items fail with a clear
  "restricted" message.
- Metadata responses are cached for 5 minutes per item to avoid hammering the Archive API.

### Other platforms

YouTube, Vimeo, Dailymotion, TikTok, Instagram, Facebook, X/Twitter and similar platforms
are **not** supported as download sources. Their terms of service generally do not permit
third-party downloads, and VideoVault does not attempt to bypass DRM, authentication,
paywalls or platform restrictions.

For these, VideoVault provides metadata and official viewing/download options where
available (see the per-platform sections below), and an honest explanation otherwise.

## Data and job storage

- Job state is persisted to `data/jobs.json` (or `$VIDEOVAULT_DATA_DIR/jobs.json`).
- Finished downloads are stored under `data/downloads/{jobId}/` (or
  `$VIDEOVAULT_DOWNLOAD_DIR`), named after the sanitized source file.
- Both directories are git-ignored and contain no media outside the user-local data dir.

### Wikimedia Commons (`commons.wikimedia.org`) — ✅ implemented (metadata + downloads)

Supports public file pages, e.g. `https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_small.ogv`.

- Uses the official MediaWiki API (`action=query&prop=imageinfo`).
- Returns direct file URLs for freely licensed media.
- No API key required.
- **Live verification note:** Wikimedia Commons was DNS-blocked in the development environment
  used for this project, so live end-to-end verification could not be performed there. The
  provider is covered by mocked unit tests; run it in an environment with network access to
  `commons.wikimedia.org` to verify live.

### YouTube (`youtube.com`, `youtu.be`) — ✅ metadata only

- oEmbed (no key) for title, author, thumbnail; optional `YOUTUBE_API_KEY` (Data API v3) for
  richer metadata (description, duration).
- **No downloads**: YouTube does not provide a public download API. VideoVault shows metadata
  and official links only (watch link, YouTube Studio for your own uploads).
- No API key required for basic metadata.

### Vimeo (`vimeo.com`) — ✅ metadata only

- oEmbed (no key) for title, author, thumbnail, duration.
- **No downloads**: Vimeo does not allow third-party downloads of other users' videos.
- Official links provided (watch, owner-only download via Vimeo manage).

### Dailymotion (`dailymotion.com`, `dai.ly`) — ✅ metadata only

- oEmbed (no key) for title, author, thumbnail, duration.
- **No downloads**: Dailymotion does not provide a public third-party download API.
- Official watch link provided.

These platforms do not provide public APIs for downloading third-party content. VideoVault
returns an honest explanation plus official viewing/download options (e.g. "Download your
information" links). OAuth scaffolding for own-content flows exists under `/api/auth/...` but
is not enabled.

### Direct video file (any `http(s)` URL ending in a video extension) — ✅ real download

Supports direct links to media files, e.g. `https://example.com/clip.mp4`.

- No API key. HEAD request for size/type; streams the file with progress.
- Only use with content you are permitted to download.

### NASA Image and Video Library (`images.nasa.gov`) — ✅ real download (public domain)

Supports detail pages, e.g. `https://images.nasa.gov/details/NDTV000908_Apollo_Digest_Series_Spacecraft_for_Apollo`.

- Uses the official NASA Image and Video Library API (no key).
- Returns direct MP4 URLs (orig/large/medium/small).
- Public domain media; verify usage rights on the item page.

### Twitch (`clips.twitch.tv`, `twitch.tv/.../clip/...`) — ✅ metadata only

- Requires a free Twitch Client ID (`TWITCH_CLIENT_ID`) for Helix API access.
- **No downloads**: Twitch does not provide a public download API.
- Official watch link provided.

### Optional stock libraries (not implemented)

Pexels and Pixabay offer official APIs with free API keys and downloadable MP4s. They are not
implemented yet; add them as providers if needed.

## OAuth scaffolding (not enabled)

Routes under `/api/auth/{provider}/start` and `/api/auth/{provider}/callback` document the
expected redirect URI and required environment variables but return `501 Not Implemented`.
Implementing them requires registered developer apps and user consent.

Implement the `VideoProvider` interface (`src/lib/providers/VideoProvider.ts`) and register it in
`src/lib/providers/index.ts`. The rest of the app (API routes, job lifecycle, UI states) stays
provider-agnostic as long as the provider returns a `VideoMetadata` and resolved formats that do
not include server-only source URLs.
