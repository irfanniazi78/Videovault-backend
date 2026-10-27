# Mobile App Plan (Expo + React Native for Android)

**Status:** Scaffolded. TypeScript checks pass; Android bundle exports successfully.
Runtime testing on a device/emulator has not been performed in this environment.
reusing the existing Next.js backend and Internet Archive download pipeline. No code
changes have been made yet; this is the plan for approval.

## Goals

- Native Android app (Expo + React Native, TypeScript) in `apps/mobile`.
- Reuse existing backend APIs for analysis, downloads, jobs, and history.
- Preserve Internet Archive download functionality end-to-end.
- Support local device/emulator testing and a production backend URL.
- Keep the existing Next.js website and backend untouched.

## Proposed repository layout

```
Videovault/
  apps/
    mobile/                 # new Expo app
      app/                  # Expo Router screens
      src/
        api/                # port of src/lib/api/client.ts
        components/         # mobile UI (reuse logic, RN components)
        types/              # shared types (copied/synced from web)
      app.json
      eas.json
      package.json
  src/                     # existing Next.js app (unchanged)
  docs/
    MOBILE_PLAN.md         # this file
```

Recommended: convert the repo to an npm workspace so `apps/mobile` and the root share
tooling, while keeping `src/` for the web app.

## Reuse of existing backend

Mobile will call the same endpoints the website uses:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/analyze` | Analyze a URL (Internet Archive, YouTube, Vimeo, etc.) |
| `POST /api/download` | Start a download job for a chosen format |
| `GET /api/jobs/{id}` | Poll job status and progress |
| `DELETE /api/jobs/{id}` | Cancel a job |
| `GET /api/jobs/{id}/file` | Download the finished file to the device |
| `GET /api/history` | List history |
| `DELETE /api/history` | Clear history |

Mobile-specific behavior:

- After a job reaches `completed`, fetch `/api/jobs/{id}/file` and save it with
  `expo-file-system` (e.g. `FileSystem.documentDirectory`), then offer sharing via
  `expo-sharing` or saving to the media library via `expo-media-library`.
- Poll job status every 2s (reuse `POLL_INTERVAL_MS` logic from `useDownloadJob`).

## Backend URL configuration

Use `EXPO_PUBLIC_API_URL` so the value is available at runtime without rebuilds for dev,
and bake production values via EAS env.

- Local Android emulator: `http://10.0.2.2:3000` (emulator maps host localhost to 10.0.2.2)
- Local physical device: `http://<your-lan-ip>:3000` (e.g. `http://192.168.1.42:3000`)
- Production: `https://your-deployed-backend.example.com`

Implementation:

- `apps/mobile/app.config.js` reads `process.env.EXPO_PUBLIC_API_URL` with a sensible dev
  default and exposes it via `extra.apiUrl`.
- `apps/mobile/.env.development` and `.env.production` set the URL per environment.
- A small `getApiUrl()` helper in `src/api/client.ts` reads from `Constants.expoConfig.extra`.
- The Next.js backend must allow the mobile app's origin for CORS (or disable CORS checks
  for native clients). Since native `fetch` is not subject to browser CORS, no backend
  change is strictly required for the mobile app; CORS only matters for web.

## Step-by-step implementation

1. **Scaffold the Expo app**
   - `npx create-expo-app@latest apps/mobile --template blank-typescript`
   - Enable Expo Router: `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar`
   - Set `"main": "expo-router/entry"` in `package.json`.

