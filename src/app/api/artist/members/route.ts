import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const MB_BASE = "https://musicbrainz.org/ws/2";
const MB_HEADERS = {
  "User-Agent": "CrateMate/1.0 (https://cratemate.app)",
  Accept: "application/json",
};
const CACHE_DAYS = 30;

type MemberRecord = {
  name: string;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_year: number | null;
};

function parseLifeSpan(dateStr: string | null): { month: number | null; day: number | null; year: number | null } {
  if (!dateStr) return { month: null, day: null, year: null };
  const parts = dateStr.split("-");
  return {
    year: parts[0] ? parseInt(parts[0]) : null,
    month: parts[1] ? parseInt(parts[1]) : null,
    day: parts[2] ? parseInt(parts[2]) : null,
  };
}

async function fetchMembersFromMB(artistName: string): Promise<MemberRecord[]> {
  // Step 1: Search for the artist
  const searchUrl = `${MB_BASE}/artist?query=artist:"${encodeURIComponent(artistName)}"&limit=5&fmt=json`;
  const searchRes = await fetch(searchUrl, { headers: MB_HEADERS });
  if (!searchRes.ok) return [];

  const searchData = await searchRes.json();
  const artists: Array<{ id: string; type?: string; name: string; score?: number }> = searchData.artists || [];
  if (artists.length === 0) return [];

  // Pick best match — prefer exact name match, then highest score
  const exact = artists.find((a) => a.name.toLowerCase() === artistName.toLowerCase());
  const candidate = exact || artists[0];

  // Only look up members for Groups/Orchestras; solo artists can use their own birth/death from records
  const isGroup = candidate.type === "Group" || candidate.type === "Orchestra" || candidate.type === "Choir";
  if (!isGroup) return [];

  // Step 2: Fetch artist with member relations
  await new Promise((r) => setTimeout(r, 1100)); // MusicBrainz rate limit: 1 req/sec
  const artistUrl = `${MB_BASE}/artist/${candidate.id}?inc=artist-rels&fmt=json`;
  const artistRes = await fetch(artistUrl, { headers: MB_HEADERS });
  if (!artistRes.ok) return [];

  const artistData = await artistRes.json();
  const relations: Array<{
    type: string;
    direction: string;
    artist: { name: string; "life-span"?: { begin?: string; end?: string } };
  }> = artistData.relations || [];

  const members: MemberRecord[] = relations
    .filter((r) => r.type === "member of band" && r.direction === "backward")
    .slice(0, 6) // cap at 6 members
    .map((r) => {
      const lifeSpan = r.artist["life-span"] || {};
      const birth = parseLifeSpan(lifeSpan.begin || null);
      const death = parseLifeSpan(lifeSpan.end || null);
      return {
        name: r.artist.name,
        birth_month: birth.month,
        birth_day: birth.day,
        birth_year: birth.year,
        death_month: death.month,
        death_day: death.day,
        death_year: death.year,
      };
    });

  return members;
}

// POST: fetch + cache members for a list of artist names
export async function POST(request: Request) {
  const { artists }: { artists: string[] } = await request.json().catch(() => ({ artists: [] }));
  if (!Array.isArray(artists) || artists.length === 0) {
    return NextResponse.json({});
  }

  const staleThreshold = new Date(Date.now() - CACHE_DAYS * 86400 * 1000).toISOString();

  // Fetch cached entries from Supabase
  const { data: cached } = await supabase
    .from("artist_members")
    .select("artist_name, members, fetched_at")
    .in("artist_name", artists);

  const cachedMap = new Map((cached || []).map((c) => [c.artist_name, c]));
  const result: Record<string, MemberRecord[]> = {};

  // Return cached; collect which need refreshing
  const toFetch: string[] = [];
  for (const artist of artists) {
    const hit = cachedMap.get(artist);
    if (hit && hit.fetched_at > staleThreshold) {
      result[artist] = hit.members || [];
    } else {
      toFetch.push(artist);
    }
  }

  // Fetch missing from MusicBrainz sequentially (rate limit)
  for (const artist of toFetch) {
    try {
      const members = await fetchMembersFromMB(artist);
      result[artist] = members;
      await supabase.from("artist_members").upsert({ artist_name: artist, members, fetched_at: new Date().toISOString() });
    } catch {
      result[artist] = [];
    }
  }

  return NextResponse.json(result);
}
