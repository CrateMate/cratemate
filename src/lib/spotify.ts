import { supabase } from "@/lib/supabase";

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

async function spotifyGet(path: string): Promise<Response> {
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

// ---------- Album features (client credentials) ----------

export type SpotifyFeatures = {
  energy: number;
  tempo: number;
  valence: number;
  danceability: number;
  acousticness: number;
  loudness: number;
  track_count: number;
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
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True if Spotify album name is a reasonable match for the query title */
function titleMatches(spotifyName: string, queryTitle: string): boolean {
  const sn = normalise(spotifyName);
  const qt = normalise(queryTitle);
  return sn.includes(qt) || qt.includes(sn);
}

/** Pick the best album from a result set:
 *  1. Prefer albums whose name matches the query title
 *  2. Among those, prefer the earliest release year (original pressing)
 */
function pickBestAlbum(albums: SpotifyAlbum[], queryTitle: string): SpotifyAlbum | null {
  if (albums.length === 0) return null;
  const matching = albums.filter((a) => titleMatches(a.name, queryTitle));
  const pool = matching.length > 0 ? matching : albums;
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
    const pick = pickBestAlbum(albums, cleanedTitle);
    if (pick) return pick;
  }

  return null;
}

export async function fetchAlbumFeatures(
  artist: string,
  title: string
): Promise<SpotifyFeatures | null> {
  // Step 1: Find the best matching album on Spotify
  const album = await searchAlbum(artist, title);
  if (!album) return null;

  // Step 2: Get track IDs from the album
  const tracksRes = await spotifyGet(`/albums/${album.id}/tracks?limit=50`);
  if (!tracksRes.ok) return null;
  const tracksData = await tracksRes.json();
  const trackIds: string[] = (tracksData.items || []).map((t: { id: string }) => t.id).filter(Boolean);
  if (trackIds.length === 0) return null;

  // Step 3: Fetch audio features from ReccoBeats using Spotify track IDs
  const ids = trackIds.slice(0, 100).join(",");
  const featuresRes = await fetch(`${RECCOBEATS_BASE}/v1/audio-features?ids=${ids}`);
  if (!featuresRes.ok) return null;

  const featuresData = await featuresRes.json();
  const features: Array<{
    energy: number;
    tempo: number;
    valence: number;
    danceability: number;
    acousticness: number;
    loudness: number;
  } | null> = featuresData.content || [];

  const valid = features.filter(Boolean) as Array<{
    energy: number;
    tempo: number;
    valence: number;
    danceability: number;
    acousticness: number;
    loudness: number;
  }>;
  if (valid.length === 0) return null;

  const avg = (key: keyof typeof valid[0]) =>
    valid.reduce((sum, f) => sum + f[key], 0) / valid.length;

  return {
    energy: avg("energy"),
    tempo: avg("tempo"),
    valence: avg("valence"),
    danceability: avg("danceability"),
    acousticness: avg("acousticness"),
    loudness: avg("loudness"),
    track_count: valid.length,
  };
}
