import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createEnrichJob, runEnrichJob } from "@/lib/discogs/enrich-job";

type ModeParam = "full" | "thumb";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const modeParam = (searchParams.get("mode") || "full").toLowerCase();
  const mode: ModeParam = modeParam === "thumb" ? "thumb" : "full";
  const force = searchParams.get("force") === "1";
  const limit = Math.max(1, Math.min(400, parseInt(searchParams.get("limit") || "200", 10) || 200));

  try {
    const job = await createEnrichJob({ userId, mode, limit, force });
    setTimeout(() => {
      void runEnrichJob(job.id);
    }, 0);
    return NextResponse.json({ job_id: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof (error as { message?: string })?.message === "string"
          ? (error as { message: string }).message
          : JSON.stringify(error);
    console.error("createEnrichJob error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
