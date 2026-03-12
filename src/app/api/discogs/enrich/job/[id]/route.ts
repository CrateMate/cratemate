import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getEnrichJob } from "@/lib/discogs/enrich-job";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  if (!jobId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  const job = await getEnrichJob(jobId, userId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(job);
}
