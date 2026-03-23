import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { spotifyUserPost, getUserAccessToken } from "@/lib/spotify";

type TrackInput = { artist: string; trackTitle: string };

async function searchTrackUri(trackTitle: string, artist: string, accessToken: string): Promise<string | null> {
  try {
    const q = `track:"${trackTitle}" artist:"${artist}"`;
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=3`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: Array<{ uri: string }> = data.tracks?.items || [];
    return items[0]?.uri ?? null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, tracks, isPublic = true }: { name: string; tracks: TrackInput[]; isPublic?: boolean } = body;

    if (!name || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: "Missing name or tracks" }, { status: 400 });
    }

    const accessToken = await getUserAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: "no_access_token" }, { status: 400 });
    }

    // Fetch Spotify user ID fresh from the token — don't rely on stored value
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      const meErr = await meRes.json().catch(() => ({}));
      console.error("[playlist] /me failed:", meRes.status, JSON.stringify(meErr));
      return NextResponse.json({ error: "me_failed", status: meRes.status, detail: meErr }, { status: 500 });
    }
    const me = await meRes.json();
    const spotifyUserId: string = me.id;

    if (!spotifyUserId) {
      return NextResponse.json({ error: "no_spotify_user_id" }, { status: 500 });
    }

    // Search each track for its Spotify URI
    const uris: string[] = [];
    const notFound: string[] = [];

    for (const track of tracks) {
      const uri = await searchTrackUri(track.trackTitle, track.artist, accessToken);
      if (uri) {
        uris.push(uri);
      } else {
        notFound.push(`${track.artist} — ${track.trackTitle}`);
      }
      await sleep(200);
    }

    // Create playlist
    const createRes = await spotifyUserPost(
      `/users/${spotifyUserId}/playlists`,
      userId,
      { name, public: isPublic, description: "Created with CrateMate" }
    );

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      console.error("[playlist] Spotify create error:", createRes.status, JSON.stringify(errBody));
      if (createRes.status === 403) {
        return NextResponse.json({
          error: "insufficient_scope",
          spotify_error: errBody,
        }, { status: 403 });
      }
      return NextResponse.json({ error: "spotify_error", status: createRes.status, detail: errBody }, { status: 500 });
    }

    const playlist = await createRes.json();
    const playlistId: string = playlist.id;
    const playlistUrl: string = playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`;

    // Add tracks in batches of 100
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      const addRes = await spotifyUserPost(`/playlists/${playlistId}/tracks`, userId, { uris: batch });
      if (!addRes.ok) {
        const errBody = await addRes.json().catch(() => ({}));
        console.error("[playlist] Spotify add tracks error:", addRes.status, JSON.stringify(errBody));
        // Playlist was created — return partial success
        return NextResponse.json({ playlistUrl, matched: i, total: tracks.length, notFound, warning: "partial" });
      }
    }

    return NextResponse.json({
      playlistUrl,
      matched: uris.length,
      total: tracks.length,
      notFound,
    });
  } catch (err) {
    console.error("[playlist] Unhandled error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
