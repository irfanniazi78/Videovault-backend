import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { provider } = await context.params;
  return NextResponse.json(
    {
      status: "not-implemented",
      error: `OAuth callback for ${provider} is scaffolded but not enabled yet.`,
    },
    { status: 501 },
  );
}
