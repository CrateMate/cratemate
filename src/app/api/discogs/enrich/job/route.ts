import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createEnrichJob, runEnrichJobPage } from "@/lib/discogs/enrich-job";

export const maxDuration = 60;

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
    // Run the first page synchronously so the client gets real progress immediately
    const updated = await runEnrichJobPage(job.id);
    return NextResponse.json({ job_id: job.id, ...updated }, { status: 202 });
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
