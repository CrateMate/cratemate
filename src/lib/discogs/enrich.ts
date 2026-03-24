import { supabase } from "@/lib/supabase";
import { DISCOGS_API, USER_AGENT, discogsRequest } from "@/lib/discogs";
import {
  getReleaseCache,
  upsertReleaseCache,
  getItunesArtCache,
  upsertItunesArtCache,
  isItunesArtCacheFresh,
  itunesArtKey,
} from "@/lib/discogs/cache";
import { fetchArtistDates, fetchReleaseDate } from "@/lib/musicbrainz";

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
  release_month?: number | null;
  release_day?: number | null;
  artist_birth_month?: number | null;
  artist_birth_year?: number | null;
  artist_death_month?: number | null;
};

type EnrichParams = {
  userId: string;
  limit?: number;
  offset?: number;
  mode?: "full" | "thumb";
  force?: boolean;
};

function parseReleaseDate(released: unknown): { month: number | null; day: number | null } {
  if (typeof released !== "string" || !released.trim()) return { month: null, day: null };
  const parts = released.trim().split("-");
  const month = parts[1] ? parseInt(parts[1], 10) : null;
  const day   = parts[2] ? parseInt(parts[2], 10) : null;
  return {
    month: month && month >= 1 && month <= 12 ? month : null,
    day:   day   && day   >= 1 && day   <= 31 ? day   : null,
  };
}

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
  // Old Discogs CDN thumbnail pattern.
  if (/-150\.(jpe?g|png|webp)(\?.*)?$/.test(trimmed)) return true;
  // New Discogs imgproxy CDN: HMAC-signed URLs with 150px dimensions or q:40 quality.
  if (trimmed.includes("i.discogs.com") && (/\/h:150\//.test(trimmed) || /\/w:150\//.test(trimmed) || /\/q:40\//.test(trimmed))) return true;
  // Discogs user-uploaded photos.
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
  const uri = typeof first?.uri === "string" ? first.uri : "";
  const uri150 = typeof first?.uri150 === "string" ? first.uri150 : "";
  return uri || uri150 || ""; // prefer full-res uri over thumbnail uri150
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

  // Check shared iTunes art cache first
  const cacheKey = itunesArtKey(artist, title);
  const cached = await getItunesArtCache(cacheKey);
  if (cached && isItunesArtCacheFresh(cached)) {
    return cached.art_url || "";
  }

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

    // Upgrade artwork URL from 100px to 1000px.
    const raw = best && bestScore >= 4 ? ((best as { artworkUrl100?: string }).artworkUrl100 || "") : "";
    const artUrl = raw ? raw.replace(/\d+x\d+bb(\.(jpg|png|webp))?$/i, "1000x1000bb.jpg") : "";

    // Cache result (including "not found" = null) so we don't re-query
    await upsertItunesArtCache(cacheKey, artUrl || null);

    return artUrl;
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

  const recordSelectBase = "id, discogs_id, year_pressed, year_original, is_compilation, artist, title, release_month, release_day";
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
      r.is_compilation == null ||
      r.release_month == null
    );
  });

  let processed = 0;
  let updated = 0;

  const coverByReleaseId = new Map<number, string>();
  const coverByKey = new Map<string, string>();

  if (thumbSupported && discogs_username && candidates.length > 0) {
    const needed = new Set<number>();
    for (const r of candidates) {
      if (!isMissingThumb(r.thumb) && !isLowResThumb(r.thumb)) continue;
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
    const needsReleaseDateFix = mode !== "thumb" && r.release_month == null;

    let thumb = coverByReleaseId.get(releaseId) || "";
    if (!thumb) {
      const key = artistTitleKey(r.artist || "", r.title || "");
      const byKey = coverByKey.get(key);
      if (byKey) thumb = byKey;
    }

    // Check cache first — avoids API calls for already-fetched releases.
    const cached = await getReleaseCache(releaseId);
    // A cached cover is only "good" if it's not itself a low-res thumbnail.
    const cachedCoverOk = !!(cached?.cover_image && !isLowResThumb(cached.cover_image));

    // Sentinel: master_id === 0 in the release cache means "we fetched the release (and master
    // if one exists) and found no original year — pressing year is the best available."
    // Discogs itself uses master_id: 0 for releases with no master, so 0 is unambiguously
    // "no master" — it can never be confused with a real master ID.
    const cachedYearSentinel = cached?.master_id === 0;

    // year_original === year_pressed (and NOT a sentinel record) means the old "no master found"
    // fallback was stored by a previous version of this code. Force a release re-fetch this
    // pass so we get the real master_id and resolve the correct original year immediately.
    const cachedYearBadFallback =
      !cachedYearSentinel &&
      cached?.year_original != null &&
      cached?.year_pressed != null &&
      cached.year_original === cached.year_pressed;

    // If we've already confirmed the release has no year and no master, skip re-fetching.
    const yearLessConfirmed = cachedYearSentinel && !cached?.year_pressed;

    let release: DiscogsRelease | null = null;
    const needsReleaseCall = !yearLessConfirmed &&
      (needsYearFix || needsReleaseDateFix || (needsThumb && !thumb)) &&
      (cachedYearBadFallback ||  // force re-fetch to resolve bad year in one pass
       needsReleaseDateFix ||
       !(cached?.year_pressed && cached?.year_original && (!needsThumb || cachedCoverOk)));

    if (needsReleaseCall) {
      await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
      const releaseRes = await fetchWithRetry(`${DISCOGS_API}/releases/${releaseId}`, access_token, access_token_secret);
      if (releaseRes.ok) {
        release = (await releaseRes.json()) as DiscogsRelease;
        const tracks = flattenTracklist((release as { tracklist?: unknown[] }).tracklist || []);
        // Discogs returns master_id: 0 for releases without a master — store as-is.
        const releaseMasterId = typeof (release as { master_id?: unknown }).master_id === "number"
          ? (release as { master_id: number }).master_id
          : null;
        await upsertReleaseCache(releaseId, {
          year_pressed: toYear(release.year) ?? undefined,
          cover_image: releaseThumb(release) || undefined,
          thumb: releaseThumb(release) || undefined,
          tracklist: JSON.stringify(tracks),
          master_id: releaseMasterId,
        });
      }
    } else if (cached) {
      // Reconstruct enough of a release object from cache to avoid API calls.
      release = { year: cached.year_pressed, master_id: cached.master_id ?? undefined } as unknown as DiscogsRelease;
    }

    if (release && !thumb) {
      thumb = (cachedCoverOk ? cached!.cover_image! : null) || releaseThumb(release);
    }

    const patch: Record<string, unknown> = {};
    if (needsYearFix) {
      const pressedYear = cached?.year_pressed ?? (release ? toYear(release.year) : null);

      // For sentinel records where year_original is intentionally set to pressing year,
      // treat that as already resolved — no master lookup needed.
      const yearIsSentinelResolved =
        cachedYearSentinel &&
        cached?.year_original != null &&
        cached.year_original === cached.year_pressed;

      let originalYear: number | null =
        cachedYearBadFallback    ? null :
        yearIsSentinelResolved   ? cached!.year_original! :
        (cached?.year_original ?? null);

      if (originalYear == null) {
        const masterId =
          release && typeof (release as { master_id?: unknown }).master_id === "number"
            ? ((release as { master_id: number }).master_id)
            : null;
        if (masterId) {  // truthy: real master id (Discogs uses 0 for "no master")
          await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
          const masterRes = await fetchWithRetry(`${DISCOGS_API}/masters/${masterId}`, access_token, access_token_secret);
          if (masterRes.ok) {
            const master = await masterRes.json();
            const masterYear = toYear(master.year);
            if (masterYear) {
              originalYear = masterYear;
            } else if (pressedYear) {
              // Master exists but has no year — use pressing year and mark as sentinel
              // so we don't keep re-fetching this master.
              originalYear = pressedYear;
              await upsertReleaseCache(releaseId, { master_id: 0 });
            }
            if (!thumb) thumb = releaseThumb(master as DiscogsRelease);
            await upsertReleaseCache(releaseId, {
              year_original: originalYear ?? undefined,
              cover_image: (thumb || cached?.cover_image) ?? undefined,
              thumb: (thumb || cached?.cover_image) ?? undefined,
            });
          }
        } else if (needsReleaseCall && release) {
          // Fresh release fetch confirmed no master (master_id = 0 from Discogs, already stored
          // in cache above). Use pressing year as best effort; sentinel stops future re-fetching.
          // Only runs when the release API call succeeded — if it failed, release is null and
          // we leave originalYear as null so the record is retried next sync.
          if (pressedYear) {
            originalYear = pressedYear;
            await upsertReleaseCache(releaseId, { year_original: pressedYear });
          }
        }
        // If !needsReleaseCall here, this record had no master_id in old cache — but
        // cachedYearBadFallback = true above would have forced needsReleaseCall = true,
        // so this branch is only reached for records with no release cache at all
        // (API call failed). They will be retried next sync.
      }

      const compilation = release ? isCompilationFromFormats(release.formats) : null;
      if (pressedYear != null) patch.year_pressed = pressedYear;
      if (originalYear != null) patch.year_original = originalYear;
      if (compilation != null) patch.is_compilation = compilation;
    }

    if (release) {
      const released = (release as { released?: unknown })?.released;
      const { month, day } = parseReleaseDate(released);
      if (month != null) patch.release_month = month;
      if (day   != null) patch.release_day   = day;
    }

    // iTunes / Discogs search fallback — only for truly missing covers, never for low-res ones.
    // Low-res Discogs thumbs are blurry but correct for the specific pressing; iTunes may return
    // artwork for a different edition, so we never use it to replace an existing Discogs image.
    if (thumbSupported && !thumb && isMissingThumb(r.thumb)) {
      if (cachedCoverOk) {
        thumb = cached!.cover_image!;
      } else {
        try {
          thumb = await iTunesArtworkFallback(r);
        } catch { /* ignore */ }

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

// ─── Single-record enrichment (used by action-triggered lazy enrichment) ────

type DbRecordFull = DbRecord & {
  artist_birth_month?: number | null;
  artist_birth_year?: number | null;
  artist_birth_day?: number | null;
  artist_death_year?: number | null;
  artist_death_month?: number | null;
  artist_death_day?: number | null;
  release_day?: number | null;
};

/**
 * Enrich a single record with Discogs + MusicBrainz data.
 * Checks which fields are already populated and skips any API call that isn't needed.
 * Safe to call fire-and-forget — fully idempotent.
 *
 * MusicBrainz jitter (0–1200ms random delay) is applied before each MB call so that
 * parallel invocations (e.g. ±2 neighbors opening simultaneously) don't all hit
 * MusicBrainz at the same instant.
 */
export async function enrichSingleRecord(
  userId: string,
  recordId: string
): Promise<{ updated: boolean; skipped: boolean }> {
  // Fetch the record with all enrichment-relevant fields
  const { data: record } = await supabase
    .from("records")
    .select(
      "id, discogs_id, year_pressed, year_original, is_compilation, thumb, artist, title, " +
      "release_month, release_day, artist_birth_month, artist_birth_year, artist_birth_day, " +
      "artist_death_year, artist_death_month, artist_death_day"
    )
    .eq("id", recordId)
    .eq("user_id", userId)
    .single();

  if (!record) return { updated: false, skipped: true };

  const r = record as unknown as DbRecordFull;

  // Decide what's needed before any API call
  const needsThumb = isMissingThumb(r.thumb) || isLowResThumb(r.thumb);
  const needsYearFix =
    r.year_original == null ||
    r.year_pressed == null ||
    r.is_compilation == null ||
    (r.year_original != null && r.year_pressed != null && r.year_original === r.year_pressed);
  const needsReleaseDateFix = r.release_month == null;
  // release_day === 0 is the "checked, not found" sentinel — skip
  const needsMbReleaseDate =
    !r.is_compilation &&
    r.release_day == null &&
    r.year_original != null &&
    !!r.artist &&
    !!r.title;
  // artist_birth_month === 0 is the "checked" sentinel (0 = group or not found) — skip
  let needsMbArtist = !r.is_compilation && r.artist_birth_month == null && !!r.artist;

  const needsDiscogs = r.discogs_id != null && (needsThumb || needsYearFix || needsReleaseDateFix);

  if (!needsDiscogs && !needsMbReleaseDate && !needsMbArtist) {
    return { updated: false, skipped: true };
  }

  const patch: Record<string, unknown> = {};

  // ── Discogs enrichment ────────────────────────────────────────────────────
  if (needsDiscogs) {
    // Fetch Discogs OAuth token — fall through to MB-only if not connected
    const { data: tokenData } = await supabase
      .from("discogs_tokens")
      .select("access_token, access_token_secret")
      .eq("user_id", userId)
      .single();

    if (tokenData) {
      const { access_token, access_token_secret } = tokenData;
      const releaseId = Number(r.discogs_id);

      const cached = await getReleaseCache(releaseId);
      const cachedCoverOk = !!(cached?.cover_image && !isLowResThumb(cached.cover_image));
      const cachedYearSentinel = cached?.master_id === 0;
      const cachedYearBadFallback =
        !cachedYearSentinel &&
        cached?.year_original != null &&
        cached?.year_pressed != null &&
        cached.year_original === cached.year_pressed;
      const yearLessConfirmed = cachedYearSentinel && !cached?.year_pressed;

      const needsReleaseCall =
        !yearLessConfirmed &&
        (needsYearFix || needsReleaseDateFix || (needsThumb && !cachedCoverOk)) &&
        (cachedYearBadFallback ||
          needsReleaseDateFix ||
          !(cached?.year_pressed && cached?.year_original && (!needsThumb || cachedCoverOk)));

      let release: DiscogsRelease | null = null;

      if (needsReleaseCall) {
        const releaseRes = await fetchWithRetry(
          `${DISCOGS_API}/releases/${releaseId}`,
          access_token,
          access_token_secret
        );
        if (releaseRes.ok) {
          release = (await releaseRes.json()) as DiscogsRelease;
          const tracks = flattenTracklist(
            (release as { tracklist?: unknown[] }).tracklist || []
          );
          const releaseMasterId =
            typeof (release as { master_id?: unknown }).master_id === "number"
              ? (release as { master_id: number }).master_id
              : null;
          await upsertReleaseCache(releaseId, {
            year_pressed: toYear(release.year) ?? undefined,
            cover_image: releaseThumb(release) || undefined,
            thumb: releaseThumb(release) || undefined,
            tracklist: JSON.stringify(tracks),
            master_id: releaseMasterId,
          });
        }
      } else if (cached) {
        release = {
          year: cached.year_pressed,
          master_id: cached.master_id ?? undefined,
        } as unknown as DiscogsRelease;
      }

      let thumb = "";
      if (release) {
        thumb = (cachedCoverOk ? cached!.cover_image! : null) || releaseThumb(release);
      }

      if (needsYearFix && release) {
        const pressedYear = cached?.year_pressed ?? toYear(release.year);
        const yearIsSentinelResolved =
          cachedYearSentinel &&
          cached?.year_original != null &&
          cached.year_original === cached.year_pressed;
        let originalYear: number | null =
          cachedYearBadFallback ? null :
          yearIsSentinelResolved ? cached!.year_original! :
          (cached?.year_original ?? null);

        if (originalYear == null) {
          const masterId =
            release && typeof (release as { master_id?: unknown }).master_id === "number"
              ? (release as { master_id: number }).master_id
              : null;
          if (masterId) {
            await new Promise((res) => setTimeout(res, RATE_DELAY_MS));
            const masterRes = await fetchWithRetry(
              `${DISCOGS_API}/masters/${masterId}`,
              access_token,
              access_token_secret
            );
            if (masterRes.ok) {
              const master = await masterRes.json();
              const masterYear = toYear(master.year);
              if (masterYear) {
                originalYear = masterYear;
              } else if (pressedYear) {
                originalYear = pressedYear;
                await upsertReleaseCache(releaseId, { master_id: 0 });
              }
              if (!thumb) thumb = releaseThumb(master as DiscogsRelease);
              await upsertReleaseCache(releaseId, {
                year_original: originalYear ?? undefined,
                cover_image: (thumb || cached?.cover_image) ?? undefined,
                thumb: (thumb || cached?.cover_image) ?? undefined,
              });
            }
          } else if (needsReleaseCall && release && pressedYear) {
            originalYear = pressedYear;
            await upsertReleaseCache(releaseId, { year_original: pressedYear });
          }
        }

        const compilation = release ? isCompilationFromFormats(release.formats) : null;
        if (pressedYear != null) patch.year_pressed = pressedYear;
        if (originalYear != null) patch.year_original = originalYear;
        if (compilation != null) patch.is_compilation = compilation;
      }

      if (release) {
        const released = (release as { released?: unknown })?.released;
        const { month, day } = parseReleaseDate(released);
        if (month != null) patch.release_month = month;
        if (day != null) patch.release_day = day;
      }

      // Artwork fallback — only for truly missing covers
      if (!thumb && isMissingThumb(r.thumb)) {
        if (cachedCoverOk) {
          thumb = cached!.cover_image!;
        } else {
          try { thumb = await iTunesArtworkFallback(r); } catch { /* ignore */ }
          if (!thumb) {
            try { thumb = await searchCoverFallback(r); } catch { /* ignore */ }
          }
          if (thumb) await upsertReleaseCache(releaseId, { cover_image: thumb, thumb });
        }
      }

      if (thumb && (isMissingThumb(r.thumb) || isLowResThumb(r.thumb))) {
        patch.thumb = thumb;
      }
    }
  }

  // ── MusicBrainz release date ──────────────────────────────────────────────
  if (needsMbReleaseDate) {
    // Random jitter so parallel calls (window neighbours) don't all hit MB at once
    await new Promise((res) => setTimeout(res, Math.random() * 1200));
    const mbRelease = await fetchReleaseDate(r.artist!, r.title!, r.year_original ?? null);
    // Don't store sentinel on transient MB errors — leave null so next enrichment retries
    if (!("transient" in mbRelease && mbRelease.transient)) {
      patch.release_day = mbRelease.day ?? 0; // 0 = sentinel "checked, not found"
      if (r.release_month == null && mbRelease.month != null) patch.release_month = mbRelease.month;
    }
  }

  // ── MusicBrainz artist dates ──────────────────────────────────────────────
  if (needsMbArtist) {
    // Check shared artist_metadata cache before hitting MB
    const { data: artistCached } = await supabase
      .from("artist_metadata")
      .select("artist_type, birth_year, birth_month, birth_day, death_year, death_month, death_day, members")
      .eq("artist_name", r.artist!)
      .single();

    let dates;
    if (artistCached) {
      dates = {
        artistType: artistCached.artist_type as "person" | "group" | "other" | null,
        birthYear: artistCached.birth_year, birthMonth: artistCached.birth_month,
        birthDay: artistCached.birth_day, deathYear: artistCached.death_year,
        deathMonth: artistCached.death_month, deathDay: artistCached.death_day,
        members: Array.isArray(artistCached.members) ? artistCached.members : [],
      };
    } else {
      // Jitter only if we haven't already jittered for MB release date above
      if (!needsMbReleaseDate) {
        await new Promise((res) => setTimeout(res, Math.random() * 1200));
      }
      dates = await fetchArtistDates(r.artist!);
      const isTransient = "transient" in dates && (dates as { transient?: boolean }).transient;
      // Only cache if MB returned real data — never overwrite good data with EMPTY or transient failures
      if (dates.artistType !== null && !isTransient) {
        await supabase.from("artist_metadata").upsert({
          artist_name: r.artist!,
          artist_type: dates.artistType,
          birth_year: dates.birthYear, birth_month: dates.birthMonth, birth_day: dates.birthDay,
          death_year: dates.deathYear, death_month: dates.deathMonth, death_day: dates.deathDay,
          members: dates.members.length > 0 ? dates.members : null,
          cached_at: new Date().toISOString(),
        });
      }
      // On transient failure, skip writing artist fields to the record so next enrichment retries
      if (isTransient) { needsMbArtist = false; }
    }

    if (needsMbArtist) {
      const isGroup = dates.artistType === "group";
      const groupHasMembers = isGroup && dates.members.length > 0;
      patch.artist_birth_month = isGroup ? (groupHasMembers ? 0 : null) : (dates.birthMonth ?? 0);
      patch.artist_birth_year = isGroup ? null : dates.birthYear;
      patch.artist_birth_day = isGroup ? null : dates.birthDay;
      patch.artist_death_year = isGroup ? null : dates.deathYear;
      patch.artist_death_month = isGroup ? null : dates.deathMonth;
      patch.artist_death_day = isGroup ? null : dates.deathDay;
    }
  }

  if (Object.keys(patch).length === 0) return { updated: false, skipped: true };

  await supabase.from("records").update(patch).eq("id", recordId).eq("user_id", userId);
  return { updated: true, skipped: false };
}

export async function enrichReleaseDates({ userId }: { userId: string }) {
  // Fetch non-compilation records missing release_day (null = never checked via MusicBrainz)
  const { data: records, error } = await supabase
    .from("records")
    .select("id, artist, title, year_original, release_month")
    .eq("user_id", userId)
    .not("is_compilation", "is", true)
    .is("release_day", null)
    .not("year_original", "is", null)
    .not("artist", "is", null)
    .not("title", "is", null);

  if (error) throw new Error("Failed to load records for release date enrichment");

  // Deduplicate by artist+title — same album with multiple pressings shares one MB lookup
  const keyToGroup = new Map<string, { ids: number[]; artist: string; title: string; year: number | null; hasMonth: boolean }>();
  for (const r of records || []) {
    const key = artistTitleKey((r as { artist?: string }).artist || "", (r as { title?: string }).title || "");
    if (!key) continue;
    const existing = keyToGroup.get(key);
    if (existing) {
      existing.ids.push((r as { id: number }).id);
    } else {
      keyToGroup.set(key, {
        ids: [(r as { id: number }).id],
        artist: (r as { artist?: string }).artist || "",
        title:  (r as { title?: string }).title  || "",
        year:   (r as { year_original?: number | null }).year_original ?? null,
        hasMonth: (r as { release_month?: number | null }).release_month != null,
      });
    }
  }

  let processed = 0;
  let updated = 0;

  for (const { ids, artist, title, year, hasMonth } of keyToGroup.values()) {
    processed++;
    const mbRelease = await fetchReleaseDate(artist, title, year);

    // Skip storing sentinel on transient MB errors so next enrichment retries
    if ("transient" in mbRelease && mbRelease.transient) continue;

    // Always write release_day — 0 = "checked, not found" sentinel so we skip it next run
    // Never overwrite existing Discogs release_month; only fill if currently null
    const patch: Record<string, unknown> = { release_day: mbRelease.day ?? 0 };
    if (!hasMonth && mbRelease.month != null) patch.release_month = mbRelease.month;

    const { error: updateError } = await supabase
      .from("records")
      .update(patch)
      .in("id", ids)
      .eq("user_id", userId);

    if (!updateError && mbRelease.day) updated += ids.length;
  }

  return { processed, updated };
}

export async function enrichArtistDates({ userId }: { userId: string }) {
  // Fetch user's non-compilation records missing artist birth month
  const { data: records, error } = await supabase
    .from("records")
    .select("id, artist, artist_birth_month")
    .eq("user_id", userId)
    .not("is_compilation", "is", true)
    .is("artist_birth_month", null)
    .not("artist", "is", null);

  if (error) throw new Error("Failed to load records for artist enrichment");

  // Deduplicate by artist name
  const artistToIds = new Map<string, number[]>();
  for (const r of records || []) {
    const name = (r as { artist?: string }).artist?.trim();
    if (!name) continue;
    const existing = artistToIds.get(name) || [];
    existing.push((r as { id: number }).id);
    artistToIds.set(name, existing);
  }

  let processed = 0;
  let updated = 0;
  let cacheHits = 0;

  for (const [artistName, recordIds] of artistToIds) {
    processed++;

    // Check shared cache first
    const { data: cached } = await supabase
      .from("artist_metadata")
      .select("artist_type, birth_year, birth_month, birth_day, death_year, death_month, death_day, members")
      .eq("artist_name", artistName)
      .single();

    let dates;
    if (cached) {
      cacheHits++;
      dates = {
        artistType: cached.artist_type as "person" | "group" | "other" | null,
        birthYear:  cached.birth_year,
        birthMonth: cached.birth_month,
        birthDay:   cached.birth_day,
        deathYear:  cached.death_year,
        deathMonth: cached.death_month,
        deathDay:   cached.death_day,
        members:    Array.isArray(cached.members) ? cached.members : [],
      };
    } else {
      // Cache miss — call MusicBrainz (includes 1.1s rate-limit delay)
      dates = await fetchArtistDates(artistName);
      const isTransient = "transient" in dates && (dates as { transient?: boolean }).transient;

      // Only cache if MB returned real data — never overwrite good data with EMPTY or transient failures
      if (dates.artistType !== null && !isTransient) {
        await supabase.from("artist_metadata").upsert({
          artist_name:  artistName,
          artist_type:  dates.artistType,
          birth_year:   dates.birthYear,
          birth_month:  dates.birthMonth,
          birth_day:    dates.birthDay,
          death_year:   dates.deathYear,
          death_month:  dates.deathMonth,
          death_day:    dates.deathDay,
          members:      dates.members.length > 0 ? dates.members : null,
          cached_at:    new Date().toISOString(),
        });
      }
      // Skip writing to records on transient failure so next enrichment retries
      if (isTransient) continue;
    }

    // For groups: individual dates live in artist_metadata.members — don't flatten onto records.
    // For persons: store birth/death directly on records for fast reco queries.
    // Sentinel: artist_birth_month = 0 means "enriched, check artist_metadata".
    // For groups we only write the sentinel when members were actually returned —
    // if MB found the group but returned 0 members, leave artist_birth_month null
    // so the next enrichment run retries rather than permanently skipping it.
    const isGroup = dates.artistType === "group";
    const groupHasMembers = isGroup && dates.members.length > 0;
    const patch: Record<string, unknown> = {
      artist_birth_month: isGroup ? (groupHasMembers ? 0 : null) : (dates.birthMonth ?? 0),
      artist_birth_year:  isGroup ? null : dates.birthYear,
      artist_birth_day:   isGroup ? null : dates.birthDay,
      artist_death_year:  isGroup ? null : dates.deathYear,
      artist_death_month: isGroup ? null : dates.deathMonth,
      artist_death_day:   isGroup ? null : dates.deathDay,
    };

    const { error: updateError } = await supabase
      .from("records")
      .update(patch)
      .in("id", recordIds)
      .eq("user_id", userId);

    if (!updateError) updated += recordIds.length;
  }

  return { processed, updated, cacheHits };
}
