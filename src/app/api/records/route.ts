import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function stripThumb<T extends Record<string, unknown>>(row: T): Omit<T, "thumb"> {
  const { thumb: _thumb, ...rest } = row as T & { thumb?: unknown };
  return rest;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Paginate to handle collections > 1000 records (Supabase default max_rows)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data: batch, error } = await supabase
      .from("records")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!batch || batch.length === 0) break;
    data.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }

  // Join tracklists from cache so the client can search by song title.
  const discogsIds = data.map((r) => r.discogs_id).filter(Boolean);
  let tracklistMap: Map<number, string> = new Map();
  if (discogsIds.length > 0) {
    // Paginate the cache join too — .in() with >1000 ids can fail
    const cacheRows: { release_id: number; tracklist: string }[] = [];
    for (let i = 0; i < discogsIds.length; i += PAGE) {
      const { data: batch } = await supabase
        .from("discogs_metadata_cache")
        .select("release_id, tracklist")
        .in("release_id", discogsIds.slice(i, i + PAGE))
        .not("tracklist", "is", null);
      if (batch) cacheRows.push(...batch);
    }
    tracklistMap = new Map(cacheRows.map((c) => [c.release_id, c.tracklist]));
  }

  const enriched = (data || []).map((r) => {
    const raw = r.discogs_id ? tracklistMap.get(r.discogs_id) : null;
    const tracks = raw ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : [];
    return { ...r, tracks };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const records = Array.isArray(body) ? body : [body];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const rows = records.map(({ id, ...rest }) => ({ ...rest, user_id: userId }));

  let { data, error } = await supabase
    .from("records")
    .insert(rows)
    .select();

  if (error) {
    // Backwards-compatible: if schema doesn't have `thumb`, retry without it.
    if (error.message.toLowerCase().includes("thumb") && error.message.toLowerCase().includes("column")) {
      const stripped = rows.map(stripThumb);
      ({ data, error } = await supabase.from("records").insert(stripped).select());
    }
    if (error) {
      console.error("Supabase insert error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json(data);
}
