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

async function mbFetch(url: string): Promise<unknown> {
  await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
  const res = await fetch(url, { headers: { "User-Agent": MB_USER_AGENT } });
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}: ${url}`);
  return res.json();
}

type MbArtistStub = {
  id: string;
  type?: string;
  score?: number;
  "life-span"?: { begin?: string; end?: string };
};

type MbRelation = {
  type?: string;
  direction?: string;
  artist?: {
    name?: string;
    type?: string;
    "life-span"?: { begin?: string; end?: string };
  };
};

export async function fetchArtistDates(artistName: string): Promise<ArtistDates> {
  try {
    // Step 1 — Search by name, take highest-confidence match.
    const searchData = await mbFetch(
      `${MB_API}/artist?query=artist:${encodeURIComponent(artistName)}&fmt=json`
    ) as { artists?: MbArtistStub[] };

    const artists = searchData?.artists || [];
    if (!artists.length) return EMPTY;

    const best = artists[0];
    // MusicBrainz returns a 0–100 relevance score; skip poor matches.
    if ((best.score ?? 100) < 85) return EMPTY;

    const rawType = (best.type || "").toLowerCase();
    const artistType: ArtistDates["artistType"] =
      rawType === "person" ? "person" :
      rawType === "group"  ? "group"  : "other";

    const lifeSpan = best["life-span"] || {};
    const topBirth = parseMbDate(lifeSpan.begin);
    const topDeath = parseMbDate(lifeSpan.end);

    // For individuals (and edge cases like "other"), we're done — one API call.
    if (artistType !== "group") {
      return {
        artistType,
        birthYear:  topBirth.year,  birthMonth: topBirth.month,  birthDay:  topBirth.day,
        deathYear:  topDeath.year,  deathMonth: topDeath.month,  deathDay:  topDeath.day,
        members: [],
      };
    }

    // Step 2 — For groups, fetch member relations (one more call).
    // The artist-rels include each member's own life-span so no per-member calls needed.
    const groupData = await mbFetch(
      `${MB_API}/artist/${best.id}?inc=artist-rels&fmt=json`
    ) as { relations?: MbRelation[] };

    const members: MemberDates[] = [];
    for (const rel of groupData?.relations || []) {
      // "member of band" with direction "backward" = this person is a member of the group.
      if (rel.type !== "member of band" || rel.direction !== "backward") continue;
      if (!rel.artist) continue;
      // Skip nested sub-groups (e.g. a supergroup as a member).
      if ((rel.artist.type || "").toLowerCase() !== "person") continue;

      const birth = parseMbDate(rel.artist["life-span"]?.begin);
      const death = parseMbDate(rel.artist["life-span"]?.end);
      members.push({
        name:       rel.artist.name || "",
        birthYear:  birth.year,  birthMonth: birth.month,  birthDay:  birth.day,
        deathYear:  death.year,  deathMonth: death.month,  deathDay:  death.day,
      });
    }

    return {
      artistType: "group",
      // Store formation/dissolution on top-level fields for completeness.
      birthYear:  topBirth.year,  birthMonth: topBirth.month,  birthDay:  topBirth.day,
      deathYear:  topDeath.year,  deathMonth: topDeath.month,  deathDay:  topDeath.day,
      members,
    };
  } catch {
    return EMPTY;
  }
}
