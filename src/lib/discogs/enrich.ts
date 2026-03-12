import { supabase } from "@/lib/supabase";
import { DISCOGS_API, USER_AGENT, discogsRequest } from "@/lib/discogs";
import { getReleaseCache, upsertReleaseCache } from "@/lib/discogs/cache";

// Discogs allows 60 authenticated requests/min. We pace at ~40/min to stay safe.
const RATE_DELAY_MS = 1500;

type DiscogsImage = { uri?: unknown; uri150?: unknown };
type DiscogsRelease = { images?: unknown; year?: unknown; master_id?: unknown; formats?: unknown };
type DbRecord = {
  id: number;
  discogs_id: number;
  year_pressed: number | null;
  year_original: number | null;
  is_compilation: boolean | null;
  thumb?: string | null;
  artist?: string | null;
  title?: string | null;
};

type EnrichParams = {
  userId: string;
  limit?: number;
  offset?: number;
  mode?: "full" | "thumb";
  force?: boolean;
};

function toYear(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isCompilationFromFormats(formats: unknown) {
  const list = Array.isArray(formats) ? formats : [];
  const all = list
    .map((f) => (typeof f === "object" && f ? (f as { descriptions?: unknown }).descriptions : undefined))
    .flatMap((d) => (Array.isArray(d) ? d : []))
    .map((s) => String(s).toLowerCase());
  return all.some((s) => s.includes("comp"));
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

function artistTitleKey(artist: string, title: string) {
  return `${compact(artist)}|${compact(title)}`;
}

function isMissingThumb(value: unknown) {
  if (value == null) return true;
  if (typeof value !== "string") return true;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed === "null" || trimmed === "undefined" || trimmed === "none") return true;
  if (!trimmed.startsWith("http")) return true;
  return false;
}

function isLowResThumb(value: unknown) {
  if (value == null || typeof value !== "string") return false;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith("http")) return false;
  // Low-res Discogs thumbnail pattern.
  if (/-150\.(jpe?g|png|webp)(\?.*)?$/.test(trimmed)) return true;
  // Discogs user-uploaded photos (heuristic: contains /userimages/ or /user-image/).
  if (trimmed.includes("/userimages/") || trimmed.includes("/user-image/")) return true;
  return false;
}

function joinArtists(artists: Array<{ name?: string; join?: string }>) {
  if (!artists || artists.length === 0) return "";
  return artists
    .map((a, i) => {
      const name = a?.name || "";
      const join = i < artists.length - 1 ? a?.join || ", " : "";
      return `${name}${join}`;
    })
    .join("");
}

function releaseThumb(release: DiscogsRelease) {
  const cover = (release as { cover_image?: unknown })?.cover_image;
  if (typeof cover === "string" && cover) return cover;
  const thumb = (release as { thumb?: unknown })?.thumb;
  if (typeof thumb === "string" && thumb) return thumb;

  const images = Array.isArray(release?.images) ? (release.images as DiscogsImage[]) : [];
  const first = images[0];
  const uri150 = typeof first?.uri150 === "string" ? first.uri150 : "";
  const uri = typeof first?.uri === "string" ? first.uri : "";
  return uri150 || uri || "";
}

