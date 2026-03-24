import { supabase } from "@/lib/supabase";
import {
  getSpotifyFeaturesCache,
  upsertSpotifyFeaturesCache,
  isSpotifyFeaturesCacheFresh,
} from "@/lib/discogs/cache";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

const RECCOBEATS_BASE = "https://api.reccobeats.com";

// In-memory token cache
let _tokenCache: { token: string; expiresAt: number } = { token: "", expiresAt: 0 };

async function getToken(): Promise<string> {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt - 5000) {
    return _tokenCache.token;
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token error: ${res.status}`);
  const data = await res.json();
  _tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return _tokenCache.token;
}

export async function spotifyGet(path: string): Promise<Response> {
  const token = await getToken();
  return fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---------- User OAuth token management ----------

/** Get a valid access token for a user, refreshing if needed. Returns null if not connected. */
export async function getUserAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("spotify_user_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  // Still valid (60s buffer)
  if (new Date(data.expires_at) > new Date(Date.now() + 60_000)) {
    return data.access_token;
  }

  // Refresh
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: data.refresh_token }),
  });

  if (!res.ok) return null;

  const refreshed = await res.json();
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase.from("spotify_user_tokens").update({
    access_token: refreshed.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
    ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
  }).eq("user_id", userId);

  return refreshed.access_token;
}

/** Spotify API call authenticated as a specific user. Throws if not connected. */
export async function spotifyUserGet(path: string, userId: string): Promise<Response> {
  const token = await getUserAccessToken(userId);
  if (!token) throw new Error("Spotify not connected");
  return fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function spotifyUserPost(path: string, userId: string, body: unknown): Promise<Response> {
  const token = await getUserAccessToken(userId);
  if (!token) throw new Error("Spotify not connected");
  return fetch(`https://api.spotify.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function spotifyUserDelete(path: string, userId: string): Promise<Response> {
  const token = await getUserAccessToken(userId);
  if (!token) throw new Error("Spotify not connected");
  return fetch(`https://api.spotify.com/v1${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Authenticated Spotify request using a raw token (no userId lookup). */
export async function spotifyUserReqWithToken(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------- Track matching ----------

type SpotifyTrackItem = { uri: string; name: string; artists: Array<{ name: string }> };

/** Score a Spotify track result against a query artist+title. Higher = better match. Returns 0 for no match. */
export function scoreTrackMatch(
  item: SpotifyTrackItem,
  queryArtist: string,
  queryTitle: string,
): number {
  const nTitle = normalise(queryTitle);
  const nArtist = normalise(queryArtist);
  const sTitle = normalise(item.name);
  const sArtists = item.artists.map((a) => normalise(a.name));

  // Title must at least partially match
  const titleExact = sTitle === nTitle;
  const titleContains = sTitle.includes(nTitle) || nTitle.includes(sTitle);
  if (!titleContains) return 0;

  // Artist matching
  const artistExact = sArtists.some((a) => a === nArtist);
  const artistContains = sArtists.some(
    (a) => a.includes(nArtist) || nArtist.includes(a),
  );

  let score = 0;
  if (titleExact) score += 10;
  else if (titleContains) score += 5;
  if (artistExact) score += 10;
  else if (artistContains) score += 5;

  return score;
}

/** Pick the best track from search results, or null if nothing scores above 0. */
export function bestTrackMatch(
  items: SpotifyTrackItem[],
  queryArtist: string,
  queryTitle: string,
): string | null {
  let best: { uri: string; score: number } | null = null;
  for (const item of items) {
    const score = scoreTrackMatch(item, queryArtist, queryTitle);
    if (score > 0 && (!best || score > best.score)) {
      best = { uri: item.uri, score };
    }
  }
  return best?.uri ?? null;
}

// ---------- Album features (client credentials) ----------

export type SpotifyFeatures = {
  energy: number;
  tempo: number;
  valence: number;
  danceability: number;
  acousticness: number;
  loudness: number;
  track_count: number;
  source?: "album" | "tracks" | "artist"; // which tier resolved the features
};

export type TracklistItem = {
  type: string;
  position: string;
  title: string;
  duration: string;
};

type SpotifyAlbum = {
  id: string;
  name: string;
  release_date: string;
  artists: Array<{ name: string }>;
};

/** Strip common suffixes that appear in Discogs titles but not Spotify album names */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(.*?(remaster|remastered|deluxe|expanded|anniversary|edition|version|mono|stereo|bonus|limited|special|re-?issue|re-?release|re-?mix|reissue)[^)]*\)/gi, "")
    .replace(/\s*\[.*?(remaster|remastered|deluxe|expanded|anniversary|edition|version|mono|stereo|bonus|limited|special)[^\]]*\]/gi, "")
    .replace(/\s*-\s*(remastered|remaster)\s*(\d{4})?$/gi, "")
    .trim();
}

/** Normalise a string for loose comparison */
export function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True if Spotify album name is a reasonable match for the query title */
function titleMatches(spotifyName: string, queryTitle: string): boolean {
  const sn = normalise(spotifyName);
  const qt = normalise(queryTitle);
  return sn.includes(qt) || qt.includes(sn);
}

/** Check if any album artist loosely matches the query artist */
function artistMatches(album: SpotifyAlbum, queryArtist: string): boolean {
  const qa = normalise(queryArtist);
  return album.artists.some((a) => {
    const sa = normalise(a.name);
    return sa === qa || sa.includes(qa) || qa.includes(sa);
  });
}

/** Pick the best album from a result set:
 *  1. Prefer albums whose artist AND title both match
 *  2. Fall back to title-only matches
 *  3. Among matches, prefer the earliest release year (original pressing)
 */
function pickBestAlbum(albums: SpotifyAlbum[], queryTitle: string, queryArtist?: string): SpotifyAlbum | null {
  if (albums.length === 0) return null;
  const titleMatch = albums.filter((a) => titleMatches(a.name, queryTitle));
  // For generic titles like "Greatest Hits", artist match is critical
  const bothMatch = queryArtist
    ? titleMatch.filter((a) => artistMatches(a, queryArtist))
    : [];
  const pool = bothMatch.length > 0 ? bothMatch : titleMatch.length > 0 ? titleMatch : albums;
  return pool.reduce((best, a) => {
    const bestYear = parseInt(best.release_date) || 9999;
    const aYear = parseInt(a.release_date) || 9999;
    return aYear < bestYear ? a : best;
  });
}

/** Search Spotify for an album using multiple strategies, returning the best match */
async function searchAlbum(artist: string, title: string): Promise<SpotifyAlbum | null> {
  const cleanedTitle = cleanTitle(title);
  const isVA = /^various(\s+artists?)?$/i.test(artist.trim());

  const strategies: string[] = [];

  if (!isVA) {
    // Strategy 1: field-filtered with cleaned title
    strategies.push(`album:${cleanedTitle} artist:${artist}`);
    // Strategy 2: field-filtered with original title (in case cleaning was too aggressive)
    if (cleanedTitle !== title) strategies.push(`album:${title} artist:${artist}`);
    // Strategy 3: plain text fallback
    strategies.push(`${cleanedTitle} ${artist}`);
  }
  // Strategy for compilations / Various Artists: search by title only
  strategies.push(`album:${cleanedTitle}`);

  for (const q of strategies) {
    const res = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=album&limit=5`);
    if (!res.ok) continue;
    const data = await res.json();
    const albums: SpotifyAlbum[] = data.albums?.items || [];
    const pick = pickBestAlbum(albums, cleanedTitle, artist);
    if (pick) return pick;
  }

  return null;
}

