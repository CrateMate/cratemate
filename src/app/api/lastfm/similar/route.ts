import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const LASTFM_API = "http://ws.audioscrobbler.com/2.0/";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const artistsParam = searchParams.get("artists");
  if (!artistsParam) return NextResponse.json({ similar: [] });

  const artists = artistsParam.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 5);
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Last.fm not configured" }, { status: 500 });

  const results = await Promise.allSettled(
    artists.map(async (artist) => {
      const url = new URL(LASTFM_API);
      url.searchParams.set("method", "artist.getsimilar");
      url.searchParams.set("artist", artist);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "20");
      const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
      if (!res.ok) return { artist, similar: [] as { name: string; match: string; url: string }[] };
      const data = await res.json();
      const similar = data.similarartists?.artist || [];
      return { artist, similar };
    })
  );

  // Aggregate by artist name: sum match scores, track which seed artists each came from
  const aggregated = new Map<string, { name: string; score: number; lastfm_url: string; similar_to: string[] }>();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { artist: sourceArtist, similar } = result.value;
    for (const s of similar) {
      const key = (s.name || "").toLowerCase().trim();
      if (!key) continue;
      const match = parseFloat(s.match) || 0;
      const existing = aggregated.get(key);
      if (existing) {
        existing.score += match;
        if (!existing.similar_to.includes(sourceArtist)) existing.similar_to.push(sourceArtist);
      } else {
        aggregated.set(key, { name: s.name, score: match, lastfm_url: s.url || "", similar_to: [sourceArtist] });
      }
    }
  }

  const sorted = Array.from(aggregated.values()).sort((a, b) => b.score - a.score);

  return NextResponse.json({ similar: sorted });
}
