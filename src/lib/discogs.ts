import crypto from "crypto";

export const DISCOGS_API = "https://api.discogs.com";
export const USER_AGENT = "CrateMate/1.0";

function normalizeParams(params: Array<[string, string]>) {
  const enc = (s: string) => encodeURIComponent(s);
  const sorted = params
    .map(([k, v]) => [enc(k), enc(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return sorted.map(([k, v]) => `${k}=${v}`).join("&");
}

function baseUrl(url: string) {
  const u = new URL(url);
  // Signature base string uses scheme/host/path without query or fragment.
  u.search = "";
  u.hash = "";
  return u.toString();
}

function sign(
  method: string,
  url: string,
  params: Array<[string, string]>,
  consumerSecret: string,
  tokenSecret = ""
) {
  const normalized = normalizeParams(params);
  const base = [method.toUpperCase(), encodeURIComponent(baseUrl(url)), encodeURIComponent(normalized)].join("&");
  const key = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac("sha1", key).update(base).digest("base64");
}

function buildAuthHeader(
  method: string,
  url: string,
  extra: Record<string, string>,
  consumerKey: string, consumerSecret: string,
  tokenKey = "",
  tokenSecret = ""
) {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extra,
  };
  if (tokenKey) oauthParams.oauth_token = tokenKey;

  // OAuth signature must include both OAuth params and URL query params.
  const u = new URL(url);
  const queryParams: Array<[string, string]> = [];
  for (const [k, v] of u.searchParams.entries()) queryParams.push([k, v]);

  const signingParams: Array<[string, string]> = [
    ...Object.entries(oauthParams),
    ...queryParams,
  ];
  const signature = sign(method, url, signingParams, consumerSecret, tokenSecret);

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const header = Object.keys(headerParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(headerParams[k])}"`)
    .join(", ");
  return `OAuth ${header}`;
}

export async function discogsRequest(
  method: string,
  url: string,
  opts: { oauthCallback?: string; tokenKey?: string; tokenSecret?: string; oauthVerifier?: string } = {}
) {
  const key = process.env.DISCOGS_CONSUMER_KEY!;
  const secret = process.env.DISCOGS_CONSUMER_SECRET!;
  const extra: Record<string, string> = {};
  if (opts.oauthCallback) extra.oauth_callback = opts.oauthCallback;
  if (opts.oauthVerifier) extra.oauth_verifier = opts.oauthVerifier;
  const auth = buildAuthHeader(method, url, extra, key, secret, opts.tokenKey || "", opts.tokenSecret || "");
  return fetch(url, {
    method,
    headers: { Authorization: auth, "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
  });
}

// Maps a collection release to our DB schema
export function mapCollectionRelease(release: Record<string, unknown>, mediaFieldId = 1, sleeveFieldId = 2) {
  const info = (release.basic_information || {}) as Record<string, unknown>;
  const artists = (info.artists as Array<{ name: string; join?: string }>) || [];
  const labels = (info.labels as Array<{ name: string }>) || [];
  const formats = (info.formats as Array<{ name: string; qty?: string; descriptions?: string[] }>) || [];
  const styles = (info.styles as string[]) || [];
  const genres = (info.genres as string[]) || [];

  const fmt = formats[0];
  const qty = parseInt(fmt?.qty || "1");
  const fmtStr = fmt
    ? [qty > 1 ? `${fmt.qty}x${fmt.name}` : fmt.name, ...(fmt.descriptions || [])].join(", ")
    : "";

  const artistStr = artists
    .map((a, i) => a.name + (i < artists.length - 1 ? (a.join || ", ") : ""))
    .join("");

  const descLower = (fmt?.descriptions || []).join(" ").toLowerCase();
  const cover = (info.cover_image as string) || (info.thumb as string) || "";

  // Condition is stored in top-level notes array (not inside basic_information)
  // field_id 1 = Media condition, field_id 2 = Sleeve/cover condition
  const notes = Array.isArray(release.notes)
    ? (release.notes as Array<{ field_id: number; value: string }>)
    : [];
  const mediaCondition = notes.find((n) => Number(n.field_id) === mediaFieldId)?.value || "";
  const sleeveCondition = notes.find((n) => Number(n.field_id) === sleeveFieldId)?.value || "";
  const condition = sleeveCondition ? `${mediaCondition} / ${sleeveCondition}` : mediaCondition;

  return {
    artist: artistStr || "Unknown",
    title: (info.title as string) || "",
    label: labels[0]?.name || "",
    year_pressed: (info.year as number) || null,
    // Prefer to set original year via metadata enrichment (master release).
    year_original: null,
    genre: (styles.length > 0 ? styles.slice(0, 3) : genres.slice(0, 2)).join(", "),
    genres: genres.slice(0, 3).join(", "),
    styles: styles.slice(0, 5).join(", "),
    condition,
    for_sale: false,
    format: fmtStr,
    is_compilation: descLower.includes("comp"),
    discogs_id: (info.id as number) || null,
    discogs_instance_id: (release.id as number) || null,
    thumb: cover,
  };
}

// Maps a search result to our DB schema
export function mapSearchResult(result: Record<string, unknown>) {
  const rawTitle = (result.title as string) || "";
  const dash = rawTitle.indexOf(" - ");
  const artist = dash > -1 ? rawTitle.slice(0, dash) : "Unknown";
  const title = dash > -1 ? rawTitle.slice(dash + 3) : rawTitle;

  const labels = (result.label as string[]) || [];
  const formats = (result.format as string[]) || [];
  const styles = (result.style as string[]) || [];
  const genres = (result.genre as string[]) || [];
  const year = parseInt(result.year as string) || null;

  return {
    artist,
    title,
    label: labels[0] || "",
    year_pressed: year,
    year_original: year,
    genre: (styles.length > 0 ? styles.slice(0, 3) : genres.slice(0, 2)).join(", "),
    genres: genres.slice(0, 3).join(", "),
    styles: styles.slice(0, 5).join(", "),
    condition: "",
    for_sale: false,
    format: formats.join(", "),
    is_compilation: formats.join(" ").toLowerCase().includes("comp"),
    discogs_id: result.id as number,
    thumb: (result.thumb as string) || "",
  };
}
