import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";

async function lastfmGet(params: Record<string, string>, apiKey: string) {
  const url = new URL(LASTFM_API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const artistsParam = searchParams.get("artists");
  if (!artistsParam) return NextResponse.json({ similar: [] });

  const artists = artistsParam.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 5);
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Last.fm not configured" }, { status: 500 });

  // Step 1: fetch similar artists for each seed in parallel
  const similarResults = await Promise.allSettled(
    artists.map(async (artist) => {
      const data = await lastfmGet({ method: "artist.getsimilar", artist, limit: "20" }, apiKey);
      const similar: { name: string; match: string; url: string }[] = data?.similarartists?.artist || [];
      return { artist, similar };
    })
  );

  // Step 2: aggregate by name, sum match scores
  const aggregated = new Map<string, { name: string; score: number; similar_to: string[] }>();
  for (const result of similarResults) {
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
        aggregated.set(key, { name: s.name, score: match, similar_to: [sourceArtist] });
      }
    }
  }

  const top = Array.from(aggregated.values()).sort((a, b) => b.score - a.score).slice(0, 15);

  function cleanAlbumName(name: string) {
    return name
      .replace(/\s*[\[(][^\]()]*(?:remaster|remastered|deluxe|expanded|anniversary|edition|version|mono|stereo|bonus|limited|special)[^\]()]*[\])]/gi, "")
      .trim();
  }

  // Step 3: fetch top albums for each similar artist, request more to allow dedup
  const withAlbums = await Promise.all(
    top.map(async (artist) => {
      const data = await lastfmGet({ method: "artist.gettopalbums", artist: artist.name, limit: "10" }, apiKey);
      const seen = new Set<string>();
      const albums: { name: string; image: string | null }[] = [];
      for (const a of (data?.topalbums?.album || [])) {
        if (!a.name || a.name === "(null)") continue;
        const clean = cleanAlbumName(a.name);
        const key = clean.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        albums.push({
          name: clean,
          image: a.image?.find((i: { size: string }) => i.size === "medium")?.["#text"] || null,
        });
        if (albums.length === 3) break;
      }
      return { ...artist, top_albums: albums };
    })
  );

  return NextResponse.json({ similar: withAlbums });
}
