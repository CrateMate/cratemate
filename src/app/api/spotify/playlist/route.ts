import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getUserAccessToken,
  spotifyGet,
  spotifyUserReqWithToken,
  bestTrackMatch,
} from "@/lib/spotify";

type TrackInput = { artist: string; trackTitle: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip Discogs artist numbering, "feat." clauses, and trailing junk. */
function cleanArtist(artist: string): string {
  return artist
    .replace(/\s*\(\d+\)$/, "")                       // Discogs numbering e.g. "Prince (2)"
    .replace(/\s*feat\.?\s+.+$/i, "")                  // "Artist feat. X" → "Artist"
    .replace(/\s*ft\.?\s+.+$/i, "")                    // "Artist ft X"
    .replace(/\s*&\s+(?:his|her|the)\s+.+$/i, "")     // "Duke Ellington & His Orchestra"
    .trim();
}

/** Extract featured artists from the artist string, if any. */
function extractFeaturedArtist(artist: string): string | null {
  const m = artist.match(/\s*(?:feat\.?|ft\.?)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Strip Discogs track-title noise that hurts Spotify search. */
function cleanTrackTitle(title: string): string {
  return title
    .replace(/\s*=\s*.+$/, "")                         // "Title = Translation"
    .replace(/\s*\(feat\.?\s+[^)]+\)/gi, "")           // "(feat. X)" in title
    .replace(/\s*\(ft\.?\s+[^)]+\)/gi, "")             // "(ft. X)"
    .replace(/\s*\[bonus\s+track\]/gi, "")              // "[Bonus Track]"
    .replace(/\s*\(bonus\s+track\)/gi, "")              // "(Bonus Track)"
    .trim();
}

/** Delete an orphaned playlist the user owns (best-effort, non-fatal). */
async function deletePlaylist(playlistId: string, token: string) {
  try {
    await spotifyUserReqWithToken("DELETE", `/playlists/${playlistId}/followers`, token);
  } catch { /* ignore */ }
}

const BATCH_SIZE = 4;       // concurrent searches per batch
const BATCH_DELAY = 500;    // ms between batches
const MAX_RATE_RETRIES = 3; // retries before giving up on rate limits

type SearchResult =
  | { uri: string }
  | { rateLimited: true; retryAfter: number }
  | null;

/** Search Spotify for a single track using the shared scoring logic. */
async function searchTrack(
  artist: string,
  title: string,
  featured: string | null,
): Promise<SearchResult> {
  // Strategy 1: field-filtered exact search
  const q1 = `track:"${title}" artist:"${artist}"`;
  const r1 = await doSearch(q1, artist, title);
  if (r1 && "rateLimited" in r1) return r1;
  if (r1 && "uri" in r1) return r1;

  // Strategy 2: include featured artist in search
  if (featured) {
    const q2 = `track:"${title}" artist:"${artist}" "${featured}"`;
    const r2 = await doSearch(q2, artist, title);
    if (r2 && "rateLimited" in r2) return r2;
    if (r2 && "uri" in r2) return r2;
  }

  // Strategy 3: broad text search
  const q3 = `${title} ${artist}`;
  const r3 = await doSearch(q3, artist, title);
  if (r3 && "rateLimited" in r3) return r3;
  if (r3 && "uri" in r3) return r3;

  return null;
}

/** Execute a single Spotify search and score results. */
async function doSearch(
  q: string,
  artist: string,
  title: string,
): Promise<SearchResult> {
  const res = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=track&limit=5`);
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "15");
    return { rateLimited: true, retryAfter };
  }
  if (!res.ok) {
    console.log("[playlist] search non-ok", res.status, q);
    return null;
  }
  const data = await res.json();
  const items = data.tracks?.items || [];
  const uri = bestTrackMatch(items, artist, title);
  return uri ? { uri } : null;
}

/** Process a single track: clean, search, return URI or not-found label. */
async function resolveTrack(
  track: TrackInput,
): Promise<{ uri: string } | { notFound: string }> {
  const artist = cleanArtist(track.artist);
  const featured = extractFeaturedArtist(track.artist);
  const title = cleanTrackTitle(track.trackTitle);

  const result = await searchTrack(artist, title, featured);

  if (result && "rateLimited" in result) {
    // Caller handles retry — bubble up as a special throw
    throw { rateLimited: true, retryAfter: result.retryAfter };
  }

  if (result && "uri" in result) return { uri: result.uri };
  return { notFound: `${track.artist} — ${track.trackTitle}` };
}

export const maxDuration = 60; // Vercel Hobby ceiling

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

    // ---------- Search in batches ----------
    const uris: string[] = [];
    const notFound: string[] = [];
    let rateLimitRetries = 0;

    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      const batch = tracks.slice(i, i + BATCH_SIZE);

      try {
        const results = await Promise.allSettled(batch.map((t) => resolveTrack(t)));

        for (const r of results) {
          if (r.status === "fulfilled") {
            if ("uri" in r.value) uris.push(r.value.uri);
            else notFound.push(r.value.notFound);
          } else {
            // Check for rate-limit signal
            const reason = r.reason as { rateLimited?: boolean; retryAfter?: number } | undefined;
            if (reason?.rateLimited) {
              throw reason; // break to outer catch
            }
            // Unexpected rejection — treat as not found
            const track = batch[results.indexOf(r)];
            if (track) notFound.push(`${track.artist} — ${track.trackTitle}`);
          }
        }
      } catch (e: unknown) {
        const rl = e as { rateLimited?: boolean; retryAfter?: number };
        if (rl?.rateLimited && rateLimitRetries < MAX_RATE_RETRIES) {
          rateLimitRetries++;
          const waitMs = (rl.retryAfter || 15) * 1000;
          console.log(`[playlist] rate limited, waiting ${waitMs}ms (retry ${rateLimitRetries}/${MAX_RATE_RETRIES})`);
          await sleep(waitMs);
          i -= BATCH_SIZE; // re-process this batch
          continue;
        }
        if (rl?.rateLimited) {
          return NextResponse.json({ error: "rate_limited", retryAfter: rl.retryAfter || 15 }, { status: 429 });
        }
        throw e;
      }

      // Pause between batches to stay under rate limits
      if (i + BATCH_SIZE < tracks.length) await sleep(BATCH_DELAY);
    }

    // ---------- Deduplicate URIs ----------
    const uniqueUris = [...new Set(uris)];

    if (uniqueUris.length === 0) {
      return NextResponse.json({ error: "no_tracks_found", matched: 0, total: tracks.length, notFound }, { status: 422 });
    }

    // ---------- Create playlist ----------
    const createRes = await spotifyUserReqWithToken("POST", `/me/playlists`, token, {
      name, public: isPublic, description: "Created with CrateMate",
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      console.error("[playlist] create failed:", createRes.status, JSON.stringify(errBody));
      return NextResponse.json({
        error: "create_failed",
        spotify_status: createRes.status,
        spotify_error: errBody,
      }, { status: 500 });
    }

    const playlist = await createRes.json();
    const playlistId: string = playlist.id;
    const playlistUrl: string = playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`;

    // ---------- Add tracks (batches of 100) ----------
    for (let i = 0; i < uniqueUris.length; i += 100) {
      const addRes = await spotifyUserReqWithToken("POST", `/playlists/${playlistId}/tracks`, token, {
        uris: uniqueUris.slice(i, i + 100),
      });
      if (!addRes.ok) {
        const errBody = await addRes.json().catch(() => ({}));
        console.error("[playlist] add tracks failed:", addRes.status, JSON.stringify(errBody));
        if (i === 0) await deletePlaylist(playlistId, token);
        return NextResponse.json({
          error: "add_tracks_failed",
          spotify_status: addRes.status,
          spotify_error: errBody,
          matched: i,
          total: tracks.length,
          notFound,
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      playlistUrl,
      matched: uniqueUris.length,
      total: tracks.length,
      notFound,
      deduplicated: uris.length - uniqueUris.length,
    });
  } catch (err) {
    console.error("[playlist] unhandled error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
