import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Removes legacy seeded rows (they have no Discogs linkage).
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("records")
    .delete()
    .eq("user_id", userId)
    .is("discogs_id", null)
    .select("id");

  if (error) {
    console.error("Supabase cleanup delete error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: data?.length || 0 });
}

