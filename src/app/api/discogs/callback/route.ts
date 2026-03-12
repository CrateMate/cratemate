import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.redirect(`${base}/?discogs=error`);
  }

  const { data: temp } = await supabase
    .from("discogs_oauth_temp")
    .select("*")
    .eq("request_token", oauthToken)
    .single();

  if (!temp) return NextResponse.redirect(`${base}/?discogs=error`);

  const res = await discogsRequest("POST", "https://api.discogs.com/oauth/access_token", {
    tokenKey: oauthToken,
    tokenSecret: temp.request_token_secret,
    oauthVerifier,
  });

  if (!res.ok) return NextResponse.redirect(`${base}/?discogs=error`);

  const params = new URLSearchParams(await res.text());
  const accessToken = params.get("oauth_token");
  const accessTokenSecret = params.get("oauth_token_secret");

  if (!accessToken || !accessTokenSecret) {
    return NextResponse.redirect(`${base}/?discogs=error`);
  }

  // Get Discogs username (properly signed)
  const identityRes = await discogsRequest("GET", `${DISCOGS_API}/oauth/identity`, {
    tokenKey: accessToken,
    tokenSecret: accessTokenSecret,
  });
  const identity = identityRes.ok ? await identityRes.json() : {};

  const { error: upsertError } = await supabase.from("discogs_tokens").upsert({
    user_id: temp.user_id,
    access_token: accessToken,
    access_token_secret: accessTokenSecret,
    discogs_username: identity.username || null,
  });
  if (upsertError) {
    console.error("Supabase upsert discogs_tokens error:", JSON.stringify(upsertError));
    return NextResponse.redirect(`${base}/?discogs=error`);
  }

  await supabase.from("discogs_oauth_temp").delete().eq("request_token", oauthToken);

  return NextResponse.redirect(`${base}/?discogs=connected`);
}
