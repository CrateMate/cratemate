import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { DISCOGS_API, USER_AGENT } from "@/lib/discogs";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json([]);

  const type = searchParams.get("type") || "release";
  const url = new URL(`${DISCOGS_API}/database/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", type);
  url.searchParams.set("format", "Vinyl");
  url.searchParams.set("per_page", searchParams.get("per_page") || "10");
  url.searchParams.set("key", process.env.DISCOGS_CONSUMER_KEY!);
  url.searchParams.set("secret", process.env.DISCOGS_CONSUMER_SECRET!);

  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return NextResponse.json([]);

  const data = await res.json();
  return NextResponse.json(data.results || []);
}
