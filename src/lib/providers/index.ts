import { DailymotionProvider } from "./DailymotionProvider";
import { DirectFileProvider } from "./DirectFileProvider";
import { InternetArchiveProvider } from "./InternetArchiveProvider";
import { NasaProvider } from "./NasaProvider";
import { TwitchProvider } from "./TwitchProvider";
import { VimeoProvider } from "./VimeoProvider";
import { WikimediaCommonsProvider } from "./WikimediaCommonsProvider";
import { YouTubeProvider } from "./YouTubeProvider";
import type { VideoProvider } from "./VideoProvider";

/**
 * Registered providers, in priority order.
 *
 * Only add a provider here when it can serve *public* media through an
 * official API or a documented public file URL. Providers must not bypass
 * DRM, authentication, paywalls, or platform restrictions.
 */
const providers: readonly VideoProvider[] = [
  new InternetArchiveProvider(),
  new WikimediaCommonsProvider(),
  new DirectFileProvider(),
  new NasaProvider(),
  new YouTubeProvider(),
  new VimeoProvider(),
  new DailymotionProvider(),
  new TwitchProvider(),
];

/** Returns the provider that can handle this URL, or null when none can. */
export function getVideoProviderForUrl(url: string): VideoProvider | null {
  return providers.find((provider) => provider.supports(url)) ?? null;
}

/** Human readable names of every registered provider (used in diagnostics). */
export function getSupportedProviderNames(): string[] {
  return providers.map((provider) => provider.name);
}

/**
 * Official viewing/download options for a URL that has no downloadable provider.
 * Used by the analyze route to give users an honest next step.
 */
export function getOfficialOptionsForUrl(url: string): {
  platform: string;
  options: { label: string; url: string }[];
  notes: string;
} | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    const idMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/) || url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || url.match(/\/(shorts|embed)\/([A-Za-z0-9_-]{11})/);
    const id = idMatch ? idMatch[1] || idMatch[2] : null;
    return {
      platform: "YouTube",
      options: [
        { label: "Watch on YouTube", url: id ? `https://www.youtube.com/watch?v=${id}` : url },
        { label: "Download your own uploads via YouTube Studio", url: "https://studio.youtube.com/" },
      ],
      notes:
        "YouTube does not provide a public download API. Only the video owner can download their own uploads through YouTube Studio.",
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    return {
      platform: "Vimeo",
      options: [
        { label: "Watch on Vimeo", url },
        { label: "Download (owner only) via Vimeo", url: "https://vimeo.com/manage" },
      ],
      notes: "Vimeo does not allow third-party downloads of other users' videos.",
    };
  }

  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    return {
      platform: "TikTok",
      options: [
        { label: "Watch on TikTok", url },
        { label: "Download your own data via TikTok Data Portability", url: "https://developers.tiktok.com/doc/data-portability-api-get-started" },
      ],
      notes:
        "TikTok does not allow third-party downloads of other users' videos. Creators can export their own data through TikTok's official Data Portability API.",
    };
  }

  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    return {
      platform: "Instagram",
      options: [
        { label: "View on Instagram", url },
        { label: "Download your information (Instagram)", url: "https://www.instagram.com/download/request/" },
      ],
      notes:
        "Instagram does not allow third-party downloads of other users' media. Account owners can download their own information from Instagram settings.",
    };
  }

  if (host === "facebook.com" || host.endsWith(".facebook.com")) {
    return {
      platform: "Facebook",
      options: [
        { label: "View on Facebook", url },
        { label: "Download your information (Facebook)", url: "https://www.facebook.com/dyi/" },
      ],
      notes: "Facebook does not allow third-party downloads of other users' videos.",
    };
  }

  if (host === "twitter.com" || host === "x.com" || host.endsWith(".twitter.com") || host.endsWith(".x.com")) {
    return {
      platform: "X (Twitter)",
      options: [
        { label: "View on X", url },
        { label: "Download your archive (X)", url: "https://help.twitter.com/en/managing-your-account/how-to-download-your-twitter-archive" },
      ],
      notes: "X does not allow third-party downloads of other users' videos.",
    };
  }

  if (host === "dailymotion.com" || host === "www.dailymotion.com") {
    return {
      platform: "Dailymotion",
      options: [{ label: "Watch on Dailymotion", url }],
      notes: "Dailymotion does not provide a public third-party download API.",
    };
  }

  if (host === "twitch.tv" || host === "clips.twitch.tv" || host.endsWith(".twitch.tv")) {
    return {
      platform: "Twitch",
      options: [
        { label: "Watch on Twitch", url },
        { label: "Twitch Client ID setup (free)", url: "https://dev.twitch.tv/console" },
      ],
      notes:
        "Twitch requires a free Client ID for metadata. VideoVault shows metadata and official links only; no downloads.",
    };
  }

  return null;
}
