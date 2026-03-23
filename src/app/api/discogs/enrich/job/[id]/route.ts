import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getEnrichJob, runEnrichJobPage } from "@/lib/discogs/enrich-job";

// Each GET advances enrichment by one batch (2 records).
// The client polls this endpoint until status === "completed".
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  if (!jobId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  const job = await getEnrichJob(jobId, userId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Already done — return without doing more work
  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json(job);
  }

  try {
    const updated = await runEnrichJobPage(jobId);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment page failed";
    return NextResponse.json({ ...job, status: "failed", error: message }, { status: 500 });
  }
}
