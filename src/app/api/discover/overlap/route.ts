import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type RecordRow = {
  artist: string;
  title: string;
  thumb: string | null;
  genre?: string | null;
  style?: string | null;
  year_original?: number | null;
  year_pressed?: number | null;
};

type AudioProfile = {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  loudness: number;
};

// Mirrors GENRE_AUDIO_PROFILES in VinylCrate.jsx (tempo omitted — not needed for radar)
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

  // Look up their user_id
  const { data: tokenRow } = await supabase
    .from("discogs_tokens")
    .select("user_id")
    .eq("discogs_username", username)
    .eq("is_discoverable", true)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Fetch both collections (now including genre/style/year for profile estimation)
  const [{ data: myRaw }, { data: theirRaw }] = await Promise.all([
    supabase.from("records").select("artist, title, thumb, genre, style, year_original, year_pressed").eq("user_id", userId).eq("for_sale", false),
    supabase.from("records").select("artist, title, thumb, genre, style, year_original, year_pressed").eq("user_id", tokenRow.user_id).eq("for_sale", false),
  ]);

  const myRecords: RecordRow[] = myRaw || [];
  const theirRecords: RecordRow[] = theirRaw || [];

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

  return NextResponse.json({
    sharedArtists,
    myTotal: myRecords.length,
    theirTotal: theirRecords.length,
    myProfile: avgProfile(myRecords),
    theirProfile: avgProfile(theirRecords),
  });
}
