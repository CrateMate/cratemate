import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { enrichPage } from "@/lib/discogs/enrich";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mode = (searchParams.get("mode") || "full").toLowerCase() === "thumb" ? "thumb" : "full";
  const force = searchParams.get("force") === "1";
  const limit = Math.max(1, Math.min(400, parseInt(searchParams.get("limit") || "200", 10) || 200));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  try {
    const result = await enrichPage({ userId, mode, force, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Metadata sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
