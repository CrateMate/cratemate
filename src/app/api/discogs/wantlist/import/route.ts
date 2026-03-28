import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createWantlistImportJob, runWantlistImportJob } from "@/lib/discogs/wantlist-job";

export const maxDuration = 60;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await createWantlistImportJob(userId);

  // Keep function alive until job completes, even after response is sent
  waitUntil(runWantlistImportJob(job.id));

  return NextResponse.json({ job_id: job.id, status: "pending" }, { status: 202 });
}