2. **Configure Android**
   - `app.json`: `name`, `slug`, `version`, `orientation`, `icon`, `splash`,
     `android.package` (e.g. `com.yourname.videovault`), `android.permissions`
     (`INTERNET`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`), `android.adaptiveIcon`.
   - Add `expo-media-library` and `expo-file-system`, `expo-sharing`.

3. **Shared types**
   - Copy `src/lib/types/video.ts` into `apps/mobile/src/types/video.ts` initially.
   - (Optional later) extract a shared package `packages/shared` consumed by both web and
     mobile to avoid drift.

4. **API client**
   - Port `src/lib/api/client.ts` to `apps/mobile/src/api/client.ts`, replacing the
     relative base path with `getApiUrl()` + path.
   - Keep `ApiError` and the same request/response shapes.

5. **Screens (Expo Router)**
   - `app/index.tsx` — Home: URL input, Analyze button, error display.
   - `app/video.tsx` — Video info card, quality/format selectors, Download button,
     progress bar, cancel, Save file.
   - `app/history.tsx` — History list + clear.
   - `app/settings.tsx` — Preferred quality, reduced motion.
   - Reuse the visual language (colors, spacing) but with React Native primitives.

6. **Download flow on device**
   - On "Download": call `POST /api/download`, then poll `GET /api/jobs/{id}`.
   - On `completed`: fetch `/api/jobs/{id}/file` as an array buffer, write to
     `FileSystem.documentDirectory + fileName`, then prompt `Sharing.shareAsync` or
     `MediaLibrary.saveToLibraryAsync`.

7. **State management**
   - Use React hooks (mirror `useDownloadJob`) with `AsyncStorage` for settings.
   - History is server-backed; no local duplication needed.

8. **Testing**
   - Jest + `@testing-library/react-native` for component tests.
   - Mock `fetch` for API tests (reuse the web test patterns).
   - Maestro (optional) for E2E on emulator.

9. **Build & release**
   - Local: `npx expo run:android` (requires Android Studio + SDK).
   - Cloud: `eas build --platform android` (free tier limited; paid for more builds).
   - Submit: `eas submit --platform android` (requires Google Play developer account, $25
     one-time).

10. **Backend hosting for production**
    - The backend uses filesystem state (`data/jobs.json`, `data/downloads/`). A serverless
      host (e.g. Vercel) will not persist these. Options:
      - Deploy to a container/VM host with a persistent volume (Render, Railway, Fly.io).
      - Or migrate job/download state to a database + object storage (S3/R2) later.
    - Set `VIDEOVAULT_DATA_DIR` and `VIDEOVAULT_DOWNLOAD_DIR` to the mounted volume path.

## Dependencies (mobile)

Runtime:
- `expo`, `expo-router`, `react`, `react-native`
- `expo-file-system`, `expo-sharing`, `expo-media-library`
- `expo-constants`, `expo-status-bar`, `expo-linking`
- `@react-native-async-storage/async-storage`
- `react-native-safe-area-context`, `react-native-screens`

Dev:
- `typescript`, `jest`, `@testing-library/react-native`, `jest-expo`

## Costs

- Android Studio + Android SDK: free.
- Expo / EAS: free tier (limited builds); paid plans start ~$29/month for more builds and
  priority. Local builds via `expo run:android` are free.
- Google Play developer account: $25 one-time.
- Backend hosting: free tiers available (Render/Railway/Fly) but persistent volumes or
  paid plans may be needed for file storage; Vercel free tier is not suitable as-is due to
  ephemeral filesystem.
- No paid API keys required for Internet Archive, YouTube (oEmbed), or Vimeo.

## Risks / notes

- The backend's filesystem-based job state means production must use a host with persistent
  storage, or the mobile app's download/history features will not survive restarts.
- Large downloads on mobile should show progress and allow cancellation; reuse the existing
  job progress polling.
- Local device testing requires the phone and dev machine on the same Wi-Fi, and the backend
  bound to `0.0.0.0` (Next.js dev defaults to localhost only; use `next dev -H 0.0.0.0`).

## Next step (awaiting your approval)

If you approve, I will:
1. Create `apps/mobile` with the Expo scaffold and Android config.
2. Port the API client and types.
3. Implement the Home + Video screens first (analyze + download + Save file), then History
   and Settings.
4. Add a `docs/MOBILE_PLAN.md` (this file) — already created.

Please confirm the plan and any preferred backend hosting approach before I start.