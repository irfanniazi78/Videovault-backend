import { NextResponse } from "next/server";

const SUPPORTED = new Set(["youtube", "instagram", "tiktok", "facebook"]);

interface RouteContext {
  params: Promise<{ provider: string }>;
}

/**
 * OAuth scaffolding endpoint. Real OAuth flows require a registered developer app
 * and user consent; this route documents the expected setup and returns 501 until
 * credentials are configured.
 */
export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const normalized = provider.toLowerCase();

  if (!SUPPORTED.has(normalized)) {
    return NextResponse.json({ error: `Unknown OAuth provider: ${provider}.` }, { status: 404 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/${normalized}/callback`;

  return NextResponse.json(
    {
      status: "not-implemented",
      error:
        "OAuth for this provider is scaffolded but not enabled yet. Register a developer app, set the required environment variables, and implement the token exchange before using this endpoint.",
      provider: normalized,
      redirectUri,
      requiredEnv: requiredEnvFor(normalized),
    },
    { status: 501 },
  );
}

function requiredEnvFor(provider: string): string[] {
  switch (provider) {
    case "youtube":
      return ["YOUTUBE_API_KEY"];
    case "instagram":
    case "facebook":
      return ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"];
    case "tiktok":
      return ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"];
    default:
      return [];
  }
}
