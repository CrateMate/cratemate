import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const discoverable = !!body.discoverable;

  // Resolve display name: Discogs username if connected, else Clerk name
  const { data: tokenRow } = await supabase
    .from("discogs_tokens")
    .select("discogs_username")
    .eq("user_id", userId)
    .maybeSingle();

  let displayName = tokenRow?.discogs_username;
  if (!displayName) {
    const user = await currentUser();
    displayName =
      user?.username ||
      (user?.firstName
        ? `${user.firstName}${user.lastName ? user.lastName[0] : ""}`
        : null) ||
      user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      userId.slice(-8);
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, display_name: displayName, is_discoverable: discoverable },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ is_discoverable: discoverable });
}
