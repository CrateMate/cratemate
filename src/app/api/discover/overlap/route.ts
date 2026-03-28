import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { DISCOGS_API, discogsRequest } from "@/lib/discogs";

type RecordRow = {
  artist: string;
  title: string;
  thumb: string | null;
  genre?: string | null;
  style?: string | null;
  year_original?: number | null;
  year_pressed?: number | null;
  master_id?: number | null;
  discogs_id?: number | null;
};

type AudioProfile = {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  loudness: number;
};

// Mirrors GENRE_AUDIO_PROFILES in CrateMate.jsx (tempo omitted — not needed for radar)
const GENRE_PROFILES: Record<string, AudioProfile> = {
  "electronic":       { energy: 0.82, valence: 0.58, danceability: 0.78, acousticness: 0.05, loudness: 0.89 },
  "house":            { energy: 0.86, valence: 0.64, danceability: 0.87, acousticness: 0.02, loudness: 0.89 },
  "techno":           { energy: 0.88, valence: 0.48, danceability: 0.84, acousticness: 0.02, loudness: 0.93 },
  "ambient":          { energy: 0.28, valence: 0.45, danceability: 0.25, acousticness: 0.75, loudness: 0.37 },
  "jazz":             { energy: 0.44, valence: 0.58, danceability: 0.55, acousticness: 0.72, loudness: 0.59 },
  "classical":        { energy: 0.34, valence: 0.52, danceability: 0.28, acousticness: 0.92, loudness: 0.19 },
  "metal":            { energy: 0.92, valence: 0.38, danceability: 0.55, acousticness: 0.05, loudness: 0.85 },
  "punk":             { energy: 0.90, valence: 0.55, danceability: 0.65, acousticness: 0.05, loudness: 0.81 },
  "rock":             { energy: 0.76, valence: 0.54, danceability: 0.60, acousticness: 0.15, loudness: 0.78 },
  "alternative rock": { energy: 0.72, valence: 0.48, danceability: 0.57, acousticness: 0.18, loudness: 0.78 },
  "indie rock":       { energy: 0.65, valence: 0.50, danceability: 0.58, acousticness: 0.25, loudness: 0.74 },
  "pop":              { energy: 0.68, valence: 0.70, danceability: 0.72, acousticness: 0.20, loudness: 0.85 },
  "hip hop":          { energy: 0.70, valence: 0.55, danceability: 0.80, acousticness: 0.15, loudness: 0.81 },
  "r&b":              { energy: 0.60, valence: 0.60, danceability: 0.74, acousticness: 0.30, loudness: 0.78 },
  "soul":             { energy: 0.62, valence: 0.66, danceability: 0.70, acousticness: 0.40, loudness: 0.70 },
  "funk":             { energy: 0.78, valence: 0.72, danceability: 0.82, acousticness: 0.15, loudness: 0.74 },
  "blues":            { energy: 0.52, valence: 0.48, danceability: 0.58, acousticness: 0.55, loudness: 0.67 },
  "country":          { energy: 0.56, valence: 0.65, danceability: 0.62, acousticness: 0.55, loudness: 0.70 },
  "folk":             { energy: 0.42, valence: 0.58, danceability: 0.45, acousticness: 0.78, loudness: 0.59 },
  "reggae":           { energy: 0.58, valence: 0.72, danceability: 0.78, acousticness: 0.30, loudness: 0.74 },
  "latin":            { energy: 0.72, valence: 0.78, danceability: 0.84, acousticness: 0.22, loudness: 0.81 },
  "disco":            { energy: 0.80, valence: 0.78, danceability: 0.88, acousticness: 0.08, loudness: 0.78 },
  "dance":            { energy: 0.84, valence: 0.68, danceability: 0.86, acousticness: 0.05, loudness: 0.89 },
};

function estimateFeatures(r: RecordRow): AudioProfile {
  const combined = `${r.genre || ""} ${r.style || ""}`.toLowerCase();
  const match = Object.entries(GENRE_PROFILES).find(([key]) => combined.includes(key));
  const base: AudioProfile = match
    ? { ...match[1] }
    : { energy: 0.60, valence: 0.55, danceability: 0.60, acousticness: 0.40, loudness: 0.70 };
  const year = r.year_original || r.year_pressed;
  if (year && year < 1965) base.acousticness = Math.min(1, base.acousticness + 0.2);
  else if (year && year >= 1990) base.acousticness = Math.max(0, base.acousticness - 0.08);
  return base;
}

