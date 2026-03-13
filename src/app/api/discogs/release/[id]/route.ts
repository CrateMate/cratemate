import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { DISCOGS_API, discogsRequest } from "@/lib/discogs";
import { getReleaseCache, upsertReleaseCache } from "@/lib/discogs/cache";

type DiscogsTrack = {
  type_?: string;
  position?: string;
  title?: string;
  duration?: string;
  sub_tracks?: DiscogsTrack[];
};

type DiscogsImage = { uri?: unknown; uri150?: unknown };

async function fetchWithRetry(
  url: string,
  tokenKey: string,
  tokenSecret: string
) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await discogsRequest("GET", url, { tokenKey, tokenSecret });
    if (res.ok) return res;
    if (attempt < maxAttempts && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504)) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? Math.min(15_000, Math.max(1000, retryAfterSeconds * 1000))
        : 800 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    return res;
  }
  return discogsRequest("GET", url, { tokenKey, tokenSecret });
}

function flattenTracklist(tracks: DiscogsTrack[], out: Array<{ type: string; position: string; title: string; duration: string }>) {
  for (const t of tracks || []) {
    const type = t.type_ || "track";
    const position = t.position || "";
    const title = t.title || "";
    const duration = t.duration || "";
    out.push({ type, position, title, duration });
    if (t.sub_tracks && t.sub_tracks.length > 0) {
      flattenTracklist(t.sub_tracks, out);
    }
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await params;
  const match = String(rawId || "").match(/\d+/);
  const releaseId = match ? Number(match[0]) : Number.NaN;
  if (!Number.isFinite(releaseId)) {
    return NextResponse.json({ error: "Invalid Discogs release ID" }, { status: 400 });
  }

  const cached = await getReleaseCache(releaseId);
  if (cached?.tracklist) {
    const tracklist = (() => {
      try {
        return JSON.parse(cached.tracklist as string);
      } catch {
        return [];
      }
    })();
    const cover_image = cached.cover_image || cached.thumb || "";
    return NextResponse.json({ tracklist, cover_image });
  }

  const { data: tokenData } = await supabase
    .from("discogs_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) return NextResponse.json({ error: "Discogs not connected" }, { status: 400 });

  const { access_token, access_token_secret } = tokenData;
  const res = await fetchWithRetry(`${DISCOGS_API}/releases/${releaseId}`, access_token, access_token_secret);

  if (!res.ok) {
    if (res.status === 429) {
      return NextResponse.json({ error: "Discogs rate limit hit. Please try again in a few seconds." }, { status: 429 });
    }
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: text || "Failed to fetch Discogs release" }, { status: res.status });
  }

  const data = await res.json();
  const images = Array.isArray(data.images) ? (data.images as DiscogsImage[]) : [];
  const first = images[0];
  const cover_image = data.cover_image || data.thumb || (typeof first?.uri === "string" ? first.uri : "");
  const flat: Array<{ type: string; position: string; title: string; duration: string }> = [];
  flattenTracklist((data.tracklist || []) as DiscogsTrack[], flat);
  const artists = Array.isArray(data.artists) ? data.artists.map((a: { id?: number; name?: string }) => ({ id: a.id, name: a.name })) : [];

  await upsertReleaseCache(releaseId, {
    cover_image,
    thumb: cover_image,
    tracklist: JSON.stringify(flat),
    year_cached_at: new Date().toISOString(),
    year_pressed: typeof data.year === "number" ? data.year : null,
  });

  return NextResponse.json({ tracklist: flat, cover_image, artists });
}
