import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${base}/api/spotify/callback`;

  // Encode userId in state so the public callback knows which user to store tokens for
  const state = Buffer.from(userId).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: "user-top-read user-read-recently-played",
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
