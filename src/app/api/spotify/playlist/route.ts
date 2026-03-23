import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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

    // Get Spotify user id and access token
    const { data: tokenRow, error: dbError } = await supabase
      .from("spotify_user_tokens")
      .select("spotify_user_id")
      .eq("user_id", userId)
      .single();

    if (dbError) {
      console.error("[playlist] DB error:", dbError);
      return NextResponse.json({ error: "db_error", detail: dbError.message }, { status: 500 });
    }

    if (!tokenRow?.spotify_user_id) {
      console.error("[playlist] No spotify_user_id for user", userId);
      return NextResponse.json({ error: "no_spotify_id" }, { status: 400 });
    }

    const spotifyUserId = tokenRow.spotify_user_id;

    const accessToken = await getUserAccessToken(userId);
    if (!accessToken) {
      console.error("[playlist] No access token for user", userId);
      return NextResponse.json({ error: "no_access_token" }, { status: 400 });
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

    if (createRes.status === 403) {
      const body = await createRes.json().catch(() => ({}));
      console.error("[playlist] Spotify 403 on create:", JSON.stringify(body));
      return NextResponse.json({ error: "insufficient_scope" }, { status: 403 });
    }
    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      console.error("[playlist] Spotify error on create:", createRes.status, JSON.stringify(errBody));
      return NextResponse.json({ error: "spotify_error", status: createRes.status, detail: errBody }, { status: 500 });
    }

    const playlist = await createRes.json();
    const playlistId: string = playlist.id;
    const playlistUrl: string = playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`;

    // Add tracks in batches of 100
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      const addRes = await spotifyUserPost(`/playlists/${playlistId}/tracks`, userId, { uris: batch });
      if (addRes.status === 403) {
        return NextResponse.json({ error: "insufficient_scope" }, { status: 403 });
      }
      if (!addRes.ok) {
        const errBody = await addRes.json().catch(() => ({}));
        console.error("[playlist] Spotify error adding tracks:", addRes.status, JSON.stringify(errBody));
        // Playlist was created, return partial success
        return NextResponse.json({ playlistUrl, matched: uris.slice(0, i).length, total: tracks.length, notFound, warning: "partial" });
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
