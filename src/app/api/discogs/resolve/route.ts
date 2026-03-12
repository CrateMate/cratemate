import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { DISCOGS_API, USER_AGENT, discogsRequest } from "@/lib/discogs";
import { getReleaseCache, upsertReleaseCache } from "@/lib/discogs/cache";

async function fetchWithRetry(requestFn: () => Promise<Response>) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await requestFn();
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
  return requestFn();
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function scoreResult(artist: string, title: string, resultTitle: string) {
  const dash = resultTitle.indexOf(" - ");
  const resArtist = dash > -1 ? resultTitle.slice(0, dash) : "";
  const resTitle = dash > -1 ? resultTitle.slice(dash + 3) : resultTitle;

  const a1 = normalize(artist);
  const t1 = normalize(title);
  const a2 = normalize(resArtist);
  const t2 = normalize(resTitle);
  const ca1 = compact(artist);
  const ct1 = compact(title);
  const ca2 = compact(resArtist);
  const ct2 = compact(resTitle);

  let score = 0;
  if (a1 && a2 && (a1 === a2 || a1.includes(a2) || a2.includes(a1))) score += 2;
  if (t1 && t2 && (t1 === t2 || t1.includes(t2) || t2.includes(t1))) score += 2;
  if (ca1 && ca2 && ca1 === ca2) score += 2;
  if (ct1 && ct2 && ct1 === ct2) score += 2;
  if (ct1 && ct2 && (ct1.includes(ct2) || ct2.includes(ct1))) score += 1;
  if (a1 && a2 && t1 && t2 && a1 === a2 && t1 === t2) score += 1;
  return score;
}

type DiscogsTrack = {
  type_?: string;
  position?: string;
  title?: string;
  duration?: string;
  sub_tracks?: DiscogsTrack[];
};

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

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist") || "";
  const title = searchParams.get("title") || "";
  if (!artist && !title) {
    return NextResponse.json({ error: "Missing artist/title" }, { status: 400 });
  }

  const key = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;
  const url = new URL(`${DISCOGS_API}/database/search`);
  if (artist) url.searchParams.set("artist", artist);
  if (title) url.searchParams.set("release_title", title);
  url.searchParams.set("type", "release");
  url.searchParams.set("per_page", "8");
  url.searchParams.set("key", key);
  url.searchParams.set("secret", secret);

  const searchRes = await fetchWithRetry(() => fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } }));
  if (!searchRes.ok) {
    if (searchRes.status === 429) {
      return NextResponse.json({ error: "Discogs rate limit hit. Please try again in a few seconds." }, { status: 429 });
    }
    const text = await searchRes.text().catch(() => "");
    return NextResponse.json({ error: text || "Discogs search failed" }, { status: searchRes.status });
  }
  const search = await searchRes.json();
  const results = Array.isArray(search?.results) ? search.results : [];

  let best: { id?: unknown; title?: unknown; cover_image?: unknown; thumb?: unknown } | null = null;
  let bestScore = 0;
  for (const r of results) {
    const titleStr = typeof r.title === "string" ? r.title : "";
    const score = scoreResult(artist, title, titleStr);
    if (score > bestScore) {
      bestScore = score;
      best = r as { id?: unknown; title?: unknown; cover_image?: unknown; thumb?: unknown };
    }
  }
  if (!best || bestScore < 2) {
    return NextResponse.json({ error: "No confident match found" }, { status: 404 });
  }

  const releaseId = Number(best.id);
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
    return NextResponse.json({ release_id: releaseId, tracklist, cover_image });
  }

  const { data: tokenData } = await supabase
    .from("discogs_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) return NextResponse.json({ error: "Discogs not connected" }, { status: 400 });

  const { access_token, access_token_secret } = tokenData;
  const releaseRes = await fetchWithRetry(() =>
    discogsRequest("GET", `${DISCOGS_API}/releases/${releaseId}`, {
      tokenKey: access_token,
      tokenSecret: access_token_secret,
    })
  );

  if (!releaseRes.ok) {
    if (releaseRes.status === 429) {
      return NextResponse.json({ error: "Discogs rate limit hit. Please try again in a few seconds." }, { status: 429 });
    }
    const text = await releaseRes.text().catch(() => "");
    return NextResponse.json({ error: text || "Failed to fetch Discogs release" }, { status: releaseRes.status });
  }

  const data = await releaseRes.json();
  const flat: Array<{ type: string; position: string; title: string; duration: string }> = [];
  flattenTracklist((data.tracklist || []) as DiscogsTrack[], flat);
  const cover_image = data.cover_image || data.thumb || "";

  await upsertReleaseCache(releaseId, {
    cover_image,
    thumb: cover_image,
    tracklist: JSON.stringify(flat),
    year_cached_at: new Date().toISOString(),
    year_pressed: typeof data.year === "number" ? data.year : null,
  });

  return NextResponse.json({ release_id: releaseId, tracklist: flat, cover_image });
}
