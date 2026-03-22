import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getImportJob, runImportJobPage } from "@/lib/discogs/import-job";

// Each GET advances the import by one Discogs collection page (100 records).
// The client polls this endpoint every ~800ms until status === "completed".
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  if (!jobId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  const job = await getImportJob(jobId, userId);
  if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 });

  // Already done — just return current state without doing any more work.
  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json(job);
  }

  try {
    const updated = await runImportJobPage(jobId, userId);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import page failed";
    return NextResponse.json({ ...job, status: "failed", error: message }, { status: 500 });
  }
}
