import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Shape expected by buildTodayHook in VinylCrate.jsx
type MemberRecord = {
  name: string;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_year: number | null;
};

// artist_metadata.members stores MemberDates (camelCase) from musicbrainz.ts
type StoredMember = {
  name: string;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  deathYear: number | null;
  joinedYear?: number | null;
  leftYear?: number | null;
};

function toMemberRecord(m: StoredMember): MemberRecord {
  return {
    name: m.name,
    birth_month: m.birthMonth,
    birth_day: m.birthDay,
    birth_year: m.birthYear,
    death_month: m.deathMonth,
    death_day: m.deathDay,
    death_year: m.deathYear,
  };
}

// POST: return member birth/death dates for a list of artist names.
// Reads from artist_metadata (populated by the enrichment pipeline) — no
// direct MusicBrainz calls here.  If an artist hasn't been enriched yet the
// enrichment job will fill it in; we just return empty for now.
export async function POST(request: Request) {
  const { artists }: { artists: string[] } = await request.json().catch(() => ({ artists: [] }));
  if (!Array.isArray(artists) || artists.length === 0) {
    return NextResponse.json({});
  }

  const { data } = await supabase
    .from("artist_metadata")
    .select("artist_name, members")
    .in("artist_name", artists)
    .not("members", "is", null);

  const result: Record<string, MemberRecord[]> = {};
  for (const row of data || []) {
    const members = Array.isArray(row.members) ? (row.members as StoredMember[]).map(toMemberRecord) : [];
    if (members.length > 0) result[row.artist_name] = members;
  }

  return NextResponse.json(result);
}
