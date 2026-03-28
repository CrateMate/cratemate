import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Paginate to bypass Supabase's server-side max_rows cap (default 1000)
  const PAGE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("wantlist")
      .select("*")
      .eq("user_id", userId)
      .order("added_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    items.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Group by master_id (items without a master_id get their own group keyed by release_id)
  const groups = new Map<string, { master_id: number | null; releases: typeof items }>();

  for (const item of items || []) {
    const key = item.master_id ? `master_${item.master_id}` : `release_${item.release_id}`;
    if (!groups.has(key)) {
      groups.set(key, { master_id: item.master_id, releases: [] });
    }
    groups.get(key)!.releases.push(item);
  }

  const result = Array.from(groups.values()).map((group) => {
    const releases = group.releases;
    // Pick representative: prefer found, then earliest year, then first
    const representative =
      releases.find((r) => r.found) ||
      [...releases].sort((a, b) => (a.year_pressed || 9999) - (b.year_pressed || 9999))[0];

    return {
      master_id: group.master_id,
      representative,
      releases,
      found: releases.some((r) => r.found),
      edition_count: releases.length,
      year_range:
        releases.length > 1
          ? `${Math.min(...releases.map((r) => r.year_pressed || 9999).filter((y) => y < 9999))}–${Math.max(...releases.map((r) => r.year_pressed || 0))}`
          : String(representative?.year_pressed || ""),
    };
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST: manually add a release to the wantlist
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { release_id, master_id, artist, title, year_pressed, label, format, thumb, genres, styles, country, catno } = body;
  if (!release_id || !title) return NextResponse.json({ error: "Missing release_id or title" }, { status: 400 });

  const row = {
    user_id: userId,
    release_id,
    master_id: master_id || null,
    artist: artist || "",
    title,
    year_pressed: year_pressed || null,
    label: label || "",
    format: format || "",
    thumb: thumb || "",
    genres: genres || "",
    styles: styles || "",
    notes: catno ? `${country || ""} · ${catno}`.trim() : "",
    added_at: new Date().toISOString(),
    found: false,
    found_record_id: null,
  };

  const { data, error } = await supabase
    .from("wantlist")
    .upsert(row, { onConflict: "user_id,release_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { release_id } = await request.json().catch(() => ({}));
  if (!release_id) return NextResponse.json({ error: "Missing release_id" }, { status: 400 });

  await supabase.from("wantlist").delete().eq("user_id", userId).eq("release_id", release_id);
  return NextResponse.json({ ok: true });
}
