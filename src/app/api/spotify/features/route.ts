import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchAlbumFeatures } from "@/lib/spotify";

// POST: fetch + cache features for one record
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { record_id, artist, title } = await request.json().catch(() => ({}));
  if (!record_id || !artist || !title) {
    return NextResponse.json({ error: "Missing record_id, artist, or title" }, { status: 400 });
  }

  // Check cache first
  const { data: cached } = await supabase
    .from("spotify_features")
    .select("*")
    .eq("record_id", record_id)
    .single();

  if (cached) return NextResponse.json(cached);

  // Fetch from Spotify
  const features = await fetchAlbumFeatures(artist, title);
  if (!features) return NextResponse.json(null);

  // Store in cache
  const row = { record_id, ...features };
  await supabase.from("spotify_features").upsert(row);

  return NextResponse.json(row);
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
