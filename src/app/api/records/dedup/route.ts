import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Removes accidental duplicate imports — records that share the same
// discogs_instance_id (each Discogs collection item has a unique instance_id,
// so duplicates here are always accidental). Keeps the earliest (lowest id).
// Records without an instance_id (manually added) are never touched.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("records")
    .select("id, discogs_instance_id")
    .eq("user_id", userId)
    .not("discogs_instance_id", "is", null)
    .order("id", { ascending: true });

  if (error) {
    console.error("Supabase select records dedup error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seen = new Map<number, number>();
  const toDelete: number[] = [];
  for (const row of data || []) {
    if (seen.has(row.discogs_instance_id)) {
      toDelete.push(row.id);
    } else {
      seen.set(row.discogs_instance_id, row.id);
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const { error: deleteError } = await supabase
    .from("records")
    .delete()
    .in("id", toDelete)
    .eq("user_id", userId);

  if (deleteError) {
    console.error("Supabase delete dedup error:", JSON.stringify(deleteError));
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: toDelete.length });
}
