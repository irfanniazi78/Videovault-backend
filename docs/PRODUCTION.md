# Production Deployment Notes

## Backend hosting

The backend uses filesystem state (`data/jobs.json`, `data/downloads/`) and a
single-process background worker. **Do not deploy to a serverless platform with an
ephemeral filesystem** (e.g. Vercel) — job state and downloads will be lost.

Recommended: a container/VM host with a persistent volume (Render, Railway, Fly.io,
a VPS). Mount the volume and set:

- `VIDEOVAULT_DATA_DIR=/data`
- `VIDEOVAULT_DOWNLOAD_DIR=/data/downloads`

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the web app (used for metadata/links). |
| `VIDEOVAULT_DATA_DIR` | No | Root for `jobs.json` and history (default `./data`). |
| `VIDEOVAULT_DOWNLOAD_DIR` | No | Root for downloaded files (default `./data/downloads`). |
| `YOUTUBE_API_KEY` | No | YouTube Data API v3 key for richer metadata. |
| `TWITCH_CLIENT_ID` | No | Free Twitch Client ID for clip metadata. |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | No | OAuth scaffolding only (not enabled). |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | No | OAuth scaffolding only (not enabled). |

No API keys are required for Internet Archive, Wikimedia Commons, DirectFile, NASA,
Vimeo, or Dailymotion.

## Mobile app backend URL

Set `EXPO_PUBLIC_API_URL` to the production backend URL (HTTPS) when building the
Android app:

```
EXPO_PUBLIC_API_URL=https://your-backend.example.com
```

## CORS

Native mobile clients are not subject to browser CORS. The web app is same-origin.
If you split the frontend and backend across origins, add the frontend origin to the
backend's allowed origins.

## Rate limiting

The backend does not implement rate limiting. For production, place it behind a
reverse proxy (nginx, Cloudflare) or add middleware to limit `/api/analyze` and
`/api/download` requests per IP.

## Security checklist

- Keep `.env.local` server-side only; never expose secrets to the client.
- Ensure `data/` and downloaded files are not served as static assets.
- Use HTTPS in production.
- Validate and sanitize all user-supplied URLs (already done in `src/lib/validators/url.ts`).
- Format resolution happens server-side; clients only send `formatId`.
