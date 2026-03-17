import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createWantlistImportJob, runWantlistImportJob } from "@/lib/discogs/wantlist-job";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await createWantlistImportJob(userId);

  // Fire background job without awaiting
  setTimeout(() => runWantlistImportJob(job.id), 0);

  return NextResponse.json({ job_id: job.id, status: "pending" }, { status: 202 });
}
