import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { spotifyUserGet } from "@/lib/spotify";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch top artists from Spotify (last ~4 weeks)
  let topArtists: Array<{
    name: string;
    genres: string[];
    images: Array<{ url: string }>;
    popularity: number;
  }> = [];

  try {
    const res = await spotifyUserGet("/me/top/artists?time_range=short_term&limit=30", userId);
    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ error: "Spotify token expired. Reconnect Spotify." }, { status: 401 });
      }
      return NextResponse.json({ recs: [], connected: true });
    }
    const data = await res.json();
    topArtists = data.items || [];
  } catch {
    return NextResponse.json({ error: "Spotify not connected" }, { status: 400 });
  }

  if (topArtists.length === 0) {
    return NextResponse.json({ recs: [], connected: true });
  }

  // Fetch user's Discogs collection artists
  const { data: collectionRecords } = await supabase
    .from("records")
    .select("artist")
    .eq("user_id", userId);

  const collectionArtists = new Set(
    (collectionRecords || [])
      .map((r) => (r.artist || "").toLowerCase().trim())
      .filter(Boolean)
  );

  // Fetch user's wantlist artists
  const { data: wantlistItems } = await supabase
    .from("wantlist")
    .select("artist")
    .eq("user_id", userId);

  const wantlistArtists = new Set(
    (wantlistItems || [])
      .map((r) => (r.artist || "").toLowerCase().trim())
      .filter(Boolean)
  );

  // Build recs: top Spotify artists not already in the crate
  const recs = topArtists
    .map((artist, rank) => {
      const normalized = artist.name.toLowerCase().trim();
      return {
        artist: artist.name,
        genres: artist.genres.slice(0, 2),
        image: artist.images[0]?.url || null,
        spotify_rank: rank + 1,
        in_crate: collectionArtists.has(normalized),
        on_wantlist: wantlistArtists.has(normalized),
      };
    })
    .filter((r) => !r.in_crate); // Only surface artists missing from the crate

  return NextResponse.json({ recs, connected: true });
}
