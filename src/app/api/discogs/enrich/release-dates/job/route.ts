import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createReleaseDateEnrichJob, runReleaseDateEnrichJob } from "@/lib/discogs/enrich-job";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const job = await createReleaseDateEnrichJob({ userId });
    setTimeout(() => {
      void runReleaseDateEnrichJob(job.id);
    }, 0);
    return NextResponse.json({ job_id: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release date enrichment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
