import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getUserAccessToken } from "@/lib/spotify";

type TrackInput = { artist: string; trackTitle: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanArtist(artist: string): string {
  return artist.replace(/\s*\(\d+\)$/, "").trim();
}

function cleanTrackTitle(title: string): string {
  return title.replace(/\s*=\s*.+$/, "").trim();
}

async function spotifyPost(path: string, token: string, body: unknown) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function spotifyGetWithUserToken(path: string, token: string) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, tracks, isPublic = true }: { name: string; tracks: TrackInput[]; isPublic?: boolean } = await req.json();

    if (!name || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: "Missing name or tracks" }, { status: 400 });
    }

    const token = await getUserAccessToken(userId);
    if (!token) return NextResponse.json({ error: "no_access_token" }, { status: 400 });

    // Search with the same user token used for playlist creation/add so the
    // found track URIs are valid in that user's Spotify market/catalog context.
    const searchTrack = async (q: string) => {
      const res = await spotifyGetWithUserToken(
        `/search?q=${encodeURIComponent(q)}&type=track&limit=5&market=from_token`,
        token
      );
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "15");
        return { rateLimited: true, retryAfter } as const;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.log("[playlist] search non-ok", res.status, q, body.slice(0, 200));
        if (firstSearchStatus === null) firstSearchStatus = res.status;
        return null;
      }
      const data = await res.json();
      const uri = (data.tracks?.items || [])[0]?.uri as string ?? null;
      if (firstSearchStatus === null) firstSearchStatus = res.status;
      console.log("[playlist] search", res.status, q, "→", uri ?? `no results (${data.tracks?.items?.length ?? 0} items)`);
      return uri;
    };

    const uris: string[] = [];
    const notFound: string[] = [];
    let firstSearchStatus: number | null = null;

    for (const track of tracks) {
      const artist = cleanArtist(track.artist);
      const title = cleanTrackTitle(track.trackTitle);

      let uri: string | null = null;

      const r1 = await searchTrack(`track:"${title}" artist:"${artist}"`);
      if (r1 && typeof r1 === "object" && "rateLimited" in r1) {
        return NextResponse.json({ error: "rate_limited", retryAfter: r1.retryAfter }, { status: 429 });
      }
      uri = r1 as string | null;

      if (!uri) {
        const r2 = await searchTrack(`${title} ${artist}`);
        if (r2 && typeof r2 === "object" && "rateLimited" in r2) {
          return NextResponse.json({ error: "rate_limited", retryAfter: r2.retryAfter }, { status: 429 });
        }
        uri = r2 as string | null;
      }

      if (uri) {
        uris.push(uri);
      } else {
        notFound.push(`${artist} — ${title}`);
      }
      await sleep(400);
    }

    if (uris.length === 0) {
      return NextResponse.json({ error: "no_tracks_found", matched: 0, total: tracks.length, notFound, searchStatus: firstSearchStatus }, { status: 422 });
    }

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
    console.log("[playlist] created", playlistId, "uris sample:", uris.slice(0, 2));

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
