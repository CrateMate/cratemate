import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

  // Fetch both collections
  const [{ data: myRaw }, { data: theirRaw }] = await Promise.all([
    supabase.from("records").select("artist, title, thumb").eq("user_id", userId).eq("for_sale", false),
    supabase.from("records").select("artist, title, thumb").eq("user_id", tokenRow.user_id).eq("for_sale", false),
  ]);

  const myRecords = myRaw || [];
  const theirRecords = theirRaw || [];

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
      // Recover display name from their records
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
  });
}
