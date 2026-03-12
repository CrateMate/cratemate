import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discogsRequest } from "@/lib/discogs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callbackUrl = `${base}/api/discogs/callback`;

  const res = await discogsRequest("POST", "https://api.discogs.com/oauth/request_token", {
    oauthCallback: callbackUrl,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Discogs request token error:", text);
    return NextResponse.json({ error: "Failed to get request token" }, { status: 500 });
  }

  const params = new URLSearchParams(await res.text());
  const requestToken = params.get("oauth_token");
  const requestTokenSecret = params.get("oauth_token_secret");

  if (!requestToken || !requestTokenSecret) {
    return NextResponse.json({ error: "Missing tokens from Discogs" }, { status: 500 });
  }

  const { error } = await supabase.from("discogs_oauth_temp").upsert({
    request_token: requestToken,
    user_id: userId,
    request_token_secret: requestTokenSecret,
  });
  if (error) {
    console.error("Supabase upsert discogs_oauth_temp error:", JSON.stringify(error));
    return NextResponse.json({ error: "Failed to store Discogs request token" }, { status: 500 });
  }

  return NextResponse.redirect(`https://www.discogs.com/oauth/authorize?oauth_token=${requestToken}`);
}
