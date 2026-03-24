import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabase } from "@/lib/supabase";

const MAX_STATE_AGE_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code || !state) {
    return NextResponse.redirect(`${base}/?spotify=error`);
  }

  // Verify HMAC-signed state
  const dotIdx = state.lastIndexOf(".");
  if (dotIdx === -1) return NextResponse.redirect(`${base}/?spotify=error`);

  const payload = state.slice(0, dotIdx);
  const sig = state.slice(dotIdx + 1);
  const expectedSig = createHmac("sha256", process.env.SPOTIFY_CLIENT_SECRET!).update(payload).digest("hex");

  if (sig !== expectedSig) {
    console.error("[spotify/callback] HMAC signature mismatch");
    return NextResponse.redirect(`${base}/?spotify=error`);
  }

  let userId: string;
  let fromTab: string;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    userId = parsed.userId;
    fromTab = parsed.from || "reco";
    // Reject stale states
    if (Date.now() - (parsed.ts || 0) > MAX_STATE_AGE_MS) {
      console.error("[spotify/callback] state expired");
      return NextResponse.redirect(`${base}/?spotify=error`);
    }
    if (!userId) throw new Error("missing userId");
  } catch {
    return NextResponse.redirect(`${base}/?spotify=error`);
  }

  const redirectUri = `${base}/api/spotify/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Spotify token exchange error:", tokenRes.status, await tokenRes.text().catch(() => ""));
    return NextResponse.redirect(`${base}/?spotify=error`);
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in, scope } = tokenData;
  console.log("[spotify/callback] granted scope:", scope);

  if (!access_token || !refresh_token) {
    return NextResponse.redirect(`${base}/?spotify=error`);
  }

  // Fetch Spotify profile to store spotify_user_id
  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  const { error: upsertError } = await supabase.from("spotify_user_tokens").upsert({
    user_id: userId,
    access_token,
    refresh_token,
    expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    spotify_user_id: profile.id || null,
    scope: scope || null,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    console.error("Supabase upsert spotify_user_tokens error:", JSON.stringify(upsertError));
    return NextResponse.redirect(`${base}/?spotify=error`);
  }

  return NextResponse.redirect(`${base}/?spotify=connected&tab=${fromTab}`);
}
