import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: items, error } = await supabase
    .from("wantlist")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { release_id } = await request.json().catch(() => ({}));
  if (!release_id) return NextResponse.json({ error: "Missing release_id" }, { status: 400 });

  await supabase.from("wantlist").delete().eq("user_id", userId).eq("release_id", release_id);
  return NextResponse.json({ ok: true });
}
