import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: list users I follow
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id, created_at")
    .eq("follower_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST: follow or unfollow a user
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { following_id } = await request.json();
  if (!following_id) return NextResponse.json({ error: "Missing following_id" }, { status: 400 });
  if (following_id === userId) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  // Check if already following
  const { data: existing } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", userId)
    .eq("following_id", following_id)
    .maybeSingle();

  if (existing) {
    // Unfollow
    await supabase.from("user_follows").delete().eq("id", existing.id);
    return NextResponse.json({ followed: false });
  } else {
    // Follow
    const { error } = await supabase
      .from("user_follows")
      .insert({ follower_id: userId, following_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ followed: true });
  }
}
