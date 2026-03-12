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
};

export async function getReleaseCache(releaseId: number) {
  const { data } = await supabase
    .from("discogs_metadata_cache")
    .select("*")
    .eq("release_id", releaseId)
    .single();
  return data as ReleaseCacheRow | null;
}

export async function upsertReleaseCache(releaseId: number, payload: Partial<ReleaseCacheRow>) {
  const normalized = { ...payload, release_id: releaseId, updated_at: new Date().toISOString() };
  await supabase.from("discogs_metadata_cache").upsert(normalized, { onConflict: "release_id" });
}
