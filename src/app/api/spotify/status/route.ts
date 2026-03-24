import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("spotify_user_tokens")
    .select("spotify_user_id, scope, updated_at")
    .eq("user_id", userId)
    .single();

  const scope = data?.scope || "";
  const hasPlaylistScope =
    scope.includes("playlist-modify-public") && scope.includes("playlist-modify-private");

  return NextResponse.json({
    connected: !!data,
    spotify_user_id: data?.spotify_user_id || null,
    scope: scope || null,
    hasPlaylistScope,
  });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("spotify_user_tokens").delete().eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
