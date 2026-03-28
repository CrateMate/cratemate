import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchAlbumFeatures, type TracklistItem } from "@/lib/spotify";
import {
  getSpotifyFeaturesCache,
  upsertSpotifyFeaturesCache,
  isSpotifyFeaturesCacheFresh,
  spotifyFeaturesKey,
} from "@/lib/discogs/cache";

export const maxDuration = 60;

// POST: fetch + cache features for one record
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { record_id, artist, title, force } = await request.json().catch(() => ({}));
  if (!record_id || !artist || !title) {
    return NextResponse.json({ error: "Missing record_id, artist, or title" }, { status: 400 });
  }

  // Define cache key early — needed for not_found retry logic in step 1
  const cacheKey = spotifyFeaturesKey(artist, title);

  // 1. Check per-record cache (spotify_features table)
  if (!force) {
    const { data: cached } = await supabase
      .from("spotify_features")
      .select("*")
      .eq("record_id", record_id)
      .single();

    if (cached) {
      if (!cached.not_found) return NextResponse.json(cached);
      // not_found row: only honour if the shared cache is still fresh (within 1 day).
      // If the shared cache has expired, fall through and re-attempt — ReccoBeats may be back.
      const sharedCheck = await getSpotifyFeaturesCache(cacheKey);
      if (sharedCheck && isSpotifyFeaturesCacheFresh(sharedCheck)) {
        return NextResponse.json(cached);
      }
      // Shared cache stale — re-attempt below
    }
  }

  // 2. Look up the Discogs tracklist early — needed for Tier 2 and sentinel bypass
  let tracklist: TracklistItem[] | undefined;
  try {
    const { data: record } = await supabase
      .from("records")
      .select("discogs_id")
      .eq("id", record_id)
      .eq("user_id", userId)
      .single();

    if (record?.discogs_id) {
      const { data: releaseCache } = await supabase
        .from("discogs_metadata_cache")
        .select("tracklist")
        .eq("release_id", record.discogs_id)
        .single();

      if (releaseCache?.tracklist) {
        const parsed = JSON.parse(releaseCache.tracklist);
        if (Array.isArray(parsed)) tracklist = parsed as TracklistItem[];
      }
    }
  } catch { /* tracklist lookup is best-effort */ }

  // 3. Check shared features cache (spotify_features_cache) by artist|title key
  if (!force) {
    const sharedCached = await getSpotifyFeaturesCache(cacheKey);
    if (sharedCached && isSpotifyFeaturesCacheFresh(sharedCached)) {
      if (sharedCached.energy == null) {
        // "Not found" sentinel — but if a tracklist is now available that wasn't before,
        // bypass the sentinel and re-attempt (Tier 2 might succeed now)
        if (!tracklist || tracklist.length === 0) return NextResponse.json(null);
        // Tracklist available — fall through to re-fetch
      } else {
        const row = {
          record_id,
          energy: sharedCached.energy,
          valence: sharedCached.valence,
          danceability: sharedCached.danceability,
          acousticness: sharedCached.acousticness,
          tempo: sharedCached.tempo,
          loudness: sharedCached.loudness,
          not_found: false,
        };
        await supabase.from("spotify_features").upsert(row, { onConflict: "record_id" });
        return NextResponse.json(row);
      }
    }
  }

  // 4. Fetch features from Spotify → Tier 1 (album) → Tier 2 (tracks) → Tier 3 (artist)
  const features = await fetchAlbumFeatures(artist, title, tracklist).catch(() => null);
  if (!features) {
    // Cache "not found" sentinel for 1 day — retry daily in case ReccoBeats was having issues
    await upsertSpotifyFeaturesCache(cacheKey, {}, 1);
    // Only write the not_found sentinel if there are no real features already stored.
    // This prevents a failed force-backfill from overwriting good existing data.
    const { data: existing } = await supabase
      .from("spotify_features")
      .select("energy")
      .eq("record_id", record_id)
      .single();
    if (!existing?.energy) {
      await supabase.from("spotify_features").upsert({ record_id, not_found: true }, { onConflict: "record_id" });
    }
    return NextResponse.json(null);
  }

  // `source` and `track_features` handled separately
  const { source, track_features, ...dbFields } = features;
  // Explicitly clear not_found so a previously-failed record is fully recovered
  const row = { record_id, ...dbFields, not_found: false, ...(track_features ? { track_features } : {}) };
  const { error: upsertErr } = await supabase.from("spotify_features").upsert(row, { onConflict: "record_id" });
  if (upsertErr) console.error(`[features] upsert failed for ${record_id}:`, upsertErr.message);

  // Store in shared features cache (without source)
  await upsertSpotifyFeaturesCache(cacheKey, {
    energy: dbFields.energy,
    valence: dbFields.valence,
    danceability: dbFields.danceability,
    acousticness: dbFields.acousticness,
    tempo: dbFields.tempo,
    loudness: dbFields.loudness,
  });

  // Return with source so the client can show the right badge
  return NextResponse.json({ ...row, source });
}

// GET: return all cached features for the current user's collection
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Join spotify_features with the user's records
  const { data: records } = await supabase
    .from("records")
    .select("id")
    .eq("user_id", userId);

  if (!records || records.length === 0) return NextResponse.json({});

  const ids = records.map((r) => r.id);
  const { data: features } = await supabase
    .from("spotify_features")
    .select("*")
    .in("record_id", ids);

  // Return as a map: { [record_id]: features }
  const map: Record<string, object> = {};
  for (const f of features || []) {
    map[f.record_id] = f;
  }
  return NextResponse.json(map);
}
