const MB_API = "https://musicbrainz.org/ws/2";
const MB_USER_AGENT = "CrateMate/1.0 (cratemate2026@gmail.com)";
const RATE_DELAY_MS = 1100; // MusicBrainz asks for max 1 req/sec

function parseMbDate(dateStr: unknown): { year: number | null; month: number | null; day: number | null } {
  if (typeof dateStr !== "string" || !dateStr.trim()) return { year: null, month: null, day: null };
  const parts = dateStr.trim().split("-");
  const year  = parts[0] ? parseInt(parts[0], 10) : null;
  const month = parts[1] ? parseInt(parts[1], 10) : null;
  const day   = parts[2] ? parseInt(parts[2], 10) : null;
  return {
    year:  year  && year  > 0              ? year  : null,
    month: month && month >= 1 && month <= 12 ? month : null,
    day:   day   && day   >= 1 && day   <= 31 ? day   : null,
  };
}

export type MemberDates = {
  name: string;
  // When they were in the band — used to filter by record year.
  joinedYear: number | null;
  leftYear:   number | null;
  // Their own life dates.
  birthYear:  number | null;
  birthMonth: number | null;
  birthDay:   number | null;
  deathYear:  number | null;
  deathMonth: number | null;
  deathDay:   number | null;
};

export type ArtistDates = {
  artistType: "person" | "group" | "other" | null;
  // For persons: actual birth/death. For groups: formation/dissolution (lower value for reco engine).
  birthYear:  number | null;
  birthMonth: number | null;
  birthDay:   number | null;
  deathYear:  number | null;
  deathMonth: number | null;
  deathDay:   number | null;
  // Non-empty only for groups — individual member birth/death dates.
  members: MemberDates[];
};

const EMPTY: ArtistDates = {
  artistType: null,
  birthYear: null, birthMonth: null, birthDay: null,
  deathYear: null, deathMonth: null, deathDay: null,
  members: [],
};

