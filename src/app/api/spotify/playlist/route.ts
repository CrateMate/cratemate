import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getUserAccessToken, spotifyGet } from "@/lib/spotify";

type TrackInput = { artist: string; trackTitle: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip Discogs-style disambiguation suffixes: "Artist (2)" → "Artist" */
function cleanArtist(artist: string): string {
  return artist.replace(/\s*\(\d+\)$/, "").trim();
}

/** Strip alternate-language subtitles Discogs adds: "Title = Título" → "Title" */
function cleanTrackTitle(title: string): string {
  return title.replace(/\s*=\s*.+$/, "").trim();
}

async function searchTrackUri(trackTitle: string, rawArtist: string): Promise<string | null> {
  const artist = cleanArtist(rawArtist);
  const title = cleanTrackTitle(trackTitle);

  const trySearch = async (q: string) => {
    const res = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=track&limit=5`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[playlist/search] ${res.status} for query "${q}":`, body);
      return null;
    }
    const data = await res.json();
    return (data.tracks?.items || [])[0]?.uri ?? null;
  };

  // 1. Strict field search with cleaned title
  const uri = await trySearch(`track:"${title}" artist:"${artist}"`);
  if (uri) return uri;

  // 2. Plain text fallback
  return trySearch(`${title} ${artist}`);
}

async function spotifyPost(path: string, token: string, body: unknown) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, tracks, isPublic = true }: { name: string; tracks: TrackInput[]; isPublic?: boolean } = await req.json();

    if (!name || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: "Missing name or tracks" }, { status: 400 });
    }

    // Get token once — reuse for all calls
    const token = await getUserAccessToken(userId);
    if (!token) return NextResponse.json({ error: "no_access_token" }, { status: 400 });

    // Search each track
    const uris: string[] = [];
    const notFound: string[] = [];
    for (const track of tracks) {
      const uri = await searchTrackUri(track.trackTitle, track.artist);
      uri ? uris.push(uri) : notFound.push(`${cleanArtist(track.artist)} — ${cleanTrackTitle(track.trackTitle)}`);
      await sleep(200);
    }

    // Don't create an empty playlist
    if (uris.length === 0) {
      return NextResponse.json({
        error: "no_tracks_found",
        matched: 0,
        total: tracks.length,
        notFound,
      }, { status: 422 });
    }

    // Create playlist
    const createRes = await spotifyPost(
      `/me/playlists`,
      token,
      { name, public: isPublic, description: "Created with CrateMate" }
    );

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      console.error("[playlist] create failed:", createRes.status, JSON.stringify(errBody));
      if (createRes.status === 403) {
        return NextResponse.json({ error: "insufficient_scope", spotify_error: errBody }, { status: 403 });
      }
      return NextResponse.json({ error: "spotify_error", status: createRes.status, detail: errBody }, { status: 500 });
    }

    const playlist = await createRes.json();
    const playlistId: string = playlist.id;
    const playlistUrl: string = playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`;

    // Add tracks in batches of 100
    for (let i = 0; i < uris.length; i += 100) {
      const addRes = await spotifyPost(`/playlists/${playlistId}/tracks`, token, { uris: uris.slice(i, i + 100) });
      if (!addRes.ok) {
        const errBody = await addRes.json().catch(() => ({}));
        console.error("[playlist] add tracks failed:", addRes.status, JSON.stringify(errBody));
        return NextResponse.json({ playlistUrl, matched: i, total: tracks.length, notFound, warning: "partial" });
      }
    }

    return NextResponse.json({ playlistUrl, matched: uris.length, total: tracks.length, notFound });
  } catch (err) {
    console.error("[playlist] unhandled error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
