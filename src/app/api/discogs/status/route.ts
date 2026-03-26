import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: tokenRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from("discogs_tokens")
      .select("discogs_username")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("display_name, is_discoverable")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    connected: !!tokenRow,
    username: tokenRow?.discogs_username || profileRow?.display_name || null,
    is_discoverable: profileRow ? (profileRow.is_discoverable ?? false) : null,
  });
}
