import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${base}/api/spotify/callback`;

  // Build a CSRF-safe state: random nonce + userId
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ nonce, userId })).toString("base64url");

  // Preserve which tab the user came from so callback can redirect back
  const fromTab = req.nextUrl.searchParams.get("from") || "reco";

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: "user-top-read user-read-recently-played playlist-modify-public playlist-modify-private",
    show_dialog: "true",
  });

  const response = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);

  // Store nonce + fromTab in a short-lived cookie for validation in callback
  response.cookies.set("spotify_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/api/spotify/callback",
  });
  response.cookies.set("spotify_oauth_from", fromTab, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/spotify/callback",
  });

  return response;
}
