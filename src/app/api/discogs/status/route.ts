import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("discogs_tokens")
    .select("discogs_username, is_discoverable")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({
    connected: !!data,
    username: data?.discogs_username || null,
    is_discoverable: data?.is_discoverable ?? false,
  });
}