function scoreSearch(record: DbRecord, result: { title?: string; cover_image?: string; thumb?: string }) {
  const rawTitle = result.title || "";
  const dash = rawTitle.indexOf(" - ");
  const resArtist = dash > -1 ? rawTitle.slice(0, dash) : "";
  const resTitle = dash > -1 ? rawTitle.slice(dash + 3) : rawTitle;

  const a1 = normalize(record.artist || "");
  const t1 = normalize(record.title || "");
  const a2 = normalize(resArtist);
  const t2 = normalize(resTitle);
  const ca1 = compact(record.artist || "");
  const ct1 = compact(record.title || "");
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

async function iTunesArtworkFallback(record: DbRecord): Promise<string> {
  const artist = record.artist || "";
  const title = record.title || "";
  if (!artist && !title) return "";

  const term = [artist, title].filter(Boolean).join(" ");
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=10`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return "";
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    // Score each result and pick the best match.
    let best: { artworkUrl100?: string } | null = null;
    let bestScore = 0;
    for (const r of results) {
      const fakeRecord = {
        title: r.collectionName || "",
        artist: r.artistName || "",
        cover_image: r.artworkUrl100 || "",
        thumb: r.artworkUrl100 || "",
      };
      const s = scoreSearch(record, fakeRecord);
      if (s > bestScore) { bestScore = s; best = r; }
    }
    if (!best || bestScore < 2) return "";

    // Upgrade artwork URL from 100px to 600px.
    const raw = (best as { artworkUrl100?: string }).artworkUrl100 || "";
    return raw.replace(/\d+x\d+bb(\.(jpg|png|webp))?$/i, "600x600bb.jpg");
  } catch {
    return "";
  }
}

async function searchCoverFallback(record: DbRecord) {
  const key = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;
  if (!key || !secret) return "";

  const artist = record.artist || "";
  const title = record.title || "";
  if (!artist && !title) return "";

  const url = new URL(`${DISCOGS_API}/database/search`);
  if (artist) url.searchParams.set("artist", artist);
  if (title) url.searchParams.set("release_title", title);
  url.searchParams.set("type", "release");
  url.searchParams.set("per_page", "5");
  url.searchParams.set("key", key);
  url.searchParams.set("secret", secret);

  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return "";
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  let best: { title?: string; cover_image?: string; thumb?: string } | null = null;
  let bestScore = 0;
  for (const r of results) {
    const s = scoreSearch(record, r);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  if (!best || bestScore < 2) return "";
  return best.cover_image || best.thumb || "";
}

function flattenTracklist(tracks: unknown[]): Array<{ type: string; position: string; title: string; duration: string }> {
  const out: Array<{ type: string; position: string; title: string; duration: string }> = [];
  for (const t of tracks || []) {
    const track = t as { type_?: string; position?: string; title?: string; duration?: string; sub_tracks?: unknown[] };
    out.push({ type: track.type_ || "track", position: track.position || "", title: track.title || "", duration: track.duration || "" });
    if (track.sub_tracks?.length) out.push(...flattenTracklist(track.sub_tracks));
  }
  return out;
}

async function fetchWithRetry(url: string, tokenKey: string, tokenSecret: string) {
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
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    return res;
  }
  return discogsRequest("GET", url, { tokenKey, tokenSecret });
}

export async function enrichPage({ userId, limit = 200, offset = 0, mode = "full", force = false }: EnrichParams) {
  const { data: tokenData } = await supabase
    .from("discogs_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) {
    throw new Error("Discogs not connected");
  }

  const { access_token, access_token_secret } = tokenData;
  let { discogs_username } = tokenData;

  if (!discogs_username) {
    const identityRes = await discogsRequest("GET", `${DISCOGS_API}/oauth/identity`, {
      tokenKey: access_token,
      tokenSecret: access_token_secret,
    });
    if (identityRes.ok) {
      const identity = await identityRes.json();
      discogs_username = identity?.username || null;
      if (discogs_username) {
        await supabase.from("discogs_tokens").update({ discogs_username }).eq("user_id", userId);
      }
    }
  }

  const recordSelectBase = "id, discogs_id, year_pressed, year_original, is_compilation, artist, title";
  const isMissingThumbColumn = (err: unknown) =>
    JSON.stringify(err || "").toLowerCase().includes("thumb") && JSON.stringify(err || "").toLowerCase().includes("column");

  let thumbSupported = true;
  let warning = "";

  const { data: records, error: recordsError } = await supabase
    .from("records")
    .select(`${recordSelectBase}, thumb`)
    .eq("user_id", userId)
    .not("discogs_id", "is", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  let recordsData = records;
  if (recordsError && isMissingThumbColumn(recordsError)) {
    thumbSupported = false;
    warning = "DB column `records.thumb` is missing; add it to store album covers.";
    const { data: fallback, error: fallbackError } = await supabase
      .from("records")
      .select(recordSelectBase)
      .eq("user_id", userId)
      .not("discogs_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    recordsData = (fallback || []).map((r) => ({ ...r, thumb: null }));
    if (fallbackError) {
      console.error("Supabase select records fallback error:", JSON.stringify(fallbackError));
      throw new Error("Failed to load records");
    }
  } else if (recordsError) {
    console.error("Supabase select records for enrich error:", JSON.stringify(recordsError));
    throw new Error("Failed to load records");
  }

  const fetched = (recordsData || []).length;
  const next_offset = fetched === limit ? offset + limit : null;

  const candidates = ((recordsData || []) as DbRecord[]).filter((r) => {
    const needsThumb = thumbSupported && (isMissingThumb(r.thumb) || isLowResThumb(r.thumb));
    if (force) return true;
    if (mode === "thumb") return needsThumb;
    return (
      needsThumb ||
      r.year_original == null ||
      r.year_pressed == null ||
      (r.year_original != null && r.year_pressed != null && r.year_original === r.year_pressed) ||
      r.is_compilation == null
    );
  });

  let processed = 0;
  let updated = 0;

  const coverByReleaseId = new Map<number, string>();
  const coverByKey = new Map<string, string>();

  if (thumbSupported && discogs_username && candidates.length > 0) {
    const needed = new Set<number>();
    for (const r of candidates) {
      if (!isMissingThumb(r.thumb)) continue;
      const releaseId = Number(r.discogs_id);
      if (Number.isFinite(releaseId)) needed.add(releaseId);
    }
    let page = 1;
    let totalPages = 1;
    do {
      const url = `${DISCOGS_API}/users/${encodeURIComponent(discogs_username)}/collection/folders/0/releases?per_page=100&page=${page}`;
      const res = await fetchWithRetry(url, access_token, access_token_secret);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        warning = `Discogs collection fetch error ${res.status}${text ? `: ${text}` : ""}`;
        break;
      }
      const data = await res.json();
      totalPages = data.pagination?.pages || 1;
      for (const rel of data.releases || []) {
        const info = rel.basic_information || {};
        const infoArtists = Array.isArray(info.artists) ? info.artists : [];
        const artistStr = joinArtists(infoArtists as Array<{ name?: string; join?: string }>);
        const titleStr = String(info.title || "");
        const releaseId = Number(info.id || rel.id);
        if (!Number.isFinite(releaseId)) continue;
        if (!releaseId || !needed.has(releaseId)) continue;
        const cover = info.cover_image || info.thumb || "";
        if (cover) {
          coverByReleaseId.set(releaseId, cover);
          const key = artistTitleKey(artistStr, titleStr);
          if (key && !coverByKey.has(key)) coverByKey.set(key, cover);
          needed.delete(releaseId);
        }
      }
      page++;
    } while (page <= totalPages && page <= 10 && needed.size > 0);
  }

  async function processRecord(r: DbRecord) {
    processed++;
    const releaseId = Number(r.discogs_id);
    if (!Number.isFinite(releaseId)) return;

    const needsThumb = thumbSupported && (isMissingThumb(r.thumb) || isLowResThumb(r.thumb));
    const needsYearFix =
      mode !== "thumb" &&
      (r.year_original == null ||
        r.year_pressed == null ||
        (r.year_original != null && r.year_pressed != null && r.year_original === r.year_pressed) ||
        r.is_compilation == null);

    let thumb = coverByReleaseId.get(releaseId) || "";
    if (!thumb) {
      const key = artistTitleKey(r.artist || "", r.title || "");
      const byKey = coverByKey.get(key);
      if (byKey) thumb = byKey;
    }

    // Check cache first — avoids API calls for already-fetched releases.
    const cached = await getReleaseCache(releaseId);

    let release: DiscogsRelease | null = null;
    const needsReleaseCall = (needsYearFix || (needsThumb && !thumb)) &&
      !(cached?.year_pressed && cached?.year_original && (!needsThumb || cached?.cover_image));

    if (needsReleaseCall) {
      await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
      const releaseRes = await fetchWithRetry(`${DISCOGS_API}/releases/${releaseId}`, access_token, access_token_secret);
      if (releaseRes.ok) {
        release = (await releaseRes.json()) as DiscogsRelease;
        const tracks = flattenTracklist((release as { tracklist?: unknown[] }).tracklist || []);
        await upsertReleaseCache(releaseId, {
          year_pressed: toYear(release.year) ?? undefined,
          cover_image: releaseThumb(release) || undefined,
          thumb: releaseThumb(release) || undefined,
          tracklist: JSON.stringify(tracks),
        });
      }
    } else if (cached) {
      // Reconstruct enough of a release object from cache to avoid API calls.
      release = { year: cached.year_pressed, master_id: undefined } as unknown as DiscogsRelease;
    }

    if (release && !thumb) {
      thumb = cached?.cover_image || releaseThumb(release);
    }

    const patch: Record<string, unknown> = {};
    if (needsYearFix) {
      const pressedYear = cached?.year_pressed ?? (release ? toYear(release.year) : null);
      let originalYear = cached?.year_original ?? pressedYear;

      // Only fetch master if we don't already have year_original cached.
      if (!cached?.year_original) {
        const masterId =
          release && typeof (release as { master_id?: unknown }).master_id === "number"
            ? ((release as { master_id: number }).master_id)
            : null;
        if (masterId) {
          await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
          const masterRes = await fetchWithRetry(`${DISCOGS_API}/masters/${masterId}`, access_token, access_token_secret);
          if (masterRes.ok) {
            const master = await masterRes.json();
            originalYear = toYear(master.year) || originalYear;
            if (!thumb) thumb = releaseThumb(master as DiscogsRelease);
            // Cache the original year so we never call the master again.
            await upsertReleaseCache(releaseId, {
              year_original: originalYear ?? undefined,
              cover_image: (thumb || cached?.cover_image) ?? undefined,
              thumb: (thumb || cached?.cover_image) ?? undefined,
            });
          }
        }
      }

      const compilation = release ? isCompilationFromFormats(release.formats) : null;
      if (pressedYear != null) patch.year_pressed = pressedYear;
      if (originalYear != null) patch.year_original = originalYear;
      if (compilation != null) patch.is_compilation = compilation;
    }

    if (thumbSupported && !thumb && isMissingThumb(r.thumb)) {
      if (cached?.cover_image) {
        thumb = cached.cover_image;
      } else {
        // 1. Try iTunes — no rate limit, high quality official art.
        try {
          thumb = await iTunesArtworkFallback(r);
        } catch { /* ignore */ }

        // 2. Fall back to Discogs search if iTunes found nothing.
        if (!thumb) {
          try {
            await new Promise((delay) => setTimeout(delay, RATE_DELAY_MS));
            thumb = await searchCoverFallback(r);
          } catch { /* ignore */ }
        }

        if (thumb) {
          await upsertReleaseCache(releaseId, { cover_image: thumb, thumb });
        }
      }
    }

    if (thumbSupported && thumb && (isMissingThumb(r.thumb) || isLowResThumb(r.thumb))) {
      patch.thumb = thumb;
    }

    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase
      .from("records")
      .update(patch)
      .eq("id", r.id)
      .eq("user_id", userId);

    if (error) {
      console.error("Supabase update record enrich error:", JSON.stringify(error));
      return;
    }
    updated++;
  }

  for (const record of candidates) {
    await processRecord(record);
  }

  return {
    processed,
    updated,
    considered: candidates.length,
    next_offset,
    offset,
    limit,
    thumb_supported: thumbSupported,
    warning,
    mode,
  };
}
