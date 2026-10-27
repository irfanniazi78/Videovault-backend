import { NextResponse } from "next/server";

import { clearHistory, listHistory, recordHistory } from "@/lib/history/store";

export async function GET() {
  const entries = await listHistory();
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { url, title, formatLabel, status } = (body ?? {}) as {
    url?: string;
    title?: string;
    formatLabel?: string;
    status?: string;
  };

  if (!url) {
    return NextResponse.json({ error: "A URL is required." }, { status: 400 });
  }

  const entry = await recordHistory({
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    title,
    formatLabel,
    status: (status as "completed" | "failed" | "cancelled") ?? "failed",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ entry });
}

export async function DELETE() {
  await clearHistory();
  return NextResponse.json({ ok: true });
}
