# VideoVault

VideoVault is a modern, mobile-first video downloading web application. It lets users paste a
video link, inspect the available formats, and download the requested quality.

## Status

This project is under active development.

- ✅ Project scaffolding, design system, validation, loading/error states and API structure.
- ✅ Real media provider integration: **Internet Archive** (`archive.org`) is implemented and
  serving real metadata and downloads. No API key is required.
- ✅ Additional metadata providers: **Wikimedia Commons**, **YouTube**, and **Vimeo** are
  implemented for metadata and official viewing/download links. (Commons supports real
  downloads of freely licensed files; YouTube and Vimeo are metadata-only because their
  platforms do not allow third-party downloads.)
- ✅ OAuth scaffolding for future own-content flows (Instagram, Facebook, TikTok) is present but
  not enabled.
- ✅ End-to-end download pipeline: real streamed download with byte progress, cancellation,
  history recording, and serving of the finished file.

### Not yet connected

- Additional media providers (e.g. YouTube, Vimeo). Currently unsupported because their terms do
  not permit third-party downloads.

## Supported sources

- **Internet Archive** (`https://archive.org/details/...`) — real metadata via the public
  metadata API and real downloads from public item files. See
  [`docs/SOURCES.md`](docs/SOURCES.md) for URL shapes, behavior and limitations.
- **Wikimedia Commons** (`https://commons.wikimedia.org/wiki/File:...`) — real metadata and
  downloads of freely licensed media via the MediaWiki API.
- **Direct video files** (any `http(s)` URL ending in `.mp4`, `.webm`, etc.) — real
  downloads with progress, for content you are permitted to download.
- **NASA Image and Video Library** (`images.nasa.gov/details/...`) — real downloads of
  public domain media via the official NASA API.
- **YouTube**, **Vimeo**, **Dailymotion** — metadata and official links only; no downloads.
- **Twitch** - metadata only (requires free Client ID); no downloads.
- **TikTok, Instagram, Facebook, X/Twitter** - official links only.

## Features

- Responsive, mobile-first UI (mobile, tablet, desktop).
- Dark and light mode.
- URL validation with helpful error messages.
- Real video metadata for supported sources (title, duration, thumbnail, formats).
- Format selection (container + quality, e.g. `mp4-720p`, `ogv-300p`) where downloads are available.
- Official viewing/download links for metadata-only sources (YouTube, Vimeo).
- Download progress, cancel and retry states.
- Download history and clear-history actions.
- Settings (preferred quality, reduced motion).

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS.
- **Backend:** Next.js Route Handlers (`src/app/api/*`).
- **Testing:** Vitest, React Testing Library, jsdom.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Environment

Copy the example environment file and adjust as needed:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
| --- | --- |
| `PROVIDER_API_KEY` | Reserved for future media provider credentials. Server-side only. |
| `PROVIDER_ENDPOINT` | Reserved for future media provider endpoint. Server-side only. |
| `NEXT_PUBLIC_APP_URL` | Public app URL used for metadata and links. |
| `VIDEOVAULT_DATA_DIR` | Optional root for jobs/history state (default: `./data`). |
| `VIDEOVAULT_DOWNLOAD_DIR` | Optional download storage root (default: `./data/downloads`). |
| `YOUTUBE_API_KEY` | Optional YouTube Data API v3 key for richer metadata. Without it, oEmbed is used. |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | OAuth scaffolding (not enabled) for Instagram/Facebook own-content. |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | OAuth scaffolding (not enabled) for TikTok own-content. |
| `TWITCH_CLIENT_ID` | Optional free Twitch Client ID for clip metadata. Without it, Twitch URLs are unsupported. |

> Secrets live only in the server environment (`.env.local` is git-ignored). No secrets are ever
> exposed to the browser.

### Run

```bash
npm run dev
```

Open <http://localhost:3000>.

### Production build

```bash
npm run build
npm run start
```

### Test

```bash
npm test
```

## Project Structure

```
src/
  app/                 # App Router pages, layouts and API routes
    api/               # Backend endpoints (analyze, download, jobs, history)
  components/          # Reusable UI components and feature components
    ui/                # Design-system primitives (Button, Input, Card, Alert, ...)
  hooks/               # React hooks (theme, download job state)
  lib/
    api/               # Frontend API client
    providers/         # Video provider interface + implementations
    jobs/              # Download job store
    history/           # Download history store
    types/             # Shared TypeScript types
    validators/        # Input validation logic
    formatters.ts      # Formatting helpers
    formats.ts         # Quality/format helpers
  test/                # Test setup
```

Unit and component tests live next to the code they cover (`*.test.ts` / `*.test.tsx`).

## Android app (Expo)

A native Android client lives in `apps/mobile/`. It reuses the same backend and
provider system as the web app.

- Tech: Expo SDK 58, React Native 0.88, TypeScript, Expo Router.
- Screens: Home (analyze), Video (formats, download, progress, cancel, Save file),
  History, Settings.
- Backend URL: `EXPO_PUBLIC_API_URL` (defaults to `http://10.0.2.2:3000` for the
  Android emulator).
- Status: scaffolded and type-checked; Android bundle exports successfully. Runtime
  testing on a device/emulator has not been performed in this environment.

### Run the Android app

```powershell
cd C:\Users\IRFAN\Documents\Videovault\apps\mobile
cmd /c "npm install"
cmd /c "npx expo start"
```

Press `a` for an Android emulator, or scan the QR code with Expo Go on a phone
(see `docs/MOBILE_PLAN.md` for LAN IP setup).

The architecture is provider-agnostic via the `VideoProvider` interface:

- `src/lib/providers/VideoProvider.ts` defines the contract (`id`, `name`, `supports`,
  `analyzeVideo` returning `{ video, formats }` where formats are server-only resolved sources,
  and `createDownloadJob`).
- `src/lib/providers/index.ts` returns the active provider implementation.
- `src/lib/providers/InternetArchiveProvider.ts` is the current implementation (Internet Archive).

To connect a real provider later, implement the interface and register it in
`src/lib/providers/index.ts` (or via configuration). The rest of the application — API routes,
download job lifecycle, UI states — does not need to change.

## Download Rules

VideoVault only supports downloads the user is permitted to make. The application does not
implement DRM bypass, authentication evasion, paywall circumvention, or any method intended to
evade platform restrictions.

## License

Proprietary.
