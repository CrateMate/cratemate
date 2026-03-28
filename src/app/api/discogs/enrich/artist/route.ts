import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { enrichArtistDates } from "@/lib/discogs/enrich";

export const maxDuration = 60;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await enrichArtistDates({ userId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Artist enrichment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
