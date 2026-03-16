const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

// In-memory token cache (reused across requests within the same server instance)
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

export type SpotifyFeatures = {
  energy: number;
  tempo: number;
  valence: number;
  danceability: number;
  acousticness: number;
  loudness: number;
  track_count: number;
};

export async function fetchAlbumFeatures(
  artist: string,
  title: string
): Promise<SpotifyFeatures | null> {
  // Search for the album
  const q = encodeURIComponent(`album:${title} artist:${artist}`);
  const searchRes = await spotifyGet(`/search?q=${q}&type=album&limit=3`);
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const albums: Array<{ id: string }> = searchData.albums?.items || [];
  if (albums.length === 0) return null;

  const albumId = albums[0].id;

  // Get all tracks from the album
  const tracksRes = await spotifyGet(`/albums/${albumId}/tracks?limit=50`);
  if (!tracksRes.ok) return null;
  const tracksData = await tracksRes.json();
  const trackIds: string[] = (tracksData.items || []).map((t: { id: string }) => t.id).filter(Boolean);
  if (trackIds.length === 0) return null;

  // Batch fetch audio features (max 100 per request)
  const ids = trackIds.slice(0, 100).join(",");
  const featuresRes = await spotifyGet(`/audio-features?ids=${ids}`);
  if (!featuresRes.ok) return null;
  const featuresData = await featuresRes.json();
  const features: Array<{
    energy: number;
    tempo: number;
    valence: number;
    danceability: number;
    acousticness: number;
    loudness: number;
  } | null> = featuresData.audio_features || [];

  const valid = features.filter(Boolean) as Array<{
    energy: number;
    tempo: number;
    valence: number;
    danceability: number;
    acousticness: number;
    loudness: number;
  }>;
  if (valid.length === 0) return null;

  // Average all track features
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
