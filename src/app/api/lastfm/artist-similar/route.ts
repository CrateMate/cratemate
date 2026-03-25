import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const LASTFM_API = "http://ws.audioscrobbler.com/2.0/";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");
  if (!artist) return NextResponse.json({ similar: [] });

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Last.fm not configured" }, { status: 500 });

  const url = new URL(LASTFM_API);
  url.searchParams.set("method", "artist.getsimilar");
  url.searchParams.set("artist", artist);
  url.searchParams.set("limit", "50");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json({ similar: [] });
  const data = await res.json();

  const similar: { name: string; match: number }[] = (data?.similarartists?.artist || []).map(
    (a: { name: string; match: string }) => ({ name: a.name, match: parseFloat(a.match) || 0 })
  );

  return NextResponse.json({ similar });
}