type RawFeature = {
  energy: number; tempo: number; valence: number;
  danceability: number; acousticness: number; loudness: number;
};

function avgFeatures(valid: RawFeature[], source: SpotifyFeatures["source"]): SpotifyFeatures {
  const avg = (key: keyof RawFeature) =>
    valid.reduce((sum, f) => sum + f[key], 0) / valid.length;
  return {
    energy: avg("energy"), tempo: avg("tempo"), valence: avg("valence"),
    danceability: avg("danceability"), acousticness: avg("acousticness"),
    loudness: avg("loudness"), track_count: valid.length, source,
  };
}

async function reccoBeatsFeatures(trackIds: string[]): Promise<RawFeature[]> {
  const ids = trackIds.slice(0, 100).join(",");
  const res = await fetch(`${RECCOBEATS_BASE}/v1/audio-features?ids=${ids}`);
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.content || []) as (RawFeature | null)[]).filter(Boolean) as RawFeature[];
}

// Tier 2: search for individual tracks from the Discogs tracklist on Spotify,
// then average their features. Needs ≥2 track matches to be considered valid.
async function fetchFeaturesByTracks(
  artist: string,
  tracklist: TracklistItem[]
): Promise<SpotifyFeatures | null> {
  const isVA = /^various(\s+artists?)?$/i.test(artist.trim());
  if (isVA) return null;

  const candidates = tracklist.filter(t => t.type === "track" && t.title).slice(0, 5);
  if (candidates.length < 2) return null;

  const spotifyIds: string[] = [];
  for (const track of candidates) {
    const q = `track:${cleanTitle(track.title)} artist:${artist}`;
    const res = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=track&limit=3`);
    if (!res.ok) continue;
    const data = await res.json();
    const items: Array<{ id: string; name: string }> = data.tracks?.items || [];
    const best = items.find(t =>
      normalise(t.name).includes(normalise(track.title)) ||
      normalise(track.title).includes(normalise(t.name))
    );
    if (best) spotifyIds.push(best.id);
  }

  if (spotifyIds.length < 2) return null;
  const valid = await reccoBeatsFeatures(spotifyIds);
  if (valid.length < 2) return null;
  return avgFeatures(valid, "tracks");
}

// Tier 3: find the artist on Spotify and average their top tracks.
// Not album-specific but much better than genre estimates for any artist on Spotify.
// Results are cached under the key "artist:{normalised(artist)}" for 90 days.
async function fetchFeaturesByArtist(artist: string): Promise<SpotifyFeatures | null> {
  const isVA = /^various(\s+artists?)?$/i.test(artist.trim());
  if (isVA) return null;

  const cacheKey = `artist:${normalise(artist)}`;

  // Check artist-level cache first
  const cached = await getSpotifyFeaturesCache(cacheKey);
  if (cached && isSpotifyFeaturesCacheFresh(cached)) {
    // null-energy sentinel means "not found" — skip API calls
    if (cached.energy == null) return null;
    return {
      energy: cached.energy!, tempo: cached.tempo!, valence: cached.valence!,
      danceability: cached.danceability!, acousticness: cached.acousticness!,
      loudness: cached.loudness!, track_count: 0, source: "artist",
    };
  }

  const artistRes = await spotifyGet(
    `/search?q=${encodeURIComponent(artist)}&type=artist&limit=5`
  );
  if (!artistRes.ok) return null;
  const artistData = await artistRes.json();
  const artists: Array<{ id: string; name: string }> = artistData.artists?.items || [];

  const best = artists.find(a =>
    normalise(a.name) === normalise(artist) ||
    normalise(a.name).includes(normalise(artist)) ||
    normalise(artist).includes(normalise(a.name))
  );
  if (!best) {
    // Cache "not found" sentinel for 90 days (matches success TTL)
    await upsertSpotifyFeaturesCache(cacheKey, {}, 90);
    return null;
  }

  // Artist top-tracks endpoint removed Feb 2026. Use track search instead.
  const trackSearchRes = await spotifyGet(
    `/search?q=${encodeURIComponent(`artist:"${best.name}"`)}&type=track&limit=10`
  );
  if (!trackSearchRes.ok) return null;
  const trackSearchData = await trackSearchRes.json();
  const trackItems: Array<{ id: string; artists: Array<{ id: string }> }> =
    trackSearchData.tracks?.items || [];
  // Filter to tracks actually by this artist (search can return loose matches)
  const trackIds: string[] = trackItems
    .filter((t) => t.artists.some((a) => a.id === best.id))
    .slice(0, 10)
    .map((t) => t.id);
  if (trackIds.length === 0) return null;

  const valid = await reccoBeatsFeatures(trackIds);
  if (valid.length === 0) return null;

  const result = avgFeatures(valid, "artist");

  // Cache artist-level features for 90 days
  await upsertSpotifyFeaturesCache(cacheKey, {
    energy: result.energy, tempo: result.tempo, valence: result.valence,
    danceability: result.danceability, acousticness: result.acousticness,
    loudness: result.loudness,
  }, 90);

  return result;
}

export async function fetchAlbumFeatures(
  artist: string,
  title: string,
  tracklist?: TracklistItem[]
): Promise<SpotifyFeatures | null> {
  const tag = `[features] "${title}" — ${artist}`;

  // Tier 1: Match the whole album on Spotify
  const album = await searchAlbum(artist, title);
  if (!album) {
    console.log(`${tag} T1: no album found on Spotify`);
  } else {
    const tracksRes = await spotifyGet(`/albums/${album.id}/tracks?limit=50`);
    if (tracksRes.ok) {
      const tracksData = await tracksRes.json();
      const trackIds: string[] = (tracksData.items || [])
        .map((t: { id: string }) => t.id)
        .filter(Boolean);
      if (trackIds.length > 0) {
        const valid = await reccoBeatsFeatures(trackIds);
        console.log(`${tag} T1: album "${album.name}" found, ${trackIds.length} tracks → ReccoBeats returned ${valid.length}`);
        if (valid.length > 0) return avgFeatures(valid, "album");
      } else {
        console.log(`${tag} T1: album found but 0 track IDs`);
      }
    } else {
      console.log(`${tag} T1: album tracks fetch failed ${tracksRes.status}`);
    }
  }

  // Tier 2: Match individual tracks from the Discogs tracklist
  if (tracklist && tracklist.length > 0) {
    const byTracks = await fetchFeaturesByTracks(artist, tracklist);
    console.log(`${tag} T2: ${byTracks ? "success" : "failed"}`);
    if (byTracks) return byTracks;
  } else {
    console.log(`${tag} T2: skipped (no tracklist)`);
  }

  // Tier 3: Artist top tracks on Spotify
  const byArtist = await fetchFeaturesByArtist(artist);
  console.log(`${tag} T3: ${byArtist ? "success" : "failed"}`);
  if (byArtist) return byArtist;

  return null;
}
