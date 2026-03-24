import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${base}/api/spotify/callback`;

  // Preserve which tab the user came from so callback can redirect back
  const fromTab = req.nextUrl.searchParams.get("from") || "reco";

  // CSRF-safe state: HMAC-signed payload (no cookies needed, survives cross-domain redirects)
  const nonce = randomBytes(8).toString("hex");
  const payload = Buffer.from(JSON.stringify({ userId, from: fromTab, nonce, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", process.env.SPOTIFY_CLIENT_SECRET!).update(payload).digest("hex");
  const state = `${payload}.${sig}`;

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: "user-top-read user-read-recently-played playlist-modify-public playlist-modify-private",
    show_dialog: "true",
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
