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

// POST: fetch + cache features for one record
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { record_id, artist, title, force } = await request.json().catch(() => ({}));
  if (!record_id || !artist || !title) {
    return NextResponse.json({ error: "Missing record_id, artist, or title" }, { status: 400 });
  }

  // 1. Check per-record cache (spotify_features table)
  if (!force) {
    const { data: cached } = await supabase
      .from("spotify_features")
      .select("*")
      .eq("record_id", record_id)
      .single();

    if (cached) return NextResponse.json(cached);
  }

  // 2. Check shared features cache (spotify_features_cache) by artist|title key
  const cacheKey = spotifyFeaturesKey(artist, title);
  if (!force) {
    const sharedCached = await getSpotifyFeaturesCache(cacheKey);
    if (sharedCached && isSpotifyFeaturesCacheFresh(sharedCached)) {
      // null-energy sentinel means all tiers failed for this title — skip API calls
      if (sharedCached.energy == null) return NextResponse.json(null);
      const row = {
        record_id,
        energy: sharedCached.energy,
        valence: sharedCached.valence,
        danceability: sharedCached.danceability,
        acousticness: sharedCached.acousticness,
        tempo: sharedCached.tempo,
        loudness: sharedCached.loudness,
      };
      await supabase.from("spotify_features").upsert(row);
      return NextResponse.json(row);
    }
  }

  // 3. Look up the Discogs tracklist from the release cache — used for Tier 2 fallback
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

  // 4. Fetch features from Spotify → Tier 1 (album) → Tier 2 (tracks) → Tier 3 (artist)
  const features = await fetchAlbumFeatures(artist, title, tracklist).catch(() => null);
  if (!features) {
    // Cache "not found" sentinel for 14 days so we don't re-attempt every time
    await upsertSpotifyFeaturesCache(cacheKey, {}, 14);
    return NextResponse.json(null);
  }

  // `source` is a client-side label only — strip it before writing to DB
  const { source, ...dbFields } = features;
  const row = { record_id, ...dbFields };
  await supabase.from("spotify_features").upsert(row);

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
