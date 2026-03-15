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
    year:  year  && year  > 0             ? year  : null,
    month: month && month >= 1 && month <= 12 ? month : null,
    day:   day   && day   >= 1 && day   <= 31 ? day   : null,
  };
}

export type ArtistDates = {
  birthYear:  number | null;
  birthMonth: number | null;
  birthDay:   number | null;
  deathYear:  number | null;
  deathMonth: number | null;
  deathDay:   number | null;
};

const EMPTY: ArtistDates = {
  birthYear: null, birthMonth: null, birthDay: null,
  deathYear: null, deathMonth: null, deathDay: null,
};

export async function fetchArtistDates(artistName: string): Promise<ArtistDates> {
  await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
  try {
    const url = `${MB_API}/artist?query=artist:${encodeURIComponent(artistName)}&fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": MB_USER_AGENT } });
    if (!res.ok) return EMPTY;
    const data = await res.json();
    const artist = Array.isArray(data?.artists) ? data.artists[0] : null;
    if (!artist) return EMPTY;

    const lifeSpan = artist["life-span"] || {};
    const birth = parseMbDate(lifeSpan.begin);
    const death = parseMbDate(lifeSpan.end);

    return {
      birthYear:  birth.year,
      birthMonth: birth.month,
      birthDay:   birth.day,
      deathYear:  death.year,
      deathMonth: death.month,
      deathDay:   death.day,
    };
  } catch {
    return EMPTY;
  }
}
