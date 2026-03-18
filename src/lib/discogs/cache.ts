import { supabase } from "@/lib/supabase";

type ReleaseCacheRow = {
  release_id: number;
  cover_image?: string | null;
  thumb?: string | null;
  tracklist?: string | null;
  year_cached_at?: string | null;
  year_pressed?: number | null;
  year_original?: number | null;
  updated_at?: string | null;
  cached_at?: string | null;
  expires_at?: string | null;
  master_id?: number | null;
  genres?: string | null;
  styles?: string | null;
};

/** Lowercase + strip non-alphanumeric + collapse whitespace */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isFresh(row: { expires_at?: string | null } | null): boolean {
  if (!row?.expires_at) return false;
  return new Date(row.expires_at) > new Date();
}

// ---------- Release cache ----------

export async function getReleaseCache(releaseId: number) {
  const { data } = await supabase
    .from("discogs_metadata_cache")
    .select("*")
    .eq("release_id", releaseId)
    .single();
  if (!data) return null;
  // Stale-while-revalidate: return data even if expired (caller will re-fetch on miss)
  return data as ReleaseCacheRow;
}

export async function upsertReleaseCache(releaseId: number, payload: Partial<ReleaseCacheRow>) {
  const now = new Date().toISOString();
  const normalized = {
    ...payload,
    release_id: releaseId,
    updated_at: now,
    cached_at: now,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await supabase.from("discogs_metadata_cache").upsert(normalized, { onConflict: "release_id" });
}

export function isReleaseCacheFresh(row: ReleaseCacheRow | null): boolean {
  return isFresh(row);
}

// ---------- Master release cache ----------

type MasterCacheRow = {
  master_id: number;
  canonical_title?: string | null;
  canonical_artist?: string | null;
  year_original?: number | null;
  thumb?: string | null;
  release_count?: number | null;
  versions?: unknown;
  cached_at?: string | null;
  expires_at?: string | null;
};

export async function getMasterCache(masterId: number) {
  const { data } = await supabase
    .from("master_release_cache")
    .select("*")
    .eq("master_id", masterId)
    .single();
  if (!data) return null;
  return data as MasterCacheRow;
}

export async function upsertMasterCache(masterId: number, payload: Partial<Omit<MasterCacheRow, "master_id">>) {
  const now = new Date().toISOString();
  await supabase.from("master_release_cache").upsert(
    {
      ...payload,
      master_id: masterId,
      cached_at: now,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "master_id" }
  );
}

export function isMasterCacheFresh(row: MasterCacheRow | null): boolean {
  return isFresh(row);
}

// ---------- Spotify features cache ----------

type SpotifyFeaturesCacheRow = {
  cache_key: string;
  energy?: number | null;
  valence?: number | null;
  danceability?: number | null;
  acousticness?: number | null;
  tempo?: number | null;
  loudness?: number | null;
  cached_at?: string | null;
  expires_at?: string | null;
};

export function spotifyFeaturesKey(artist: string, title: string): string {
  return `${normalize(artist)}|${normalize(title)}`;
}

export async function getSpotifyFeaturesCache(key: string) {
  const { data } = await supabase
    .from("spotify_features_cache")
    .select("*")
    .eq("cache_key", key)
    .single();
  if (!data) return null;
  return data as SpotifyFeaturesCacheRow;
}

export async function upsertSpotifyFeaturesCache(
  key: string,
  features: Omit<SpotifyFeaturesCacheRow, "cache_key" | "cached_at" | "expires_at">
) {
  const now = new Date().toISOString();
  await supabase.from("spotify_features_cache").upsert(
    {
      ...features,
      cache_key: key,
      cached_at: now,
      expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "cache_key" }
  );
}

export function isSpotifyFeaturesCacheFresh(row: SpotifyFeaturesCacheRow | null): boolean {
  return isFresh(row);
}

// ---------- iTunes art cache ----------

type ItunesArtCacheRow = {
  cache_key: string;
  art_url?: string | null;
  cached_at?: string | null;
  expires_at?: string | null;
};

export function itunesArtKey(artist: string, title: string): string {
  return `${normalize(artist)}|${normalize(title)}`;
}

export async function getItunesArtCache(key: string) {
  const { data } = await supabase
    .from("itunes_art_cache")
    .select("*")
    .eq("cache_key", key)
    .single();
  if (!data) return null;
  return data as ItunesArtCacheRow;
}

export async function upsertItunesArtCache(key: string, artUrl: string | null) {
  const now = new Date().toISOString();
  await supabase.from("itunes_art_cache").upsert(
    {
      cache_key: key,
      art_url: artUrl,
      cached_at: now,
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "cache_key" }
  );
}

export function isItunesArtCacheFresh(row: ItunesArtCacheRow | null): boolean {
  return isFresh(row);
}

// ---------- Discogs price cache ----------

type PriceCacheRow = {
  release_id: number;
  min_price?: number | null;
  currency?: string | null;
  condition?: string | null;
  ships_from?: string | null;
  cached_at?: string | null;
  expires_at?: string | null;
};

export async function getPriceCache(releaseId: number) {
  const { data } = await supabase
    .from("discogs_price_cache")
    .select("*")
    .eq("release_id", releaseId)
    .single();
  if (!data) return null;
  return data as PriceCacheRow;
}

export async function upsertPriceCache(releaseId: number, payload: Omit<PriceCacheRow, "release_id" | "cached_at" | "expires_at">) {
  const now = new Date().toISOString();
  await supabase.from("discogs_price_cache").upsert(
    {
      ...payload,
      release_id: releaseId,
      cached_at: now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "release_id" }
  );
}

export function isPriceCacheFresh(row: PriceCacheRow | null): boolean {
  return isFresh(row);
}
