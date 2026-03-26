import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all user records missing master_id but with a discogs_id
  const { data: records } = await supabase
    .from("records")
    .select("id, discogs_id")
    .eq("user_id", userId)
    .is("master_id", null)
    .not("discogs_id", "is", null);

  if (!records || records.length === 0) {
    return NextResponse.json({ updated: 0, message: "No records need backfill" });
  }

  // Batch lookup master_id from the metadata cache
  const releaseIds = records.map(r => r.discogs_id).filter(Boolean);
  const { data: cacheRows } = await supabase
    .from("discogs_metadata_cache")
    .select("release_id, master_id")
    .in("release_id", releaseIds)
    .not("master_id", "is", null)
    .gt("master_id", 0);

  if (!cacheRows || cacheRows.length === 0) {
    return NextResponse.json({ updated: 0, message: "No master_id found in cache" });
  }

  const cacheMap = new Map(cacheRows.map(c => [c.release_id, c.master_id]));

  let updated = 0;
  for (const record of records) {
    const masterId = cacheMap.get(record.discogs_id);
    if (!masterId) continue;
    const { error } = await supabase
      .from("records")
      .update({ master_id: masterId })
      .eq("id", record.id);
    if (!error) updated++;
  }

  return NextResponse.json({ updated, total: records.length, cached: cacheRows.length });
}
