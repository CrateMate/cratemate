import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { DISCOGS_API, discogsRequest } from "@/lib/discogs";

export async function GET(_request: Request, { params }: { params: Promise<{ release_id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { release_id: rawId } = await params;
  const releaseId = Number(rawId);
  if (!Number.isFinite(releaseId)) {
    return NextResponse.json({ error: "Invalid release ID" }, { status: 400 });
  }

  // Step 1: check if we already know the artist_discogs_id for this release
  const { data: cacheRow } = await supabase
    .from("discogs_metadata_cache")
    .select("artist_discogs_id")
    .eq("release_id", releaseId)
    .single();

  let artistDiscogsId: number | null = cacheRow?.artist_discogs_id ?? null;

  // Step 2: if not cached, fetch the release from Discogs to extract artist ID
  if (!artistDiscogsId) {
    const releaseRes = await discogsRequest("GET", `${DISCOGS_API}/releases/${releaseId}`);
    if (!releaseRes.ok) {
      return NextResponse.json({ error: "Failed to fetch Discogs release" }, { status: releaseRes.status });
    }
    const releaseData = await releaseRes.json();
    artistDiscogsId = releaseData.artists?.[0]?.id ?? null;

    if (!artistDiscogsId) {
      return NextResponse.json({ error: "No artist found for this release" }, { status: 404 });
    }

    // Cache the artist ID on the release row
    await supabase
      .from("discogs_metadata_cache")
      .upsert({ release_id: releaseId, artist_discogs_id: artistDiscogsId, updated_at: new Date().toISOString() }, { onConflict: "release_id" });
  }

  // Step 3: check artist cache (valid for 7 days)
  const { data: artistCache } = await supabase
    .from("discogs_artist_cache")
    .select("*")
    .eq("artist_discogs_id", artistDiscogsId)
    .gt("cached_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .single();

  if (artistCache) {
    const releases = (() => {
      try { return JSON.parse(artistCache.releases_json); } catch { return []; }
    })();
    return NextResponse.json({
      artist: {
        id: artistCache.artist_discogs_id,
        name: artistCache.artist_name,
        profile_image: artistCache.profile_image,
      },
      releases,
    });
  }

  // Step 4: fetch artist profile + full discography in parallel
  const [artistRes, releasesRes] = await Promise.all([
    discogsRequest("GET", `${DISCOGS_API}/artists/${artistDiscogsId}`),
    discogsRequest("GET", `${DISCOGS_API}/artists/${artistDiscogsId}/releases?per_page=100&sort=year`),
  ]);

  if (!artistRes.ok) {
    return NextResponse.json({ error: "Failed to fetch artist from Discogs" }, { status: artistRes.status });
  }

  const artistData = await artistRes.json();
  const releasesData = releasesRes.ok ? await releasesRes.json() : { releases: [] };

  const artistName: string = artistData.name || "";
  const profileImage: string = artistData.images?.[0]?.uri || artistData.images?.[0]?.uri150 || "";
  const releases = (releasesData.releases || []).map((r: Record<string, unknown>) => ({
    id: r.id,
    title: r.title,
    year: r.year,
    type: r.type,
    format: r.format,
    role: r.role,
    thumb: r.thumb || "",
  }));

  // Upsert artist cache
  await supabase.from("discogs_artist_cache").upsert({
    artist_discogs_id: artistDiscogsId,
    artist_name: artistName,
    profile_image: profileImage,
    releases_json: JSON.stringify(releases),
    cached_at: new Date().toISOString(),
  }, { onConflict: "artist_discogs_id" });

  return NextResponse.json({
    artist: { id: artistDiscogsId, name: artistName, profile_image: profileImage },
    releases,
  });
}
