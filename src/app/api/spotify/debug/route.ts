import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserAccessToken, spotifyUserReqWithToken } from "@/lib/spotify";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "not_signed_in" });

  const token = await getUserAccessToken(userId);
  if (!token) return NextResponse.json({ step: "token", error: "no_token" });

  // Test 1: Can we read the user's profile?
  const profileRes = await spotifyUserReqWithToken("GET", "/me", token);
  const profile = profileRes.ok ? await profileRes.json() : null;
  if (!profileRes.ok) {
    return NextResponse.json({ step: "profile", status: profileRes.status, body: await profileRes.text().catch(() => "") });
  }

  // Test 2: Can we create a playlist?
  const createRes = await spotifyUserReqWithToken("POST", "/me/playlists", token, {
    name: "CrateMate Debug Test",
    public: false,
    description: "Safe to delete — debug test",
  });
  const createBody = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    return NextResponse.json({ step: "create_playlist", status: createRes.status, body: createBody });
  }

  // Test 3: Can we add a track? (use a well-known Spotify URI)
  const playlistId = createBody.id;
  const addRes = await spotifyUserReqWithToken("POST", `/playlists/${playlistId}/tracks`, token, {
    uris: ["spotify:track:3HfB5hBU0dmBt8T0iCmEoN"], // Radiohead - Creep
  });
  const addBody = await addRes.json().catch(() => ({}));

  // Clean up: delete the test playlist
  await spotifyUserReqWithToken("DELETE", `/playlists/${playlistId}/followers`, token).catch(() => {});

  if (!addRes.ok) {
    return NextResponse.json({ step: "add_tracks", status: addRes.status, body: addBody, playlist_created: true });
  }

  return NextResponse.json({
    step: "all_passed",
    profile: profile?.display_name,
    token_prefix: token.slice(0, 8) + "...",
  });
}