async function mbFetch(url: string, delayMs = RATE_DELAY_MS): Promise<unknown> {
  await new Promise((r) => setTimeout(r, delayMs));
  const res = await fetch(url, { headers: { "User-Agent": MB_USER_AGENT } });
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}: ${url}`);
  return res.json();
}

type MbReleaseStub = {
  title?: string;
  date?: string;
  score?: number;
};

/** Fetch the exact release date (day + month) for an album from MusicBrainz.
 *  Guardrails:
 *  - Score must be ≥ 90 (strict match)
 *  - Year must match `knownYear` from Discogs (prevents remaster/edition swaps)
 *  - Only returns day; never overwrites year or month from Discogs
 *  Returns null fields if no confident match found. */
export async function fetchReleaseDate(
  artist: string,
  title: string,
  knownYear: number | null
): Promise<{ day: number | null; month: number | null }> {
  try {
    const query = `release:"${title}" AND artist:"${artist}"`;
    const data = await mbFetch(
      `${MB_API}/release?query=${encodeURIComponent(query)}&limit=5&fmt=json`
    ) as { releases?: MbReleaseStub[] };

    for (const rel of data?.releases || []) {
      if ((rel.score ?? 0) < 90) continue;
      const parsed = parseMbDate(rel.date);
      if (!parsed.year) continue;
      // Year guard — MB year must match what Discogs already gave us
      if (knownYear && parsed.year !== knownYear) continue;
      if (!parsed.day) continue; // no day = no value for us
      return { day: parsed.day, month: parsed.month };
    }
    return { day: null, month: null };
  } catch {
    return { day: null, month: null };
  }
}

type MbArtistStub = {
  id: string;
  name?: string;
  type?: string;
  score?: number;
  "life-span"?: { begin?: string; end?: string };
};

type MbRelation = {
  type?: string;
  direction?: string;
  begin?: string;  // year member joined the band
  end?: string;    // year member left the band
  artist?: {
    id?: string;
    name?: string;
    type?: string;
    "life-span"?: { begin?: string; end?: string };
  };
};

function normaliseArtistName(s: string): string {
  return s.toLowerCase().replace(/^the\s+/i, "").replace(/[^a-z0-9]/g, "");
}

export async function fetchArtistDates(artistName: string): Promise<ArtistDates> {
  try {
    // Step 1 — Search by name, take highest-confidence match.
    // Try the full name first; if nothing scores ≥85 also try without a leading "The".
    const trySearch = async (query: string) => {
      const data = await mbFetch(
        `${MB_API}/artist?query=artist:${encodeURIComponent(query)}&fmt=json`
      ) as { artists?: MbArtistStub[] };
      return data?.artists || [];
    };

    let artists = await trySearch(artistName);

    // Fallback: strip leading "The " and retry (e.g. "The Cure" → "Cure")
    const stripped = artistName.replace(/^the\s+/i, "").trim();
    if (stripped !== artistName && (artists.length === 0 || (artists[0].score ?? 0) < 85)) {
      const fallback = await trySearch(stripped);
      if (fallback.length > 0 && (fallback[0].score ?? 0) > (artists[0]?.score ?? 0)) {
        artists = fallback;
      }
    }

    if (!artists.length) return EMPTY;

    // Name similarity check — confirm the top result actually matches before using it.
    // Prevents tribute bands or unrelated artists with similar names from sneaking in.
    const normQuery = normaliseArtistName(artistName);
    const best = artists.find((a) => {
      if ((a.score ?? 0) < 85) return false;
      const normResult = normaliseArtistName(a.name || "");
      return normResult.includes(normQuery) || normQuery.includes(normResult);
    }) || artists[0];

    if ((best.score ?? 100) < 85) return EMPTY;

    const rawType = (best.type || "").toLowerCase();
    const artistType: ArtistDates["artistType"] =
      rawType === "person" ? "person" :
      rawType === "group"  ? "group"  : "other";

    // Search stubs don't reliably include life-span — do a full lookup for persons.
    if (artistType !== "group") {
      const personData = await mbFetch(
        `${MB_API}/artist/${best.id}?fmt=json`
      ) as { "life-span"?: { begin?: string; end?: string } };
      const ls = personData["life-span"] || {};
      const birth = parseMbDate(ls.begin);
      const death = parseMbDate(ls.end);
      return {
        artistType,
        birthYear:  birth.year,  birthMonth: birth.month,  birthDay:  birth.day,
        deathYear:  death.year,  deathMonth: death.month,  deathDay:  death.day,
        members: [],
      };
    }

    // Step 2 — For groups, fetch full artist record + member relations.
    // The full lookup (not search stub) has the accurate life-span for the group
    // itself, and artist-rels embeds each member's own life-span.
    const groupData = await mbFetch(
      `${MB_API}/artist/${best.id}?inc=artist-rels&fmt=json`
    ) as { "life-span"?: { begin?: string; end?: string }; relations?: MbRelation[] };

    // Collect member stubs first (no per-member fetch yet).
    type MemberStub = { id: string; name: string; joinedYear: number | null; leftYear: number | null };
    const memberStubs: MemberStub[] = [];
    for (const rel of groupData?.relations || []) {
      // "member of band" with direction "backward" = this person is a member of the group.
      if (rel.type !== "member of band" || rel.direction !== "backward") continue;
      if (!rel.artist?.id) continue;
      // Skip nested sub-groups (e.g. a supergroup as a member).
      if ((rel.artist.type || "").toLowerCase() !== "person") continue;

      const joined = parseMbDate(rel.begin);
      const left   = parseMbDate(rel.end);
      memberStubs.push({
        id:         rel.artist.id,
        name:       rel.artist.name || "",
        joinedYear: joined.year,
        leftYear:   left.year,
      });
    }

    // Sort by tenure length descending so the most iconic/longest-standing members
    // are fetched first. If we hit rate limits or timeout, the less significant
    // members (shortest tenure) are the ones that fall off.
    const currentYear = new Date().getFullYear();
    memberStubs.sort((a, b) => {
      const tenureA = (a.leftYear || currentYear) - (a.joinedYear || currentYear);
      const tenureB = (b.leftYear || currentYear) - (b.joinedYear || currentYear);
      return tenureB - tenureA;
    });

    // Per-member full lookup — stubs don't include life-span reliably.
    // 500ms strikes a balance: 10 members × 500ms = ~5s, within Vercel Hobby's 10s limit,
    // while staying under MB's rate limit to avoid 429s.
    const MEMBER_DELAY_MS = 500;
    const members: MemberDates[] = [];
    for (const stub of memberStubs.slice(0, 10)) {
      try {
        const memberData = await mbFetch(
          `${MB_API}/artist/${stub.id}?fmt=json`,
          MEMBER_DELAY_MS
        ) as { "life-span"?: { begin?: string; end?: string } };
        const ls    = memberData["life-span"] || {};
        const birth = parseMbDate(ls.begin);
        const death = parseMbDate(ls.end);
        members.push({
          name:       stub.name,
          joinedYear: stub.joinedYear,
          leftYear:   stub.leftYear,
          birthYear:  birth.year,  birthMonth: birth.month,  birthDay:  birth.day,
          deathYear:  death.year,  deathMonth: death.month,  deathDay:  death.day,
        });
      } catch {
        // Fall back to stub (all nulls) so the member still appears.
        members.push({
          name:       stub.name,
          joinedYear: stub.joinedYear,
          leftYear:   stub.leftYear,
          birthYear:  null, birthMonth: null, birthDay:  null,
          deathYear:  null, deathMonth: null, deathDay:  null,
        });
      }
    }

    // Use formation/dissolution from the full lookup, not the search stub.
    const groupLs = groupData["life-span"] || {};
    const groupBirth = parseMbDate(groupLs.begin);
    const groupDeath = parseMbDate(groupLs.end);

    return {
      artistType: "group",
      birthYear:  groupBirth.year,  birthMonth: groupBirth.month,  birthDay:  groupBirth.day,
      deathYear:  groupDeath.year,  deathMonth: groupDeath.month,  deathDay:  groupDeath.day,
      members,
    };
  } catch {
    return EMPTY;
  }
}