function avgProfile(records: RecordRow[]): AudioProfile | null {
  if (records.length === 0) return null;
  const features = records.map(estimateFeatures);
  const keys: (keyof AudioProfile)[] = ["energy", "valence", "danceability", "acousticness", "loudness"];
  const result = {} as AudioProfile;
  for (const key of keys) {
    result[key] = features.reduce((s, f) => s + f[key], 0) / features.length;
  }
  return result;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  // Look up their user_id from user_profiles (works for all users, not just Discogs)
  const { data: profileRows } = await supabase
    .from("user_profiles")
    .select("user_id, is_pro, share_plays")
    .eq("display_name", username)
    .eq("is_discoverable", true)
    .limit(1);

  const profileRow = profileRows?.[0];
  if (!profileRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Fetch both collections + their recent plays
  const [{ data: myRaw }, { data: theirRaw }, { data: theirPlaysRaw }] = await Promise.all([
    supabase.from("records").select("*").eq("user_id", userId).eq("for_sale", false),
    supabase.from("records").select("*").eq("user_id", profileRow.user_id).eq("for_sale", false),
    supabase.from("play_sessions").select("record_id, played_at").eq("user_id", profileRow.user_id).order("played_at", { ascending: false }).limit(10),
  ]);

  const myRecords: RecordRow[] = myRaw || [];
  const theirRecords: RecordRow[] = theirRaw || [];

  // On-the-fly backfill: if the other user's records are missing master_id,
  // fetch from their Discogs collection and update in the background.
  const theirMissing = theirRecords.filter(r => (r as any).discogs_id && !(r as any).master_id);
  if (theirMissing.length > 0) {
    const { data: theirToken } = await supabase
      .from("discogs_tokens")
      .select("access_token, access_token_secret, discogs_username")
      .eq("user_id", profileRow.user_id)
      .maybeSingle();

    if (theirToken?.discogs_username) {
      const needsIds = new Set(theirMissing.map(r => (r as any).discogs_id as number));
      let page = 1;
      while (needsIds.size > 0) {
        try {
          const url = `${DISCOGS_API}/users/${theirToken.discogs_username}/collection/folders/0/releases?per_page=100&page=${page}`;
          const res = await discogsRequest("GET", url, {
            tokenKey: theirToken.access_token,
            tokenSecret: theirToken.access_token_secret,
          });
          if (!res.ok) break;
          const data = await res.json();
          const releases = data?.releases || [];
          if (releases.length === 0) break;
          for (const rel of releases) {
            const info = rel.basic_information || {};
            const releaseId = Number(info.id);
            const masterId = Number(info.master_id);
            if (releaseId && masterId > 0 && needsIds.has(releaseId)) {
              // Update DB and local array
              await supabase.from("records").update({ master_id: masterId }).eq("discogs_id", releaseId).eq("user_id", profileRow.user_id);
              const rec = theirRecords.find(r => (r as any).discogs_id === releaseId);
              if (rec) (rec as any).master_id = masterId;
              needsIds.delete(releaseId);
            }
          }
          if (!data.pagination || page >= data.pagination.pages) break;
          page++;
        } catch { break; }
      }
    }
  }

  // Dedupe recent plays to unique records (most recent play per record, up to 5)
  const seenPlayIds = new Set<string>();
  const theirRecentPlays: Array<{ artist: string; title: string; thumb: string | null; played_at: string }> = [];
  for (const play of theirPlaysRaw || []) {
    if (seenPlayIds.has(String(play.record_id))) continue;
    seenPlayIds.add(String(play.record_id));
    const rec = theirRecords.find(r => String((r as any).id) === String(play.record_id));
    if (rec) theirRecentPlays.push({ artist: rec.artist, title: rec.title, thumb: rec.thumb, played_at: play.played_at });
    if (theirRecentPlays.length >= 5) break;
  }

  // Build artist maps: artist -> list of titles
  const myByArtist = new Map<string, string[]>();
  for (const r of myRecords) {
    const key = (r.artist || "").toLowerCase().trim();
    if (!key) continue;
    if (!myByArtist.has(key)) myByArtist.set(key, []);
    myByArtist.get(key)!.push(r.title);
  }

  const theirByArtist = new Map<string, { titles: string[]; thumb: string | null }>();
  for (const r of theirRecords) {
    const key = (r.artist || "").toLowerCase().trim();
    if (!key) continue;
    if (!theirByArtist.has(key)) theirByArtist.set(key, { titles: [], thumb: null });
    const entry = theirByArtist.get(key)!;
    entry.titles.push(r.title);
    if (!entry.thumb && r.thumb) entry.thumb = r.thumb;
  }

  // Shared artists: present in both
  const sharedArtists: Array<{
    artist: string;
    myTitles: string[];
    theirTitles: string[];
    thumb: string | null;
  }> = [];

  for (const [key, myTitles] of myByArtist.entries()) {
    if (theirByArtist.has(key)) {
      const their = theirByArtist.get(key)!;
      const displayArtist = (theirRecords.find(
        (r) => (r.artist || "").toLowerCase().trim() === key
      )?.artist) || key;
      sharedArtists.push({
        artist: displayArtist,
        myTitles,
        theirTitles: their.titles,
        thumb: their.thumb,
      });
    }
  }

  // Sort by combined record count desc
  sharedArtists.sort((a, b) => (b.myTitles.length + b.theirTitles.length) - (a.myTitles.length + a.theirTitles.length));

  // Albums you're missing — records they own by shared artists that you don't have.
  // Compares at master release level, then normalized title, then exact title.
  const myMasterIds = new Set(
    myRecords.filter(r => r.master_id).map(r => r.master_id!)
  );
  // Normalize: strip parentheticals, volume/disc markers, punctuation — catches "Greatest Hits" variants
  function normalizeTitle(t: string) {
    return (t || "").toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\b(vol\.?|volume|disc|cd|lp|part)\s*\d*/gi, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  // Build lookup: artist key → set of normalized titles I own
  const myNormalizedByArtist = new Map<string, Set<string>>();
  for (const r of myRecords) {
    const aKey = (r.artist || "").toLowerCase().trim();
    if (!aKey) continue;
    if (!myNormalizedByArtist.has(aKey)) myNormalizedByArtist.set(aKey, new Set());
    myNormalizedByArtist.get(aKey)!.add(normalizeTitle(r.title));
  }
  const seenMasters = new Set<number>();
  const seenNormKeys = new Set<string>();
  const theirUniqueRecords: Array<{
    artist: string;
    title: string;
    thumb: string | null;
    year: number | null;
    genre: string | null;
  }> = [];

  for (const r of theirRecords) {
    const artistKey = (r.artist || "").toLowerCase().trim();
    if (!artistKey || !myByArtist.has(artistKey)) continue; // only shared artists

    // Master-level dedup: if both have the same master_id, it's the same album
    if (r.master_id && myMasterIds.has(r.master_id)) continue;
    if (r.master_id && seenMasters.has(r.master_id)) continue;

    // Normalized title dedup: catches "Greatest Hits" / "Greatest Hits Vol. 2" / "Greatest Hits (Remastered)"
    const normTitle = normalizeTitle(r.title);
    const normKey = `${artistKey}::${normTitle}`;
    const myTitles = myNormalizedByArtist.get(artistKey);
    if (myTitles?.has(normTitle)) continue;
    if (seenNormKeys.has(normKey)) continue;

    if (r.master_id) seenMasters.add(r.master_id);
    seenNormKeys.add(normKey);

    theirUniqueRecords.push({
      artist: r.artist,
      title: r.title,
      thumb: r.thumb,
      year: r.year_original || r.year_pressed || null,
      genre: r.genre || r.style || null,
    });
  }
  theirUniqueRecords.sort((a, b) =>
    (a.artist || "").localeCompare(b.artist || "") || (a.title || "").localeCompare(b.title || "")
  );

  return NextResponse.json({
    sharedArtists,
    theirUniqueRecords: theirUniqueRecords.slice(0, 50),
    theirRecentPlays: profileRow.share_plays !== false ? theirRecentPlays : [],
    myTotal: myRecords.length,
    theirTotal: theirRecords.length,
    myProfile: avgProfile(myRecords),
    theirProfile: profileRow.is_pro ? avgProfile(theirRecords) : null,
    theirIsPro: profileRow.is_pro ?? false,
    theirUserId: profileRow.user_id,
  });
}
