import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { spotifyUserGet } from "@/lib/spotify";

type SpotifyTrack = {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string }>;
    release_date: string;
  };
};

function normalise(s: string) {
  return (s || "").toLowerCase().trim();
}

/** Strip common suffixes so "Kind of Blue (Remastered)" matches "Kind of Blue" */
function cleanAlbumTitle(title: string) {
  return title
    .replace(/\s*\(.*?(remaster|remastered|deluxe|expanded|anniversary|edition|version|mono|stereo|bonus|limited|special)[^)]*\)/gi, "")
    .replace(/\s*\[.*?(remaster|remastered|deluxe|expanded)[^\]]*\]/gi, "")
    .trim();
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch top tracks (short_term ≈ last 4 weeks) + recently played in parallel
  let topTracks: SpotifyTrack[] = [];
  let recentTracks: SpotifyTrack[] = [];

  try {
    const [topRes, recentRes] = await Promise.all([
      spotifyUserGet("/me/top/tracks?time_range=short_term&limit=50", userId),
      spotifyUserGet("/me/player/recently-played?limit=50", userId),
    ]);

    if (!topRes.ok) {
      if (topRes.status === 401) {
        return NextResponse.json({ error: "Spotify token expired. Reconnect Spotify." }, { status: 401 });
      }
    } else {
      const data = await topRes.json();
      topTracks = data.items || [];
    }

    if (recentRes.ok) {
      const data = await recentRes.json();
      // recently-played wraps each track in { track: ..., played_at: ... }
      recentTracks = (data.items || []).map((i: { track: SpotifyTrack }) => i.track);
    }
  } catch {
    return NextResponse.json({ error: "Spotify not connected" }, { status: 400 });
  }

  // Deduplicate and score albums
  // top tracks carry more weight (rank-based) + recently played adds recency signal
  const albumScores = new Map<string, {
    albumId: string;
    albumName: string;
    artist: string;
    image: string | null;
    year: string | null;
    score: number;
  }>();

  // Top tracks: score = (50 - rank) so #1 track scores 49, #50 scores 0
  topTracks.forEach((track, rank) => {
    const key = track.album.id;
    const existing = albumScores.get(key);
    const pts = Math.max(0, 50 - rank);
    if (existing) {
      existing.score += pts;
    } else {
      albumScores.set(key, {
        albumId: key,
        albumName: track.album.name,
        artist: track.artists[0]?.name || "",
        image: track.album.images[0]?.url || null,
        year: track.album.release_date?.slice(0, 4) || null,
        score: pts,
      });
    }
  });

  // Recently played: +3 per occurrence (recency bonus)
  recentTracks.forEach((track) => {
    const key = track.album.id;
    const existing = albumScores.get(key);
    if (existing) {
      existing.score += 3;
    } else {
      albumScores.set(key, {
        albumId: key,
        albumName: track.album.name,
        artist: track.artists[0]?.name || "",
        image: track.album.images[0]?.url || null,
        year: track.album.release_date?.slice(0, 4) || null,
        score: 3,
      });
    }
  });

  // Sort by score descending
  const rankedAlbums = Array.from(albumScores.values()).sort((a, b) => b.score - a.score);

  if (rankedAlbums.length === 0) {
    return NextResponse.json({ recs: [], connected: true });
  }

  // Fetch user's collection: artist + title for album-level matching
  const { data: collectionRecords } = await supabase
    .from("records")
    .select("artist, title")
    .eq("user_id", userId);

  // Build a set of normalised "artist|title" keys
  const collectionKeys = new Set(
    (collectionRecords || []).map((r) =>
      `${normalise(r.artist)}|${normalise(cleanAlbumTitle(r.title || ""))}`
    )
  );

  // Also keep an artist-only set for fuzzy fallback
  const collectionArtists = new Set(
    (collectionRecords || []).map((r) => normalise(r.artist))
  );

  // Fetch wantlist for the same matching
  const { data: wantlistItems } = await supabase
    .from("wantlist")
    .select("artist, title")
    .eq("user_id", userId);

  const wantlistKeys = new Set(
    (wantlistItems || []).map((r) =>
      `${normalise(r.artist)}|${normalise(cleanAlbumTitle(r.title || ""))}`
    )
  );

  // Build recs: albums not already in the crate
  const recs = rankedAlbums
    .map((album) => {
      const cleanedTitle = cleanAlbumTitle(album.albumName);
      const matchKey = `${normalise(album.artist)}|${normalise(cleanedTitle)}`;
      const inCrate = collectionKeys.has(matchKey);
      // Fallback: if artist is in crate but this specific album isn't, still surface it
      const artistInCrate = collectionArtists.has(normalise(album.artist));
      const onWantlist = wantlistKeys.has(matchKey);

      return {
        album: cleanedTitle,
        artist: album.artist,
        image: album.image,
        year: album.year,
        score: album.score,
        in_crate: inCrate,
        artist_in_crate: artistInCrate,
        on_wantlist: onWantlist,
      };
    })
    .filter((r) => !r.in_crate)
    .slice(0, 15);

  return NextResponse.json({ recs, connected: true });
}
