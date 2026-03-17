import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWantlistImportJob } from "@/lib/discogs/wantlist-job";

export async function GET(_request: Request, { params }: { params: Promise<{ job_id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { job_id } = await params;
  const job = await getWantlistImportJob(job_id, userId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({
    status: job.status,
    page: job.page,
    total_pages: job.total_pages,
    imported: job.imported,
    total: job.total,
    error: job.error,
  });
}
