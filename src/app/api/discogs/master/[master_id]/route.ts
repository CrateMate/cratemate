import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { DISCOGS_API, USER_AGENT } from "@/lib/discogs";
import { getMasterCache, upsertMasterCache, isMasterCacheFresh } from "@/lib/discogs/cache";

export async function GET(_request: Request, { params }: { params: Promise<{ master_id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { master_id } = await params;
  const masterId = parseInt(master_id, 10);
  if (!Number.isFinite(masterId)) return NextResponse.json({ error: "Invalid master_id" }, { status: 400 });

  // Check cache first
  const cached = await getMasterCache(masterId);
  if (cached && isMasterCacheFresh(cached)) {
    return NextResponse.json(cached);
  }

  // Fetch from Discogs (unauthenticated — master endpoint is public)
  const key = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;

  const masterUrl = `${DISCOGS_API}/masters/${masterId}?key=${encodeURIComponent(key)}&secret=${encodeURIComponent(secret)}`;
  const versionsUrl = `${DISCOGS_API}/masters/${masterId}/versions?per_page=100&key=${encodeURIComponent(key)}&secret=${encodeURIComponent(secret)}`;

  const [masterRes, versionsRes] = await Promise.all([
    fetch(masterUrl, { headers: { "User-Agent": USER_AGENT } }),
    fetch(versionsUrl, { headers: { "User-Agent": USER_AGENT } }),
  ]);

  if (!masterRes.ok) {
    // Return stale cache if available
    if (cached) return NextResponse.json(cached);
    return NextResponse.json({ error: `Discogs master fetch failed (${masterRes.status})` }, { status: 502 });
  }

  const master = await masterRes.json();
  const versionsData = versionsRes.ok ? await versionsRes.json() : null;
  const versions = Array.isArray(versionsData?.versions)
    ? versionsData.versions.map((v: {
        id?: number;
        year?: number;
        label?: string;
        format?: string;
        country?: string;
        title?: string;
        thumb?: string;
      }) => ({
        release_id: v.id,
        year: v.year,
        label: v.label,
        format: v.format,
        country: v.country,
        notes: v.title,
        thumb: v.thumb,
      }))
    : [];

  const artists = Array.isArray(master.artists) ? master.artists : [];
  const canonical_artist = artists.map((a: { name?: string }) => a.name || "").filter(Boolean).join(", ");

  const payload = {
    canonical_title: master.title || "",
    canonical_artist,
    year_original: master.year ? Number(master.year) : null,
    thumb: master.images?.[0]?.uri || master.thumb || "",
    release_count: versionsData?.pagination?.items || versions.length,
    versions,
  };

  await upsertMasterCache(masterId, payload);

  return NextResponse.json({ master_id: masterId, ...payload });
}
