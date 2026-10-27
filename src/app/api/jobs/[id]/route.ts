import { NextResponse } from "next/server";

import { requestCancel } from "@/lib/downloads/worker";
import { getJob, updateJob } from "@/lib/jobs/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Download job not found." }, { status: 404 });
  }
  return NextResponse.json({ job }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Download job not found." }, { status: 404 });
  }

  if (job.status === "completed") {
    return NextResponse.json(
      { error: "This download has already finished." },
      { status: 409 },
    );
  }

  if (job.status === "cancelled" || job.status === "failed") {
    return NextResponse.json({ job });
  }

  // Abort the transfer in this process, then persist the status so the worker
  // (which may live in another route's module scope) also stops.
  requestCancel(id);
  const cancelled = await updateJob(id, { status: "cancelled", progress: 0 });

  return NextResponse.json({ job: cancelled ?? job });
}
