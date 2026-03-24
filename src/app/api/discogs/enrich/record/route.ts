import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { enrichSingleRecord } from "@/lib/discogs/enrich";

// Single-record enrichment — used by action-triggered lazy enrichment in the client.
// Called fire-and-forget on: detail card open, play logged, track hearted.
// Groups with many members require ~10 MusicBrainz calls at 300ms each (~3s).
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordId } = await req.json().catch(() => ({}));
  if (!recordId) return NextResponse.json({ error: "Missing recordId" }, { status: 400 });

  try {
    const result = await enrichSingleRecord(userId, String(recordId));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[enrich/record]", err);
    return NextResponse.json({ updated: false, skipped: false });
  }
}
