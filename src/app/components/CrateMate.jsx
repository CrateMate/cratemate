"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useTheme } from "./ThemeProvider";
import StoryPreviewModal from "./StoryPreviewModal";

function HintBanner({ children, onDismiss }) {
  return (
    <div className="mx-4 mt-3 mb-1 px-4 py-3 rounded-xl bg-amber-950/40 border border-amber-800/25 flex items-start gap-3">
      <span className="text-amber-500 text-base mt-0.5 shrink-0">💡</span>
      <div className="text-stone-300 text-xs leading-relaxed flex-1">{children}</div>
      <button onClick={onDismiss} className="text-stone-600 hover:text-stone-400 text-sm ml-1 shrink-0 leading-none">×</button>
    </div>
  );
}

function mapSearchResult(r) {
  const dash = (r.title || "").indexOf(" - ");
  const artist = dash > -1 ? r.title.slice(0, dash) : "Unknown";
  const title = dash > -1 ? r.title.slice(dash + 3) : r.title;
  const year = parseInt(r.year) || null;
  const styles = r.style || [];
  const genres = r.genre || [];
  return {
    artist,
    title,
    label: r.label?.[0] || "",
    year_pressed: year,
    year_original: year,
    genre: (styles.length > 0 ? styles.slice(0, 3) : genres.slice(0, 2)).join(", "),
    genres: genres.slice(0, 3).join(", "),
    styles: styles.slice(0, 5).join(", "),
    condition: "",
    for_sale: false,
    format: (r.format || []).join(", "),
    is_compilation: (r.format || []).join(" ").toLowerCase().includes("comp"),
    discogs_id: r.id,
    thumb: r.thumb || "",
  };
}

function AddRecordModal({ onClose, onAdd }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const [searchError, setSearchError] = useState("");
  const debounce = useRef(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setSearchError("");
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/discogs/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) { setSearchError("Search failed — try again."); setResults([]); return; }
        const data = await res.json();
        if (!Array.isArray(data)) { setSearchError("Unexpected response from search."); setResults([]); return; }
        setResults(data);
        if (data.length === 0) setSearchError("");
      } catch {
        setSearchError("Couldn't reach Discogs — check your connection.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  }, [q]);

  async function handleAdd(result) {
    setAdding(result.id);
    const mapped = mapSearchResult(result);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapped),
      });
      const [added] = await res.json();
      onAdd(added);
      onClose();
    } catch {
      setAdding(null);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-stone-950 border border-stone-800/80 rounded-t-3xl w-full max-w-md p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}
            className="text-amber-50"
          >
            Add a Record
          </h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-400 text-xl">
            ×
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Discogs — artist, title..."
          className="w-full bg-stone-900/70 border border-stone-800/80 rounded-xl px-4 py-2.5 text-sm text-amber-50 placeholder-stone-700 focus:outline-none focus:border-amber-900/60 mb-3"
        />
        {loading && <div className="text-stone-600 text-sm text-center py-4">Searching...</div>}
        {searchError && <div className="text-red-400/80 text-xs text-center py-2">{searchError}</div>}
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleAdd(r)}
              disabled={adding === r.id}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] transition-all"
            >
              {r.thumb ? (
                <img
                  src={proxyArtUrl(upgradeDiscogsThumb(r.thumb) || r.thumb)}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0 opacity-80"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-stone-800 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-amber-50 text-sm truncate">{r.title}</div>
                <div className="text-stone-500 text-xs">
                  {r.year} · {(r.format || []).slice(0, 2).join(", ")}
                </div>
              </div>
              {adding === r.id ? (
                <span className="text-stone-600 text-xs">Adding...</span>
              ) : (
                <span className="text-stone-700 text-lg">+</span>
              )}
            </button>
          ))}
          {!loading && q && results.length === 0 && (
            <div className="text-stone-700 text-sm text-center py-6">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
}

const GENRE_PALETTE = {
  // Cool / acoustic
  "jazz":             { tw: "bg-sky-900/40 text-sky-300 border-sky-800/40",            hex: "#38bdf8" },
  "blues":            { tw: "bg-blue-900/40 text-blue-300 border-blue-800/40",         hex: "#60a5fa" },
  "classical":        { tw: "bg-slate-800/40 text-slate-300 border-slate-700/40",      hex: "#94a3b8" },
  "ambient":          { tw: "bg-cyan-900/40 text-cyan-300 border-cyan-800/40",         hex: "#22d3ee" },
  "folk":             { tw: "bg-lime-900/40 text-lime-300 border-lime-800/40",         hex: "#a3e635" },
  "country":          { tw: "bg-yellow-900/40 text-yellow-300 border-yellow-800/40",   hex: "#fbbf24" },
  "reggae":           { tw: "bg-green-900/40 text-green-300 border-green-800/40",      hex: "#4ade80" },
  // Electronic / dance
  "electronic":       { tw: "bg-violet-900/40 text-violet-300 border-violet-800/40",   hex: "#a78bfa" },
  "house":            { tw: "bg-purple-900/40 text-purple-300 border-purple-800/40",   hex: "#c084fc" },
  "techno":           { tw: "bg-indigo-900/40 text-indigo-300 border-indigo-800/40",   hex: "#818cf8" },
  "dance":            { tw: "bg-violet-900/40 text-violet-300 border-violet-800/40",   hex: "#8b5cf6" },
  "disco":            { tw: "bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800/40",hex: "#e879f9" },
  // Rock
  "rock":             { tw: "bg-red-900/40 text-red-300 border-red-800/40",            hex: "#f87171" },
  "alternative rock": { tw: "bg-orange-900/40 text-orange-300 border-orange-800/40",  hex: "#fb923c" },
  "indie rock":       { tw: "bg-amber-900/40 text-amber-300 border-amber-800/40",     hex: "#fbbf24" },
  "metal":            { tw: "bg-red-900/40 text-red-300 border-red-800/40",            hex: "#ef4444" },
  "punk":             { tw: "bg-rose-900/40 text-rose-300 border-rose-800/40",        hex: "#fb7185" },
  // Soul / urban
  "pop":              { tw: "bg-pink-900/40 text-pink-300 border-pink-800/40",        hex: "#f472b6" },
  "hip hop":          { tw: "bg-yellow-900/40 text-yellow-300 border-yellow-800/40",  hex: "#facc15" },
  "r&b":              { tw: "bg-rose-900/40 text-rose-300 border-rose-800/40",        hex: "#fb7185" },
  "soul":             { tw: "bg-amber-900/40 text-amber-300 border-amber-800/40",     hex: "#f59e0b" },
  "funk":             { tw: "bg-orange-900/40 text-orange-300 border-orange-800/40",  hex: "#f97316" },
  "latin":            { tw: "bg-orange-900/40 text-orange-300 border-orange-800/40",  hex: "#ea580c" },
};

const STORY_GENRE_GRADIENTS = {
  "jazz": ["#0f4c75","#1b6ca8"], "blues": ["#1a237e","#283593"],
  "soul": ["#bf360c","#e64a19"], "funk": ["#e65100","#ff6f00"],
  "rock": ["#b71c1c","#c62828"], "electronic": ["#4a148c","#6a1b9a"],
  "hip hop": ["#212121","#f9a825"], "pop": ["#880e4f","#ad1457"],
  "classical": ["#1a237e","#37474f"], "_default": ["#1b1b2f","#162447"],
};

function getStoryGradient(genre) {
  const key = (genre || "").toLowerCase().trim();
  if (STORY_GENRE_GRADIENTS[key]) return STORY_GENRE_GRADIENTS[key];
  for (const [k, v] of Object.entries(STORY_GENRE_GRADIENTS)) {
    if (k !== "_default" && key.includes(k)) return v;
  }
  return STORY_GENRE_GRADIENTS["_default"];
}

function extractDominantColor(img) {
  try {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  } catch { return [30, 25, 20]; }
}

const GENRE_FALLBACK = [
  { tw: "bg-teal-900/40 text-teal-300 border-teal-800/40",          hex: "#2dd4bf" },
  { tw: "bg-emerald-900/40 text-emerald-300 border-emerald-800/40", hex: "#34d399" },
  { tw: "bg-cyan-900/40 text-cyan-300 border-cyan-800/40",          hex: "#22d3ee" },
  { tw: "bg-sky-900/40 text-sky-300 border-sky-800/40",             hex: "#38bdf8" },
  { tw: "bg-violet-900/40 text-violet-300 border-violet-800/40",    hex: "#a78bfa" },
  { tw: "bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800/40", hex: "#e879f9" },
  { tw: "bg-rose-900/40 text-rose-300 border-rose-800/40",          hex: "#fb7185" },
  { tw: "bg-amber-900/40 text-amber-300 border-amber-800/40",       hex: "#fbbf24" },
];

function getGenrePalette(genre) {
  const key = (genre || "").toLowerCase().trim();
  if (GENRE_PALETTE[key]) return GENRE_PALETTE[key];
  for (const [k, v] of Object.entries(GENRE_PALETTE)) {
    if (key.includes(k)) return v;
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return GENRE_FALLBACK[hash % GENRE_FALLBACK.length];
}

function genreColor(genre) { return getGenrePalette(genre).tw; }

function genreSvgColor(genre) {
  const { hex } = getGenrePalette(genre);
  return { fill: hex + "2e", stroke: hex, text: hex };
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

const DISC_GRADIENT_PAIRS = [
  ["#1f0a0a", "#3a0d0d"],
  ["#0a0a1f", "#0d0d3a"],
  ["#0a1f0a", "#0d3a0d"],
  ["#1f1a0a", "#3a300d"],
  ["#0a1a1f", "#0d2a3a"],
  ["#1a0a1f", "#2a0d3a"],
  ["#1f0f0a", "#3a1a0d"],
  ["#0f0a1f", "#1a0d3a"],
];

function discGrad(id) {
  const n =
    typeof id === "number"
      ? id
      : String(id)
          .split("")
          .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return DISC_GRADIENT_PAIRS[n % DISC_GRADIENT_PAIRS.length];
}

export function VinylDisc({ record, size = 64 }) {
  const [c1, c2] = discGrad(record.id);
  const labelSize = size * 0.3;
  const year = record.year_original || record.year_pressed || 1975;
  const labelColor = record.genre?.includes("Jazz")
    ? "#152840"
    : record.genre?.includes("Blues")
      ? "#121240"
      : record.genre?.includes("Funk")
        ? "#2a0a2a"
        : record.genre?.includes("Latin")
          ? "#2a0808"
          : record.genre?.includes("Electronic")
            ? "#081a24"
            : record.genre?.includes("Punk")
              ? "#0a1a0a"
              : year < 1965
                ? "#241a08"
                : year < 1975
                  ? "#2a1008"
                  : year < 1985
                    ? "#08141a"
                    : "#14081a";

  return (
    <div
      className="rounded-full flex-shrink-0 relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 38% 38%, ${c1}, ${c2})`,
        boxShadow: "0 3px 16px rgba(0,0,0,0.65)",
      }}
    >
      {[0.88, 0.7, 0.52, 0.36].map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-white/[0.035]"
          style={{ width: `${s * 100}%`, height: `${s * 100}%` }}
        />
      ))}
      <div
        className="rounded-full z-10 flex items-center justify-center"
        style={{
          width: labelSize,
          height: labelSize,
          background: labelColor,
          boxShadow: "inset 0 0 4px rgba(255,255,255,0.04)",
        }}
      >
        {[0.78, 0.54, 0.3].map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/[0.06]"
            style={{ width: `${labelSize * s}px`, height: `${labelSize * s}px` }}
          />
        ))}
        <div className="rounded-full bg-black/50" style={{ width: labelSize * 0.18, height: labelSize * 0.18 }} />
      </div>
    </div>
  );
}

function upgradeDiscogsThumb(url) {
  if (!url) return "";
  const str = String(url);
  // Old Discogs CDN: strip -150 suffix to get full-res.
  if (/-150\.(jpe?g|png|webp)(\?.*)?$/i.test(str))
    return str.replace(/-150\.(jpe?g|png|webp)(\?.*)?$/i, (_m, ext, query) => `.${ext}${query || ""}`);
  // New Discogs imgproxy CDN: HMAC-signed — can't modify without breaking the signature.
  // The background cover upgrade pass fetches full-res URLs from the Discogs API instead.
  // iTunes: upgrade to 1000px for the detail hero.
  if (/mzstatic\.com/i.test(str))
    return str.replace(/\d+x\d+bb(\.(jpe?g|png|webp))?$/i, "1000x1000bb.jpg");
  return str;
}

/** Route Discogs image URLs through our proxy to avoid CORS/hotlink issues.
 *  iTunes and user-uploaded URLs are returned as-is (they don't need proxying). */
function proxyArtUrl(url) {
  if (!url) return url;
  try {
    const h = new URL(url).hostname;
    if (h === "i.discogs.com" || h === "img.discogs.com") {
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

// New Discogs imgproxy CDN thumbnails are HMAC-signed — can't upgrade the URL itself.
// Detect them so we can show them immediately but also queue iTunes to swap in something better.
function isLowQualityImgproxy(url) {
  if (!url) return false;
  return /i\.discogs\.com/i.test(url) && (/\/h:150\//i.test(url) || /\/w:150\//i.test(url) || /\/q:40\//i.test(url));
}

function isUserPhoto(url) {
  if (!url) return false;
  const s = url.toLowerCase();
  return s.includes("/userimages/") || s.includes("/user-image/") || s.includes("/-150.");
}

async function fetchITunesArt(artist, title) {
  if (!artist && !title) return "";
  const term = [artist, title].filter(Boolean).join(" ");
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=8`
    );
    if (!res.ok) return "";
    const data = await res.json();
    const results = data?.results || [];
    const normalize = (s) => (s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^\w\s]/g, "").trim();
    const ra = normalize(artist);
    const rt = normalize(title);
    if (!ra || !rt) return "";
    let best = null, bestScore = 0;
    for (const r of results) {
      const a = normalize(r.artistName);
      const t = normalize(r.collectionName);
      let score = 0;
      // Artist: require one to fully contain the other AND share >60% length
      if (a && ra && (a.includes(ra) || ra.includes(a))) {
        const ratio = Math.min(a.length, ra.length) / Math.max(a.length, ra.length);
        if (ratio > 0.6) score += 2;
        else score += 1;
      }
      // Title: same — full containment + length ratio check
      if (t && rt && (t.includes(rt) || rt.includes(t))) {
        const ratio = Math.min(t.length, rt.length) / Math.max(t.length, rt.length);
        if (ratio > 0.6) score += 2;
        else score += 1;
      }
      if (score > bestScore) { bestScore = score; best = r; }
    }
    if (!best || bestScore < 4) return ""; // require strong match on both artist AND title
    return (best.artworkUrl100 || "").replace(/\d+x\d+bb(\.(jpe?g|png|webp))?$/i, "1000x1000bb.jpg");
  } catch {
    return "";
  }
}

// --- Module-level iTunes art queue (deduped, max 4 concurrent) ---
const _artCache = new Map(); // record.id → url string or ""
const _artQ = []; // { record, cbs: [fn] }
let _artActive = 0;

function _flushArtQ() {
  while (_artActive < 4 && _artQ.length > 0) {
    const item = _artQ.shift();
    _artActive++;
    fetchITunesArt(item.record.artist, item.record.title)
      .then((url) => { _artCache.set(item.record.id, url || ""); item.cbs.forEach((cb) => cb(url || "")); })
      .catch(() => { _artCache.set(item.record.id, ""); item.cbs.forEach((cb) => cb("")); })
      .finally(() => { _artActive--; _flushArtQ(); });
  }
}

function _enqueueArt(record, cb) {
  if (_artCache.has(record.id)) { cb(_artCache.get(record.id)); return () => {}; }
  const existing = _artQ.find((q) => q.record.id === record.id);
  if (existing) { existing.cbs.push(cb); return () => { const i = existing.cbs.indexOf(cb); if (i > -1) existing.cbs.splice(i, 1); }; }
  const item = { record, cbs: [cb] };
  _artQ.push(item);
  _flushArtQ();
  return () => { const i = item.cbs.indexOf(cb); if (i > -1) item.cbs.splice(i, 1); };
}

export function CoverArt({ record, size = 64 }) {
  const raw = record.thumb || "";
  const isUpload = isUserPhoto(raw);
  // For real Discogs images, apply any free URL upgrades (strip -150, upgrade iTunes resolution)
  const upgraded = isUpload ? "" : upgradeDiscogsThumb(raw);
  // The original thumb (before upgrade) is a reliable fallback — it may be low-res but it's the correct cover
  const hasOriginalThumb = !isUpload && !!raw && raw !== upgraded;
  // Only use iTunes for confirmed bad images (user photos) or truly missing covers.
  const needsITunes = isUpload || !upgraded;

  const [fallback, setFallback] = useState(() => _artCache.get(record.id) || null);
  const [imgError, setImgError] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    // Enqueue iTunes art if: no Discogs URL, user photo, or both upgraded + original thumb failed
    if (!needsITunes && !imgError) return;
    if (imgError && hasOriginalThumb && !thumbError) return; // still trying original thumb
    return _enqueueArt(record, (url) => {
      if (url) { setFallback(url); setImgError(false); setThumbError(false); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, imgError, thumbError]);

  // Priority: iTunes fallback > upgraded Discogs > original thumb > null
  let src = fallback;
  if (!src && !imgError) src = upgraded;
  if (!src && imgError && hasOriginalThumb && !thumbError) src = raw;

  if (src) {
    return (
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden border border-white/[0.08]"
        style={{ width: size, height: size, boxShadow: "0 3px 16px rgba(0,0,0,0.55)" }}
      >
        <img
          src={proxyArtUrl(src) || src}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover opacity-90"
          onError={() => {
            if (!imgError) setImgError(true);
            else if (!thumbError) setThumbError(true);
          }}
        />
      </div>
    );
  }
  return <VinylDisc record={record} size={size} />;
}

// Discogs genres that contain commas — must be protected before splitting on ","
const COMPOUND_GENRES = ["Folk, World, & Country"];

function getGenres(record) {
  let source = record.genres || record.genre || "";
  const saved = {};
  COMPOUND_GENRES.forEach((g, i) => {
    const ph = `__CG${i}__`;
    if (source.includes(g)) { saved[ph] = g; source = source.replace(g, ph); }
  });
  return source.split(",").map((g) => {
    const t = g.trim();
    return saved[t] || t;
  }).filter(Boolean);
}

function getStyles(record) {
  return (record.styles || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function getDecade(record) {
  const y = record.year_original || record.year_pressed;
  if (!y) return null;
  return `${Math.floor(y / 10) * 10}s`;
}

function getFormat(record) {
  const fmt = (record.format || "").toLowerCase();
  if (fmt.includes("ep")) return "EP";
  if (fmt.includes("single") || /7["\-]/.test(fmt)) return "Single";
  if (fmt.includes("lp") || fmt.includes("12\"") || fmt.includes("album") || fmt.includes("vinyl") || fmt.includes("33")) return "LP";
  if (!fmt) return null;
  return "Other";
}

function getCanonicalKey(record) {
  if (record.master_id) return `master:${record.master_id}`;
  const title  = (record.title  || "").toLowerCase().trim().replace(/\s+/g, " ");
  const artist = (record.artist || "").toLowerCase().trim().replace(/\s+/g, " ");
  return `release:${title}||${artist}`;
}

function dedupeByAlbum(records, playCounts) {
  const seen = new Map();
  for (const r of records) {
    const key = getCanonicalKey(r);
    if (!seen.has(key)) {
      seen.set(key, r);
    } else {
      // Keep the pressing with more plays as the representative
      if ((playCounts[r.id] || 0) > (playCounts[seen.get(key).id] || 0)) {
        seen.set(key, r);
      }
    }
  }
  return [...seen.values()];
}

function normFav(f) {
  return typeof f === "object" && f !== null ? f : { key: f, title: f };
}

function buildCollectionStats(records) {
  const decades = {}, genres = {}, formats = {}, styles = {};
  for (const r of records) {
    const d = getDecade(r);
    if (d) decades[d] = (decades[d] || 0) + 1;
    getGenres(r).forEach((g) => { genres[g] = (genres[g] || 0) + 1; });
    getStyles(r).forEach((s) => { styles[s] = (styles[s] || 0) + 1; });
    const f = getFormat(r);
    if (f) formats[f] = (formats[f] || 0) + 1;
  }
  return { decades, genres, formats, styles };
}

function buildTimeStats(sessions, records) {
  const byHour = Array(24).fill(0);
  const byDow = Array(7).fill(0);
  const midnightCounts = {}, sunMorningCounts = {};
  for (const s of sessions) {
    const d = new Date(s.played_at);
    const h = d.getHours();
    const dow = d.getDay();
    byHour[h]++;
    byDow[dow]++;
    if (h >= 0 && h < 4) midnightCounts[s.record_id] = (midnightCounts[s.record_id] || 0) + 1;
    if (dow === 0 && h >= 8 && h < 12) sunMorningCounts[s.record_id] = (sunMorningCounts[s.record_id] || 0) + 1;
  }
  const nightPlays = [18,19,20,21,22,23,0,1,2,3].reduce((a,h) => a + byHour[h], 0);
  const dayPlays = [6,7,8,9,10,11,12,13,14,15,16,17].reduce((a,h) => a + byHour[h], 0);
  const weekendPlays = byDow[0] + byDow[6];
  const midId = Object.entries(midnightCounts).sort((a,b) => b[1]-a[1])[0]?.[0];
  const sunId = Object.entries(sunMorningCounts).sort((a,b) => b[1]-a[1])[0]?.[0];
  return {
    byHour, byDow, nightPlays, dayPlays, weekendPlays,
    weekdayPlays: byDow.slice(1,6).reduce((a,b)=>a+b,0),
    midnightRecord: midId ? records?.find((r) => String(r.id) === midId) : null,
    sunMorningRecord: sunId ? records?.find((r) => String(r.id) === sunId) : null,
  };
}

function computeStreak(sessions) {
  if (!sessions.length) return 0;
  const days = new Set(sessions.map(s => new Date(s.played_at).toLocaleDateString()));
  const today = new Date().toLocaleDateString();
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
  if (!days.has(today) && !days.has(yesterday)) return 0;
  let streak = 0;
  let d = days.has(today) ? new Date() : new Date(Date.now() - 86400000);
  while (days.has(d.toLocaleDateString())) {
    streak++;
    d = new Date(d.getTime() - 86400000);
  }
  return streak;
}

function computeLongestStreak(sessions) {
  if (!sessions.length) return 0;
  const DAY = 86400000;
  const daySet = new Set(sessions.map(s => {
    const d = new Date(s.played_at);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }));
  const days = [...daySet].sort((a, b) => a - b);
  let longest = 1, current = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] === DAY) { current++; if (current > longest) longest = current; }
    else current = 1;
  }
  return longest;
}

function streakBadge(streak) {
  if (streak >= 30) return "True obsessive";
  if (streak >= 14) return "Dedicated listener";
  if (streak >= 7) return "Week warrior";
  if (streak >= 3) return "On a roll";
  return null;
}

function GenreTag({ genre, onClick, active }) {
  const cls = genreColor(genre || "");
  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(genre);
            }
          : undefined
      }
      className={`text-xs px-2 py-1 rounded-full border ${cls} whitespace-nowrap ${
        onClick ? "cursor-pointer" : ""
      } ${active ? "ring-1 ring-white/40" : ""}`}
    >
      {genre}
    </span>
  );
}

function stripArtistNum(s) {
  return (s || "").replace(/\s*\(\d+\)\s*$/, "").trim();
}

function condenseCondition(c) {
  const condense = (s) => (s || "")
    .replace("Near Mint (NM or M-)", "NM")
    .replace("Very Good Plus (VG+)", "VG+")
    .replace("Very Good (VG)", "VG")
    .replace("Mint (M)", "M")
    .replace("Good Plus (G+)", "G+")
    .replace("Good (G)", "G")
    .trim();
  return (c || "").split(" / ").map(condense).filter(Boolean).join(" / ") || null;
}

function ArtistTag({ artist, discogsId, clickable = false }) {
  const cls = "bg-stone-800/60 text-stone-300 border-stone-700/50";
  const name = stripArtistNum(artist);
  if (clickable && discogsId) {
    return (
      <a
        href={`/artist/${discogsId}`}
        onClick={(e) => e.stopPropagation()}
        className={`text-xs px-1.5 py-0.5 rounded-full border ${cls} whitespace-nowrap hover:text-amber-300 hover:border-amber-800/50 transition-colors`}
      >
        {name}
      </a>
    );
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${cls} whitespace-nowrap`}>
      {name}
    </span>
  );
}

// Feature 1: Wantlist components
function countryToFlag(country) {
  const map = {
    "United States": "US", "Germany": "DE", "United Kingdom": "GB", "France": "FR",
    "Japan": "JP", "Italy": "IT", "Netherlands": "NL", "Belgium": "BE",
    "Canada": "CA", "Australia": "AU", "Sweden": "SE", "Spain": "ES",
    "Brazil": "BR", "Argentina": "AR", "Mexico": "MX", "Poland": "PL",
    "Czech Republic": "CZ", "Russia": "RU", "Greece": "GR", "Austria": "AT",
    "Switzerland": "CH", "Denmark": "DK", "Norway": "NO", "Finland": "FI",
    "Portugal": "PT", "Hungary": "HU", "Romania": "RO", "South Korea": "KR",
    "New Zealand": "NZ", "Turkey": "TR", "Ireland": "IE", "Ukraine": "UA",
    "Croatia": "HR", "Slovakia": "SK", "Serbia": "RS", "Lithuania": "LT",
    "Latvia": "LV", "Estonia": "EE", "Iceland": "IS", "Taiwan": "TW",
    "Hong Kong": "HK", "Singapore": "SG", "India": "IN", "Thailand": "TH",
    "Chile": "CL", "Colombia": "CO", "Malaysia": "MY",
  };
  const code = map[country];
  if (!code) return null;
  return [...code].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

function DealBadge({ dealPct }) {
  if (!dealPct || dealPct < 20) return null;
  const great = dealPct >= 30;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${great ? "bg-emerald-900/30 border-emerald-700/40 text-emerald-400" : "bg-amber-900/20 border-amber-700/30 text-amber-400"}`}>
      {great ? "Great deal" : "Good deal"} · {dealPct}% below market
    </span>
  );
}

function WantReleaseRow({ release, onPriceLoaded }) {
  const [price, setPrice] = useState(null);
  const marketplaceUrl = `https://www.discogs.com/sell/release/${release.release_id}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/discogs/wantlist/price/${release.release_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.min_price != null) {
          setPrice(data);
          onPriceLoaded?.(release.release_id, data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [release.release_id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <a
      href={marketplaceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2 bg-stone-900/40 rounded-xl border border-stone-800/40 hover:border-amber-900/40 hover:bg-stone-900/70 transition-colors cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-stone-800">
        {release.thumb ? (
          <img src={proxyArtUrl(upgradeDiscogsThumb(release.thumb) || release.thumb)} alt="" className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-700 text-xs">◇</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-stone-400 truncate">
          {[release.year_pressed, release.label, release.format, release.notes].filter(Boolean).join(" · ")}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-stone-600">↗ Discogs Marketplace</span>
          {price && (
            <span className="text-[10px] text-emerald-700">from ${price.lowest_listing != null ? price.lowest_listing.toFixed(2) : price.min_price.toFixed(2)} VG+{price.ships_from ? ` ${countryToFlag(price.ships_from) || price.ships_from}` : ''}</span>
          )}
          {price && <DealBadge dealPct={price.deal_pct} />}
        </div>
      </div>
    </a>
  );
}

function WantGroupRow({ group, expanded, onToggle, pushEnabled, threshold, onSaveThreshold, onRemoveThreshold }) {
  const rep = group.representative;
  const genres = (rep?.genres || "").split(",").map((g) => g.trim()).filter(Boolean);
  const marketplaceUrl = group.master_id
    ? `https://www.discogs.com/sell/list?master_id=${group.master_id}&ev=mb`
    : `https://www.discogs.com/sell/release/${rep?.release_id}`;
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);
  const [loadedPrices, setLoadedPrices] = useState({});

  // Bell-slider state
  const trackRef = useRef(null);
  const isDragging = useRef(false);
  const activePct = threshold?.threshold_deal_pct ?? 0;
  const [dragPct, setDragPct] = useState(activePct);
  const [dragging, setDragging] = useState(false);

  // Sync dragPct when threshold changes externally
  useEffect(() => { if (!dragging) setDragPct(threshold?.threshold_deal_pct ?? 0); }, [threshold, dragging]);

  const minPrice = Object.values(loadedPrices).reduce((best, p) => {
    if (!best || p.min_price < best.min_price) return p;
    return best;
  }, null);

  // Best deal across all loaded prices
  const bestDeal = Object.values(loadedPrices).reduce((best, p) => {
    if (!p.deal_pct) return best;
    if (!best || p.deal_pct > best.deal_pct) return p;
    return best;
  }, null);

  // Pre-fetch representative release price on mount so deal badge shows without expanding
  useEffect(() => {
    if (!rep?.release_id) return;
    fetch(`/api/discogs/wantlist/price/${rep.release_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.min_price != null) setLoadedPrices(prev => ({ ...prev, [rep.release_id]: data }));
      })
      .catch(() => {});
  }, [rep?.release_id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePointerDown() {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      window.open(marketplaceUrl, "_blank");
    }, 500);
  }
  function handlePointerUp() { clearTimeout(longPressTimer.current); }
  function handlePointerLeave() { clearTimeout(longPressTimer.current); }
  function handleClick() {
    if (didLongPress.current) return;
    onToggle();
  }

  return (
    <div className="border border-stone-800/50 rounded-2xl overflow-hidden mb-2">
      <div
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-stone-900/40 transition-colors cursor-pointer select-none"
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-800">
          {rep?.thumb ? (
            <img src={proxyArtUrl(upgradeDiscogsThumb(rep.thumb) || rep.thumb)} alt="" className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-700">◇</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-amber-50 truncate font-medium">{rep?.title || "Unknown"}</div>
          <div className="text-xs text-stone-500 truncate">{stripArtistNum(rep?.artist)}</div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {group.year_range && <span className="text-[10px] text-stone-600">{group.year_range}</span>}
            {genres.slice(0, 2).map((g) => (
              <span key={g} className={`text-[10px] px-1 py-0.5 rounded-full border ${genreColor(g)}`}>{g}</span>
            ))}
            {group.found && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800/40 text-emerald-400">
                Found ✓
              </span>
            )}
            {group.edition_count > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-800/50 border border-stone-700/40 text-stone-500">
                {group.edition_count} editions
              </span>
            )}
            {minPrice && (
              <span className="text-[10px] text-emerald-700">
                from ${minPrice.lowest_listing != null ? minPrice.lowest_listing.toFixed(2) : minPrice.min_price.toFixed(2)} VG+{minPrice.ships_from ? ` ${countryToFlag(minPrice.ships_from) || minPrice.ships_from}` : ''}
              </span>
            )}
            {bestDeal && <DealBadge dealPct={bestDeal.deal_pct} />}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0 px-1">
          <span className="text-stone-600 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Bell slider — only shown when push is enabled */}
      {pushEnabled && (
        <div
          className="px-3 pb-2 pt-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* % label floats above thumb while dragging */}
          <div ref={trackRef} className="relative h-7 flex items-center select-none" style={{ touchAction: "none" }}>
            {/* Track fill — only visible when active */}
            <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 rounded-full overflow-hidden" style={{ height: 2 }}>
              <div
                className="h-full rounded-full transition-colors"
                style={{
                  width: `${(dragPct / 50) * 100}%`,
                  background: dragPct > 0 ? "#f59e0b" : "transparent",
                }}
              />
            </div>
            {/* Track background — faint, always shown */}
            <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 rounded-full" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

            {/* Floating pct label */}
            {dragging && dragPct > 0 && (
              <div
                className="absolute -top-5 text-[10px] text-amber-300 font-medium pointer-events-none"
                style={{ left: `calc(${(dragPct / 50) * 100}% - 16px)` }}
              >
                ≥{dragPct}%
              </div>
            )}

            {/* Bell thumb */}
            <div
              className="absolute"
              style={{
                left: `calc(${(dragPct / 50) * 100}% - 12px)`,
                cursor: "ew-resize",
                fontSize: 18,
                lineHeight: 1,
                filter: dragPct > 0 ? "none" : "grayscale(1) opacity(0.4)",
                transition: dragging ? "none" : "left 0.15s ease, filter 0.2s",
                userSelect: "none",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                isDragging.current = true;
                setDragging(true);
              }}
              onPointerMove={(e) => {
                if (!isDragging.current) return;
                const track = trackRef.current;
                if (!track) return;
                const rect = track.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const snapped = Math.round((ratio * 50) / 5) * 5;
                setDragPct(snapped);
              }}
              onPointerUp={(e) => {
                if (!isDragging.current) return;
                isDragging.current = false;
                setDragging(false);
                if (dragPct < 5) {
                  onRemoveThreshold?.();
                  setDragPct(0);
                } else {
                  onSaveThreshold?.(dragPct);
                }
              }}
            >
              🔔
            </div>
          </div>
          {/* Hint text */}
          <div className="text-[10px] text-stone-700 mt-0.5">
            {dragPct > 0 ? `Alert when ≥${dragPct}% below market` : "Drag to set deal alert"}
          </div>
        </div>
      )}

      {expanded && group.releases.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-stone-800/40 pt-2">
          {group.releases.map((r) => (
            <WantReleaseRow
              key={r.release_id}
              release={r}
              onPriceLoaded={(releaseId, data) =>
                setLoadedPrices((prev) => ({ ...prev, [releaseId]: data }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

const WANTS_PAGE_SIZE = 25;

function WantlistTab({ wantlist, wantlistImportJob, expandedMasters, setExpandedMasters, onStartImport, onRemove, pushPermission, pushSubscribed, onSubscribePush, priceThresholds, onSaveThreshold, onRemoveThreshold, nowPlaying, onScroll, topSlot }) {
  const [wantsPage, setWantsPage] = useState(1);
  const [wantsInfiniteScroll, setWantsInfiniteScroll] = useState(true);
  const [wantsVisible, setWantsVisible] = useState(WANTS_PAGE_SIZE);
  const [wantsSearch, setWantsSearch] = useState("");
  const wantsSentinelRef = useRef(null);

  useEffect(() => {
    if (!wantsInfiniteScroll) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setWantsVisible(c => c + WANTS_PAGE_SIZE);
    }, { threshold: 0.1 });
    if (wantsSentinelRef.current) observer.observe(wantsSentinelRef.current);
    return () => observer.disconnect();
  }, [wantsInfiniteScroll, wantsVisible]);

  const isImporting = wantlistImportJob?.status === "pending" || wantlistImportJob?.status === "running";
  const progress = isImporting && wantlistImportJob?.total > 0
    ? Math.round((wantlistImportJob.imported / wantlistImportJob.total) * 100)
    : null;

  const allGroups = wantlist || [];
  const filteredGroups = wantsSearch.trim()
    ? allGroups.filter((g) => {
        const q = wantsSearch.toLowerCase();
        const rep = g.representative;
        return (
          (rep?.title || "").toLowerCase().includes(q) ||
          (rep?.artist || "").toLowerCase().includes(q) ||
          (rep?.genres || "").toLowerCase().includes(q) ||
          (rep?.label || "").toLowerCase().includes(q)
        );
      })
    : allGroups;
  const wantsTotalPages = Math.ceil(filteredGroups.length / WANTS_PAGE_SIZE);
  const visibleGroups = wantsInfiniteScroll
    ? filteredGroups.slice(0, wantsVisible)
    : filteredGroups.slice((wantsPage - 1) * WANTS_PAGE_SIZE, wantsPage * WANTS_PAGE_SIZE);
  const wantsHasMore = wantsInfiniteScroll && wantsVisible < filteredGroups.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-2 pb-1">
        <div className="relative">
          <input
            value={wantsSearch}
            onChange={(e) => setWantsSearch(e.target.value)}
            placeholder="Search artist, title, label, genre…"
            className="w-full border border-stone-800/80 rounded-xl px-4 py-2.5 pr-9 text-sm text-amber-50 placeholder-stone-700 focus:outline-none focus:border-amber-900/60"
            style={{ backgroundColor: "var(--bg-input)" }}
          />
          {wantsSearch && (
            <button
              onClick={() => setWantsSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>
      {/* iOS Home Screen guidance */}
      {typeof navigator !== "undefined" && /iPhone|iPad/i.test(navigator.userAgent) && !window.navigator.standalone && (
        <div className="px-4 pt-1 pb-0">
          <div className="text-[11px] text-amber-700 bg-amber-950/30 border border-amber-900/30 rounded-lg px-3 py-2">
            Add CrateMate to your Home Screen to enable price alerts on iOS.
          </div>
        </div>
      )}
      <div className="px-4 py-1 flex items-center gap-2">
        <button
          onClick={onStartImport}
          disabled={isImporting}
          className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-300 hover:border-amber-900/50 transition-all disabled:opacity-40"
        >
          {isImporting ? "Importing…" : "↓ Import"}
        </button>
        {isImporting && progress !== null && (
          <span className="text-[10px] text-stone-500">{progress}%</span>
        )}
        {wantlistImportJob?.status === "failed" && (
          <span className="text-[10px] text-red-400">{wantlistImportJob.error || "Import failed"}</span>
        )}
        <div className="flex-1" />
        {pushPermission !== "granted" && (
          <button
            onClick={onSubscribePush}
            title="Enable price alerts"
            className="text-base text-stone-600 hover:text-amber-400 transition-colors px-1"
          >🔔</button>
        )}
        {allGroups.length > 0 && (
          <button
            onClick={() => { setWantsInfiniteScroll(s => !s); setWantsPage(1); setWantsVisible(WANTS_PAGE_SIZE); }}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${wantsInfiniteScroll ? "bg-amber-900/30 border-amber-800/40 text-amber-400" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
          >
            {wantsInfiniteScroll ? "∞" : "p."}
          </button>
        )}
      </div>

      {isImporting && (
        <div className="px-4 mb-2">
          <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-700/60 rounded-full transition-all duration-500"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
          <div className="text-[10px] text-stone-600 mt-1">
            {wantlistImportJob.imported || 0} of {wantlistImportJob.total || "?"} wants imported
          </div>
        </div>
      )}

      {wantsSearch && (
        <div className="px-4 pb-1 text-[10px] text-stone-600">
          {filteredGroups.length} of {allGroups.length} albums
        </div>
      )}

      {allGroups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 24 }} className="text-amber-100 mb-2">
            Your wantlist is empty
          </div>
          <div className="text-stone-600 text-sm max-w-xs">
            Import your Discogs wantlist to see albums you&apos;re looking for.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 16 }} onScroll={onScroll}>
          {topSlot && <div className="pb-2">{topSlot}</div>}
          {visibleGroups.map((group) => {
            const key = group.master_id ? `master_${group.master_id}` : `release_${group.representative?.release_id}`;
            const repId = group.representative?.release_id;
            return (
              <WantGroupRow
                key={key}
                group={group}
                expanded={expandedMasters.has(key)}
                onToggle={() => {
                  setExpandedMasters((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
                onRemove={onRemove}
                pushEnabled={pushPermission === "granted" && pushSubscribed}
                threshold={repId ? priceThresholds.get(repId) : null}
                onSaveThreshold={repId ? (price) => onSaveThreshold(repId, price) : null}
                onRemoveThreshold={repId ? () => onRemoveThreshold(repId) : null}
              />
            );
          })}
          {wantsInfiniteScroll
            ? (wantsHasMore && <div ref={wantsSentinelRef} className="py-4 text-center text-stone-700 text-xs">Loading more…</div>)
            : allGroups.length > WANTS_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 py-4">
                <button onClick={() => setWantsPage(p => Math.max(1, p - 1))} disabled={wantsPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                  ← Prev
                </button>
                <span className="text-stone-600 text-xs">{wantsPage} / {wantsTotalPages}</span>
                <button onClick={() => setWantsPage(p => Math.min(wantsTotalPages, p + 1))} disabled={wantsPage === wantsTotalPages}
                  className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                  Next →
                </button>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

function MarqueeTitle({ children, style }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scrollAmt, setScrollAmt] = useState(0);
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    function measure() {
      const ov = inner.scrollWidth - outer.clientWidth;
      setScrollAmt(ov > 4 ? ov : 0);
    }
    measure();
    // Re-measure when font loads or container resizes (fixes diacritic titles like "Habitaciones Extrañas")
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div ref={outerRef} style={{ overflow: 'hidden', ...style }}>
      <span
        ref={innerRef}
        style={scrollAmt > 0 ? { '--mo': `-${scrollAmt}px`, animation: 'cm-marquee 5s ease-in-out infinite alternate', display: 'inline-block', whiteSpace: 'nowrap' } : { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >{children}</span>
    </div>
  );
}

function RecordRow({ record, onClick, onGenreClick, activeGenres = new Set(), playCount, bpm, onLogPlay }) {
  const originalYear = record.year_original || record.year_pressed;
  const pressedYear = record.year_pressed || null;
  const showPressed = originalYear && pressedYear && pressedYear !== originalYear;

  return (
    <div
      onClick={() => onClick(record)}
      className="flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.04] active:scale-[0.99] border border-transparent hover:border-white/[0.07]"
      style={{ touchAction: "manipulation" }}
    >
      <CoverArt record={record} size={52} />
      <div className="flex-1 min-w-0">
        <MarqueeTitle style={{ fontFamily: "’Fraunces’,serif", fontSize: 15, color: "var(--text-heading)", lineHeight: 1.3 }}>
          {record.title}
        </MarqueeTitle>
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          <ArtistTag artist={record.artist} discogsId={record.discogs_id} />
          {record.for_sale && <span className="text-xs text-rose-400/80">FOR SALE</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-1">
        <div className="flex flex-col items-end gap-1">
          {originalYear ? (
            <div className="text-right leading-tight">
              <div className="text-stone-500 text-xs">’{String(originalYear).slice(-2)}</div>
              {showPressed && <div className="text-stone-700 text-[11px]">press {pressedYear}</div>}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-0.5">
            {getGenres(record).slice(0, 2).map((g) => (
              <GenreTag key={g} genre={g} onClick={onGenreClick} active={activeGenres.has(g)} />
            ))}
          </div>
          {playCount > 0 && (
            <div className="text-stone-600 text-[11px]">· {playCount}</div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onLogPlay?.(record.id); }}
          className="w-7 h-7 rounded-full border border-stone-700/60 text-stone-600 hover:text-amber-400 hover:border-amber-800/50 transition-colors flex items-center justify-center shrink-0"
          title="Log a play"
        >
          <svg viewBox="0 0 8 10" fill="currentColor" className="w-2.5 h-3 ml-0.5"><path d="M0 0L8 5L0 10z"/></svg>
        </button>
      </div>
    </div>
  );
}

function DetailSheet({ record, hasNowPlaying, onClose, onSeedNext, onGenreClick, activeGenres = new Set(), onToggleForSale, onDelete, onLogPlay, onEnterTrail, onCompare, onRecordUpdate, onEnrich, playCount, playCountThisYear, lastPlayedDate, spotifyFeatures }) {
  const [tracks, setTracks] = useState([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [favTracks, setFavTracks] = useState(record.favorite_tracks || []);
  const [tracklistOpen, setTracklistOpen] = useState(false);
  const [soundProfileOpen, setSoundProfileOpen] = useState(false);
  const [listingPrice, setListingPrice] = useState(null);
  const artTapRef = useRef(0);
  // Hero image fallback chain: null = use heroHi, string = override src, false = all failed
  const [heroSrcOverride, setHeroSrcOverride] = useState(null);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);

  // Fetch marketplace pricing when record is listed for sale
  useEffect(() => {
    if (!record.for_sale || !record.discogs_id) return;
    setListingPrice(null);
    fetch(`/api/discogs/wantlist/price/${record.discogs_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.min_price != null || data?.lowest_listing != null) setListingPrice(data); })
      .catch(() => {});
  }, [record.for_sale, record.discogs_id]);

  function slideClose() {
    setClosing(true);
    setTimeout(onClose, 280);
  }

  function toggleFav(key, title) {
    const getFavKey = (f) => (typeof f === "object" ? f.key : f);
    const alreadyFaved = favTracks.some((f) => getFavKey(f) === key);
    const next = alreadyFaved
      ? favTracks.filter((f) => getFavKey(f) !== key)
      : [...favTracks, { key, title }];
    setFavTracks(next);
    onRecordUpdate?.({ favorite_tracks: next });
    fetch(`/api/records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite_tracks: next }),
    }).catch(() => {});
    // Hearting a track signals strong interest — silently enrich this record
    if (!alreadyFaved) onEnrich?.(record.id);
  }
  const [heroUrl, setHeroUrl] = useState("");
  // Initialize from _artCache immediately — CoverArt populates this for visible records
  const [itunesUrl, setItunesUrl] = useState(() => _artCache.get(record?.id) || "");
  const preferThumb = !!record?.thumb;

  useEffect(() => {
    setHeroUrl("");
    // Pull from art cache first (synchronous — no API call needed)
    setItunesUrl(_artCache.get(record?.id) || "");
  }, [record?.id]);

  // Fetch iTunes art as fallback for records without a working thumb
  useEffect(() => {
    if (!record?.artist && !record?.title) return;
    if (_artCache.get(record?.id)) return; // already have it
    if (record?.thumb && !isUserPhoto(record.thumb)) return; // already have decent art
    let cancelled = false;
    fetchITunesArt(record.artist, record.title).then((url) => {
      if (!cancelled && url) setItunesUrl(url);
    });
    return () => { cancelled = true; };
  }, [record?.id]);

  function parseDiscogsId(value) {
    if (value == null) return null;
    const match = String(value).match(/\d+/);
    if (!match) return null;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
  }

  async function resolveAndLoad() {
    if (!record?.artist && !record?.title) {
      setTrackError("No artist/title to resolve Discogs release");
      return;
    }
    try {
      const resolveRes = await fetch(
        `/api/discogs/resolve?artist=${encodeURIComponent(record.artist || "")}&title=${encodeURIComponent(record.title || "")}`
      );
      const resolve = await readJsonOrText(resolveRes);
      if (!resolveRes.ok) throw new Error(resolve?.error || `Resolve failed (${resolveRes.status})`);
      setTracks(Array.isArray(resolve.tracklist) ? resolve.tracklist : []);
      if (!preferThumb) {
        setHeroUrl(typeof resolve.cover_image === "string" ? resolve.cover_image : "");
      }
      if (resolve.release_id && record?.id) {
        await fetch(`/api/records/${record.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discogs_id: resolve.release_id,
            ...(resolve.cover_image ? { thumb: resolve.cover_image } : {}),
          }),
        });
      }
      setTrackError("");
    } catch (e) {
      setTrackError(e instanceof Error ? e.message : "Could not resolve Discogs release.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadTracklist() {
      const releaseId = parseDiscogsId(record?.discogs_id);
      if (!Number.isFinite(releaseId)) {
        setTracks([]);
        setHeroUrl("");
        setTrackError("Resolving Discogs release...");
        if (!cancelled) await resolveAndLoad();
        return;
      }
      setTrackLoading(true);
      setTrackError("");
      try {
        const res = await fetch(`/api/discogs/release/${releaseId}`);
        const data = await readJsonOrText(res);
        if (!res.ok) {
          const err = data?.error || `Tracklist failed (${res.status})`;
          if (String(err).includes("Invalid Discogs release ID")) {
            await resolveAndLoad();
            return;
          }
          throw new Error(err);
        }
        if (!cancelled) {
          setTracks(Array.isArray(data.tracklist) ? data.tracklist : []);
          if (!preferThumb) {
            setHeroUrl(typeof data.cover_image === "string" ? data.cover_image : "");
          }
        }
        if (data?.cover_image && record?.id) {
          await fetch(`/api/records/${record.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumb: data.cover_image }),
          });
        }
      } catch (e) {
        if (!cancelled) setTrackError(e instanceof Error ? e.message : "Could not load tracklist.");
      } finally {
        if (!cancelled) setTrackLoading(false);
      }
    }
    loadTracklist();
    return () => {
      cancelled = true;
    };
  }, [record?.discogs_id, record?.id, record?.artist, record?.title]);

  const originalYear = record.year_original || record.year_pressed;
  const pressedYear = record.year_pressed || null;
  const isRepress = record.year_original && record.year_pressed && record.year_original !== record.year_pressed;
  // Prefer iTunes (1000px) > heroUrl from Discogs release > record.thumb.
  const heroBase = itunesUrl || heroUrl || record.thumb || "";
  const heroHi = upgradeDiscogsThumb(heroBase);
  const heroIsUpgraded = heroBase && heroHi && heroHi !== heroBase;
  const heroImage = heroBase ? (heroIsUpgraded ? `url(${heroHi}), url(${heroBase})` : `url(${heroBase})`) : "";
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]">
      <button className="absolute inset-0" onClick={slideClose} aria-label="Close" />
      <div className="relative w-full max-w-md mx-auto h-full flex flex-col justify-end">
        <div
          className="bg-stone-950 border border-stone-800/80 border-b-0 rounded-t-3xl px-5 pt-5 overflow-y-auto"
          style={{
            maxHeight: "92vh",
            paddingBottom: 28,
            transform: (closing || !entered) ? "translateY(100%)" : "translateY(0)",
            transition: entered ? "transform 0.28s cubic-bezier(0.4, 0, 1, 1)" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tap-to-dismiss handle */}
          <button
            onClick={slideClose}
            className="flex items-center justify-center mx-auto mb-4 w-10 h-5 text-stone-600 hover:text-stone-400 transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <path d="M2 2l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Header: album art + metadata to the right */}
          <div className="flex gap-3 mb-4 items-start">
            <div
              className="w-[252px] h-[252px] rounded-2xl overflow-hidden shrink-0 bg-stone-800 select-none"
            >
              {heroSrcOverride !== false && (heroHi || itunesUrl || record.thumb) ? (
                <img
                  src={proxyArtUrl(heroSrcOverride || heroHi || record.thumb)}
                  alt=""
                  className="w-full h-full object-cover pointer-events-none"
                  onError={() => {
                    const itunes = _artCache.get(record.id) || itunesUrl;
                    if (heroSrcOverride == null) {
                      // Failed on heroHi — try thumb if it's a different URL
                      if (record.thumb && record.thumb !== heroHi) {
                        setHeroSrcOverride(record.thumb);
                      } else if (itunes && itunes !== heroHi) {
                        setHeroSrcOverride(itunes);
                      } else {
                        setHeroSrcOverride(false);
                      }
                    } else if (heroSrcOverride === record.thumb) {
                      // Failed on thumb — try iTunes if not already tried
                      if (itunes && itunes !== heroHi && itunes !== record.thumb) {
                        setHeroSrcOverride(itunes);
                      } else {
                        setHeroSrcOverride(false);
                      }
                    } else {
                      setHeroSrcOverride(false); // all options exhausted → VinylDisc
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center pointer-events-none">
                  <VinylDisc record={record} size={206} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5 min-w-0 pt-1 flex-1">
              <div>
                <div className="text-stone-200 text-sm truncate">{originalYear || "—"}</div>
                {isRepress && (
                  <div className="text-stone-500 text-[11px] truncate mt-0.5">{record.year_pressed} pressing</div>
                )}
              </div>
              {condenseCondition(record.condition) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-600 text-[10px] shrink-0">M/S</span>
                  <span className="text-stone-200 text-sm">{condenseCondition(record.condition)}</span>
                </div>
              )}
              {record.label && (
                <MarqueeTitle style={{ fontSize: 12, color: "#a8a29e" }}>
                  {record.label.split(",")[0].trim()}
                </MarqueeTitle>
              )}
              {/* Genre pills — pinned to bottom of art column */}
              <div className="flex flex-wrap gap-1 mt-auto">
                {getGenres(record).map((g) => (
                  <GenreTag key={g} genre={g} onClick={onGenreClick} active={activeGenres.has(g)} />
                ))}
              </div>
              {/* Play count + last played together */}
              {(playCount > 0 || lastPlayedDate) && (
                <div className="flex flex-col gap-0.5">
                  {playCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-600 text-xs">{playCount} {playCount === 1 ? "play" : "plays"}</span>
                      {playCountThisYear > 0 && playCountThisYear < playCount && (
                        <span className="text-stone-700 text-xs">· {playCountThisYear} this year</span>
                      )}
                    </div>
                  )}
                  {lastPlayedDate && (
                    <div className="text-stone-600 text-[11px]">
                      Last played: {(() => {
                        const diff = Date.now() - new Date(lastPlayedDate).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return "just now";
                        if (mins < 60) return `${mins} min ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
                        const days = Math.floor(hrs / 24);
                        if (days === 1) return "yesterday";
                        if (days < 7) return `${days} days ago`;
                        const weeks = Math.floor(days / 7);
                        if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
                        const months = Math.floor(days / 30);
                        if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
                        const years = Math.floor(days / 365);
                        return `${years} year${years > 1 ? "s" : ""} ago`;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Title + Artist below the art */}
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22 }} className="text-amber-50 font-semibold leading-tight mb-1">
            {record.title}
          </div>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            {record.discogs_id ? (
              <a
                href={`/artist/${record.discogs_id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-amber-400/80 text-sm underline decoration-dotted underline-offset-2 hover:text-amber-300 transition-colors cursor-pointer"
              >{stripArtistNum(record.artist)}</a>
            ) : (
              <span className="text-stone-400 text-sm">{stripArtistNum(record.artist)}</span>
            )}
            {(getFormat(record) || record.is_compilation) && (
              <span className="text-stone-600 text-xs shrink-0">
                {[getFormat(record), record.is_compilation ? "Comp." : null].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          {/* Action buttons — one row, all flex-1 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => onLogPlay?.(record.id)}
              className="flex-1 py-2 rounded-xl bg-amber-900/20 border border-amber-800/30 text-amber-400/80 text-xs font-medium hover:bg-amber-900/35 hover:text-amber-300 transition-colors"
            ><svg viewBox="0 0 8 10" fill="currentColor" className="inline w-2 h-2.5 mr-1 mb-px"><path d="M0 0L8 5L0 10z"/></svg>Log</button>
            {!record.for_sale && (
              <button
                onClick={() => { onEnterTrail?.(record); onClose(); }}
                className="flex-1 py-2 rounded-xl bg-teal-900/20 border border-teal-800/35 text-teal-400/80 text-xs font-medium hover:bg-teal-900/35 hover:text-teal-300 transition-colors"
              >⬡ Session</button>
            )}
            <button
              onClick={() => onCompare?.(record)}
              className="flex-1 py-2 rounded-xl border border-stone-800/40 text-stone-500 text-xs font-medium hover:text-stone-300 hover:border-stone-700/60 transition-colors"
            >⇄ Compare</button>
            <button
              onClick={() => onToggleForSale?.(record)}
              className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                record.for_sale
                  ? "bg-rose-900/35 border-rose-700/50 text-rose-300 hover:bg-rose-900/50"
                  : "border-stone-800/40 text-stone-600 hover:text-stone-400 hover:border-stone-700/60"
              }`}
            >{record.for_sale ? "Unlist" : "🏷 List"}</button>
          </div>

          {/* Marketplace price info — shown when listed for sale */}
          {record.for_sale && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-stone-900/50 border border-stone-800/40 text-xs text-stone-500 flex flex-wrap gap-x-3 gap-y-1">
              {listingPrice == null ? (
                <span className="text-stone-600">Fetching market price…</span>
              ) : (
                <>
                  {listingPrice.min_price != null && (
                    <span>Suggested <span className="text-stone-300">${listingPrice.min_price.toFixed(2)}</span>{listingPrice.condition ? ` ${listingPrice.condition}` : ""}</span>
                  )}
                  {listingPrice.lowest_listing != null && (
                    <span>Lowest <span className="text-stone-300">${listingPrice.lowest_listing.toFixed(2)}</span></span>
                  )}
                  {listingPrice.num_for_sale != null && (
                    <span>{listingPrice.num_for_sale} for sale</span>
                  )}
                  {listingPrice.deal_pct != null && listingPrice.deal_pct > 0 && (
                    <span className="text-emerald-500">{listingPrice.deal_pct}% below market</span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Collapsible tracklist */}
          <button
            onClick={() => setTracklistOpen(o => !o)}
            className="flex items-center gap-2 w-full py-1 mb-2"
          >
            <span className="text-stone-400 text-xs uppercase tracking-widest">Tracklist</span>
            <span className="flex-1" />
            {(() => {
              const totalSecs = record.duration_secs || parseDurationSecs(tracks);
              if (!totalSecs) return null;
              const m = Math.round(totalSecs / 60);
              return <span className="text-stone-600 text-xs shrink-0">{m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`}</span>;
            })()}
            <span className="text-stone-600 text-xs shrink-0">{tracklistOpen ? "▲" : "▼"}</span>
          </button>
          {tracklistOpen && (
            <>
              {trackLoading && <div className="text-stone-600 text-sm py-2">Loading tracklist...</div>}
              {trackError && <div className="text-red-400/70 text-sm py-2">{trackError}</div>}
              {!trackLoading && !trackError && tracks.length === 0 && (
                <div className="text-stone-600 text-sm py-2">No tracklist found.</div>
              )}
              <div className="space-y-2 mb-2">
                {tracks.map((t, i) => {
                  const key = t.position || String(i);
                  const faved = favTracks.some((f) => (typeof f === "object" ? f.key : f) === key);
                  const isHeading = t.type === "heading";
                  return (
                    <div key={`${t.position || "h"}-${i}`} className="flex items-start gap-3">
                      <div className="text-stone-600 text-xs w-10 shrink-0 pt-0.5">{t.position || "—"}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${isHeading ? "text-stone-300 uppercase tracking-widest text-xs" : "text-amber-50"}`}>{t.title}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <span className="text-stone-600 text-xs">{t.duration || ""}</span>
                        {!isHeading && (
                          <button
                            onClick={() => toggleFav(key, t.title)}
                            className={`text-sm transition-colors ${faved ? "text-rose-400" : "text-stone-700 hover:text-stone-400"}`}
                          >♥</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Collapsible Sound Profile */}
          {(() => {
            const fromSpotify = spotifyFeatures?.[record.id];
            const f = fromSpotify || estimateFeaturesFromRecord(record);
            const isSpotify = !!fromSpotify;
            const bars = [
              { label: "Energy",       value: f.energy,       color: "bg-amber-600/70",    hint: f.energy > 0.7 ? "high" : f.energy < 0.4 ? "low" : null },
              { label: "Mood",         value: f.valence,      color: "bg-rose-600/60",     hint: f.valence > 0.6 ? "upbeat" : f.valence < 0.4 ? "melancholic" : null },
              { label: "Danceability", value: f.danceability, color: "bg-emerald-700/60",  hint: f.danceability > 0.65 ? "danceable" : f.danceability < 0.4 ? "headphones" : null },
              { label: "Acoustic",     value: f.acousticness, color: "bg-stone-500/70",    hint: null },
              { label: "Loudness",     value: f.loudness ?? 0.70, color: "bg-orange-900/70", hint: (f.loudness ?? 0.70) > 0.80 ? "loud" : (f.loudness ?? 0.70) < 0.45 ? "dynamic" : null },
            ];
            // Descriptor pills shown when collapsed
            const descriptors = [];
            if (f.energy > 0.7) descriptors.push({ label: "High Energy", cls: "bg-amber-900/30 border-amber-800/40 text-amber-400" });
            else if (f.energy < 0.4) descriptors.push({ label: "Laid Back", cls: "bg-stone-800/40 border-stone-700/40 text-stone-400" });
            if (f.valence > 0.6) descriptors.push({ label: "Feel Good", cls: "bg-rose-900/30 border-rose-800/40 text-rose-300" });
            else if (f.valence < 0.35) descriptors.push({ label: "Melancholic", cls: "bg-indigo-900/30 border-indigo-800/40 text-indigo-400" });
            if (f.danceability > 0.65) descriptors.push({ label: "Danceable", cls: "bg-emerald-900/30 border-emerald-800/40 text-emerald-400" });
            else if (f.danceability < 0.4) descriptors.push({ label: "Headphone Music", cls: "bg-stone-800/40 border-stone-700/40 text-stone-400" });
            return (
              <div className="mt-4 mb-2">
                <button onClick={() => setSoundProfileOpen(o => !o)} className="flex items-center gap-2 w-full py-1 mb-2 flex-wrap">
                  <span className="text-stone-400 text-xs uppercase tracking-widest shrink-0">Sound Profile</span>
                  {descriptors.map(d => (
                    <span key={d.label} className={`text-[10px] px-2 py-0.5 rounded-full border ${d.cls} shrink-0`}>{d.label}</span>
                  ))}
                  <span className="flex-1" />
                  <span className={`text-xs shrink-0 ${isSpotify ? "text-emerald-700" : "text-stone-600"}`}>{isSpotify ? "" : "~"}{Math.round(f.tempo)} BPM</span>
                  <span className="text-stone-600 text-xs shrink-0">{soundProfileOpen ? "▲" : "▼"}</span>
                </button>
                {soundProfileOpen && (
                  <div className="space-y-2">
                    {bars.map(({ label, value, color, hint }) => (
                      <div key={label} className="flex items-start gap-3">
                        <div className="flex flex-col shrink-0 w-[76px]">
                          <span className="text-stone-500 text-xs leading-tight">{label}</span>
                          {hint && <span className="text-stone-700 text-[10px] leading-tight">{hint}</span>}
                        </div>
                        <div className="flex-1 bg-stone-800/50 rounded-full h-1.5 overflow-hidden mt-1.5">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Streaming — at the bottom since this is a vinyl app */}
          <div className="mt-4 mb-2 border-t border-stone-800/40 pt-4">
            <StreamingButtons artist={record.artist} title={record.title} />
          </div>

          {!record.discogs_instance_id && (
            <button
              onClick={() => { if (window.confirm(`Remove "${record.title}" from your crate?`)) onDelete?.(record); }}
              className="mt-3 w-full py-2.5 rounded-xl border border-red-900/40 text-red-400/70 text-sm hover:bg-red-900/20 hover:text-red-300 transition-colors"
            >Remove from crate</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function HoneycombView({ records, playCounts, onSelect, zoom = 1, onLogPlay, onDoubleTap, screensaverEnabled = true, onToggleScreensaver, shape = "honeycomb", onInteract }) {
  const containerRef = useRef(null);
  const worldRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const moveDistance = useRef(0);
  const rafRef = useRef(null);
  const scaleRafRef = useRef(null);
  const cellsRef = useRef([]);
  const [scales, setScales] = useState({});
  const hexLongPressTimer = useRef(null);
  const hexLongPressFired = useRef(false);

  // Screensaver (idle auto-pan) — state is lifted to parent CrateMate
  const screensaverEnabledRef = useRef(screensaverEnabled);
  useEffect(() => { screensaverEnabledRef.current = screensaverEnabled; }, [screensaverEnabled]);
  const idleTimerRef = useRef(null);
  const screensaverActive = useRef(false);
  const screensaverRafRef = useRef(null);
  const screensaverVel = useRef({ x: 0, y: 0 });

  const BASE_SIZE = Math.round(180 * zoom);
  const isGrid = shape === "grid";
  const COL_STEP = isGrid ? BASE_SIZE * 0.82 : BASE_SIZE * 0.76;
  const ROW_STEP = BASE_SIZE * 0.88;
  const CIRCLE_RADIUS = BASE_SIZE * 4.8; // controls how wide the circular grid is

  // Generate all candidate positions in a circular boundary, sorted center-outward
  const allPositions = [];
  const RANGE = 9;
  for (let col = -RANGE; col <= RANGE; col++) {
    for (let row = -RANGE; row <= RANGE; row++) {
      const px = col * COL_STEP;
      const rowOffset = isGrid ? 0 : (((col % 2) + 2) % 2 === 1 ? ROW_STEP / 2 : 0);
      const py = row * ROW_STEP + rowOffset;
      const dist = Math.hypot(px, py);
      const inBounds = isGrid ? (Math.abs(col) <= 5 && Math.abs(row) <= 4) : dist <= CIRCLE_RADIUS;
      if (inBounds) {
        allPositions.push({ col, row, px, py, dist });
      }
    }
  }
  allPositions.sort((a, b) => a.dist - b.dist);

  // Assign one record per position — no repetition
  const cells = allPositions.slice(0, records.length).map((pos, i) => ({
    ...pos,
    record: records[i],
    key: `${pos.col}-${pos.row}`,
  }));
  cellsRef.current = cells;

  // World is a square centered on (0,0) — cells use px/py relative to center
  const worldR = CIRCLE_RADIUS + BASE_SIZE;
  const gridW = worldR * 2;
  const gridH = worldR * 2;
  const cx = worldR; // center of world div
  const cy = worldR;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const initX = vw / 2 - cx;
    const initY = vh / 2 - cy;
    offsetRef.current = { x: initX, y: initY };
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${initX}px, ${initY}px)`;
    }
    recalcScales(initX, initY, vw, vh);
    resetIdleTimer();
    return () => {
      stopScreensaver();
      clearTimeout(idleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.length, zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Prevent pull-to-refresh and browser scroll interference on all touch events
    const prevent = (e) => e.preventDefault();
    el.addEventListener("touchstart", prevent, { passive: false });
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      el.removeEventListener("touchstart", prevent);
      el.removeEventListener("touchmove", prevent);
    };
  }, []);

  function recalcScales(ox, oy, vw, vh) {
    if (!containerRef.current) return;
    const cw = vw ?? containerRef.current.clientWidth;
    const ch = vh ?? containerRef.current.clientHeight;
    // Viewport center in world coordinates
    const viewCX = cw / 2 - ox - cx;
    const viewCY = ch / 2 - oy - cy;
    const MAX_DIST = 320;
    const MIN_SCALE = 0.45;
    const MAX_SCALE = 1.45;
    const next = {};
    cellsRef.current.forEach(({ record, key, px, py }) => {
      const dist = Math.hypot(px - viewCX, py - viewCY);
      const t = Math.max(0, 1 - dist / MAX_DIST);
      const plays = playCounts[record.id] || 0;
      const playBoost = plays >= 5 ? 0.08 : plays >= 1 ? 0.04 : 0;
      next[key] = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * (t * t) + playBoost;
    });
    setScales(next);
  }

  function clampOffset(x, y, vw, vh) {
    const cw = vw ?? containerRef.current?.clientWidth ?? 400;
    const ch = vh ?? containerRef.current?.clientHeight ?? 700;
    // How far the viewport center is from the grid center
    const viewCX = cw / 2 - x - cx;
    const viewCY = ch / 2 - y - cy;
    const dist = Math.hypot(viewCX, viewCY);
    const maxPan = CIRCLE_RADIUS + BASE_SIZE * 0.3;
    if (dist <= maxPan) return { x, y };
    // Project back onto the boundary circle
    const scale = maxPan / dist;
    return {
      x: cw / 2 - viewCX * scale - cx,
      y: ch / 2 - viewCY * scale - cy,
    };
  }

  function applyTransform(x, y) {
    if (worldRef.current) worldRef.current.style.transform = `translate(${x}px, ${y}px)`;
  }

  function startMomentum() {
    cancelAnimationFrame(rafRef.current);
    const FRICTION = 0.92;
    function tick() {
      velocity.current.x *= FRICTION;
      velocity.current.y *= FRICTION;
      if (Math.abs(velocity.current.x) < 0.3 && Math.abs(velocity.current.y) < 0.3) {
        recalcScales(offsetRef.current.x, offsetRef.current.y);
        return;
      }
      const clamped = clampOffset(offsetRef.current.x + velocity.current.x, offsetRef.current.y + velocity.current.y);
      if (clamped.x === offsetRef.current.x && clamped.y === offsetRef.current.y) {
        velocity.current = { x: 0, y: 0 }; // hit boundary, kill momentum
      }
      offsetRef.current = clamped;
      applyTransform(clamped.x, clamped.y);
      cancelAnimationFrame(scaleRafRef.current);
      scaleRafRef.current = requestAnimationFrame(() =>
        recalcScales(offsetRef.current.x, offsetRef.current.y)
      );
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  const SCREENSAVER_SPEED = 1.8;
  const IDLE_DELAY = 6000;
  const lastBounceRef = useRef(0);

  function startScreensaver() {
    if (dragging.current) return;
    screensaverActive.current = true;
    const angle = Math.random() * Math.PI * 2;
    screensaverVel.current = { x: Math.cos(angle) * SCREENSAVER_SPEED, y: Math.sin(angle) * SCREENSAVER_SPEED };
    function tick() {
      if (!screensaverActive.current) return;
      const container = containerRef.current;
      if (!container) return;
      const vw = container.clientWidth;
      const vh = container.clientHeight;
      const { x, y } = offsetRef.current;
      const { x: vx, y: vy } = screensaverVel.current;
      const nx = x + vx;
      const ny = y + vy;
      const clamped = clampOffset(nx, ny, vw, vh);
      let bounced = false;
      if (Math.abs(clamped.x - nx) > 0.1) { screensaverVel.current.x *= -1; bounced = true; }
      if (Math.abs(clamped.y - ny) > 0.1) { screensaverVel.current.y *= -1; bounced = true; }
      if (bounced) {
        const now = Date.now();
        if (now - lastBounceRef.current > 300) {
          lastBounceRef.current = now;
          const { x: bvx, y: bvy } = screensaverVel.current;
          const newAngle = Math.atan2(bvy, bvx) + (Math.random() - 0.5) * 1.4;
          const speed = Math.hypot(bvx, bvy);
          screensaverVel.current = { x: Math.cos(newAngle) * speed, y: Math.sin(newAngle) * speed };
        }
      }
      offsetRef.current = clamped;
      applyTransform(clamped.x, clamped.y);
      if (!scaleRafRef.current) {
        scaleRafRef.current = requestAnimationFrame(() => {
          scaleRafRef.current = null;
          recalcScales(offsetRef.current.x, offsetRef.current.y);
        });
      }
      screensaverRafRef.current = requestAnimationFrame(tick);
    }
    screensaverRafRef.current = requestAnimationFrame(tick);
  }

  function stopScreensaver() {
    screensaverActive.current = false;
    if (screensaverRafRef.current) {
      cancelAnimationFrame(screensaverRafRef.current);
      screensaverRafRef.current = null;
    }
  }

  function resetIdleTimer() {
    clearTimeout(idleTimerRef.current);
    if (screensaverEnabledRef.current) {
      idleTimerRef.current = setTimeout(startScreensaver, IDLE_DELAY);
    }
  }

  function toggleScreensaver() {
    if (onToggleScreensaver) onToggleScreensaver();
  }

  function onPointerDown(e) {
    stopScreensaver();
    resetIdleTimer();
    dragging.current = true;
    moveDistance.current = 0;
    velocity.current = { x: 0, y: 0 };
    cancelAnimationFrame(rafRef.current);
    const pos = e.touches ? e.touches[0] : e;
    lastPos.current = { x: pos.clientX, y: pos.clientY };
    if (onInteract) onInteract();
  }

  function onPointerMove(e) {
    if (!dragging.current) resetIdleTimer();
    if (!dragging.current) return;
    if (onInteract) onInteract();
    const pos = e.touches ? e.touches[0] : e;
    const dx = pos.clientX - lastPos.current.x;
    const dy = pos.clientY - lastPos.current.y;
    lastPos.current = { x: pos.clientX, y: pos.clientY };
    moveDistance.current += Math.abs(dx) + Math.abs(dy);
    if (moveDistance.current > 6) { clearTimeout(hexLongPressTimer.current); hexLongPressFired.current = false; }
    velocity.current = { x: dx, y: dy };
    const clamped = clampOffset(offsetRef.current.x + dx, offsetRef.current.y + dy);
    offsetRef.current = clamped;
    applyTransform(clamped.x, clamped.y);
    cancelAnimationFrame(scaleRafRef.current);
    scaleRafRef.current = requestAnimationFrame(() =>
      recalcScales(offsetRef.current.x, offsetRef.current.y)
    );
  }

  function onPointerUp(e, record) {
    if (!dragging.current) return;
    dragging.current = false;
    if (moveDistance.current < 6 && record) {
      clearTimeout(hexLongPressTimer.current);
      if (!hexLongPressFired.current) onSelect(record);
      hexLongPressFired.current = false;
    } else {
      startMomentum();
    }
    resetIdleTimer();
  }

  if (records.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-700 text-sm">
        No records to browse.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: "none", overscrollBehavior: "none" }}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={(e) => onPointerUp(e, null)}
      onMouseLeave={(e) => onPointerUp(e, null)}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={(e) => onPointerUp(e, null)}
    >
      <div
        ref={worldRef}
        style={{ position: "absolute", width: gridW, height: gridH, willChange: "transform" }}
      >
        {cells.map(({ record, key, px, py }) => {
          const scale = scales[key] ?? 0.45;
          const zIndex = Math.round(scale * 100);
          const plays = playCounts[record.id] || 0;
          const isFocused = scale > 1.2;
          const primaryGenre = getGenres(record)[0] || "";
          const genreHex = getGenrePalette(primaryGenre).hex;
          const rgb = hexToRgb(genreHex);

          return (
            <div
              key={key}
              style={{
                position: "absolute",
                left: cx + px - BASE_SIZE / 2,
                top: cy + py - BASE_SIZE / 2,
                width: BASE_SIZE,
                height: BASE_SIZE,
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                transition: "transform 150ms ease-out",
                zIndex,
              }}
              onMouseDown={() => { hexLongPressFired.current = false; hexLongPressTimer.current = setTimeout(() => { hexLongPressFired.current = true; onDoubleTap?.(record); }, 500); }}
              onTouchStart={() => { hexLongPressFired.current = false; hexLongPressTimer.current = setTimeout(() => { hexLongPressFired.current = true; onDoubleTap?.(record); }, 500); }}
              onMouseUp={(e) => { e.stopPropagation(); onPointerUp(e, record); }}
              onTouchEnd={(e) => { e.stopPropagation(); onPointerUp(e, record); }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: isGrid ? 8 : 14,
                  overflow: "hidden",
                  boxShadow: isFocused
                    ? `0 0 0 3px rgba(${rgb},0.55), 0 8px 28px rgba(0,0,0,0.7)`
                    : `0 0 0 2px rgba(${rgb},0.28), 0 3px 12px rgba(0,0,0,0.5)`,
                  transition: "box-shadow 150ms ease-out",
                  position: "relative",
                }}
              >
                <CoverArt record={record} size={BASE_SIZE} />
                {isFocused && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      padding: 6,
                    }}
                  >
                    <p style={{ color: "#fef3c7", fontSize: 9, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.title}</p>
                    <p style={{ color: "#a8a29e", fontSize: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripArtistNum(record.artist)}</p>
                    {plays > 0 && <p style={{ color: "#78716c", fontSize: 7, marginTop: 1 }}>{plays}×</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lookahead row packer — eliminates gaps by pulling forward tiles that fit leftover space
// Percentile-based tile sizing — fairer than ratio-to-max when plays are bunched.
// Unplayed records → always 1 unit.
// Among played records: top 25% by count → 3 units, middle 50% → 2 units, bottom 25% → 1 unit.
// Value-based percentile (not rank-based) so ties always land in the same tier.
function computeTileSizes(records, playCounts) {
  const withPlays = records.map(r => ({ record: r, plays: playCounts[r.id] || 0 }));
  const playedCounts = withPlays.filter(t => t.plays > 0).map(t => t.plays).sort((a, b) => a - b);
  const n = playedCounts.length;
  const thresh3 = n > 0 ? playedCounts[Math.floor(n * 0.75)] : Infinity; // 75th percentile value
  const thresh2 = n > 0 ? playedCounts[Math.floor(n * 0.25)] : Infinity; // 25th percentile value
  return withPlays.map(({ record, plays }) => {
    let units = 1;
    if (plays > 0) {
      if (plays >= thresh3) units = 3;
      else if (plays >= thresh2) units = 2;
    }
    return { record, units, plays };
  });
}

function packTileRows(tiles, totalUnits) {
  const remaining = [...tiles];
  const rows = [];
  while (remaining.length > 0) {
    const row = [];
    let rowUnits = 0;
    row.push(remaining.shift());
    rowUnits += row[0].units;
    let filled = true;
    while (filled && rowUnits < totalUnits) {
      filled = false;
      const space = totalUnits - rowUnits;
      const idx = remaining.findIndex(t => t.units <= space);
      if (idx !== -1) {
        const [tile] = remaining.splice(idx, 1);
        row.push(tile);
        rowUnits += tile.units;
        filled = true;
      }
    }
    rows.push(row);
  }
  return rows;
}

function TileItem({ record, units, UNIT, GAP, onSelect, onDoubleTap, pointerStartY }) {
  const tileLongPressTimer = useRef(null);
  const tileLongPressFired = useRef(false);
  const tileSize = units * UNIT + (units - 1) * GAP;
  const primaryGenre = getGenres(record)[0] || "";
  const genreHex = getGenrePalette(primaryGenre).hex;

  const raw = record.thumb || "";
  const isUpload = isUserPhoto(raw);
  const upgraded = isUpload ? "" : upgradeDiscogsThumb(raw);
  const needsITunes = isUpload || !upgraded;

  const [fallback, setFallback] = useState(() => _artCache.get(record.id) || null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!needsITunes && !imgError) return;
    return _enqueueArt(record, (url) => {
      if (url) { setFallback(url); setImgError(false); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, imgError]);

  const artSrc = fallback || (imgError ? null : upgraded);

  return (
    <div
      onPointerDown={() => {
        tileLongPressFired.current = false;
        tileLongPressTimer.current = setTimeout(() => { tileLongPressFired.current = true; onDoubleTap?.(record); }, 500);
      }}
      onPointerUp={(e) => {
        clearTimeout(tileLongPressTimer.current);
        if (!tileLongPressFired.current && Math.abs(e.clientY - pointerStartY.current) <= 10) onSelect(record);
        tileLongPressFired.current = false;
      }}
      onPointerLeave={() => { clearTimeout(tileLongPressTimer.current); tileLongPressFired.current = false; }}
      style={{
        gridColumn: `span ${units}`,
        gridRow: `span ${units}`,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        background: "#0c0b09",
        touchAction: "pan-y",
      }}
    >
      {artSrc ? (
        <img
          src={proxyArtUrl(artSrc) || artSrc}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", background: `${genreHex}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: tileSize * 0.3, opacity: 0.3 }}>◇</span>
        </div>
      )}
      <div style={{ position: "absolute", top: 0, left: 0, width: Math.round(tileSize * 0.05), height: "100%", background: `${genreHex}55` }} />
    </div>
  );
}

export function TileView({ records, playCounts, onSelect, onDoubleTap, screensaverEnabled = true, onInteract }) {
  const containerRef = useRef(null); // outer scroll container
  const innerRef = useRef(null);     // inner grid (for width measurement)
  const [containerWidth, setContainerWidth] = useState(0);
  const pointerStartY = useRef(0);   // for drag-vs-tap guard

  // Idle screensaver auto-pan
  const idleTimer = useRef(null);
  const screensaverRaf = useRef(null);
  const screensaverDir = useRef(1);  // 1 = down, -1 = up
  const screensaverActive = useRef(false); // prevents scroll events from cancelling screensaver

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function stopScreensaver() {
    screensaverActive.current = false;
    cancelAnimationFrame(screensaverRaf.current);
    clearTimeout(idleTimer.current);
  }

  const screensaverEnabledRef = useRef(screensaverEnabled);
  useEffect(() => { screensaverEnabledRef.current = screensaverEnabled; }, [screensaverEnabled]);

  function startIdleTimer() {
    stopScreensaver();
    if (screensaverEnabledRef.current) {
      idleTimer.current = setTimeout(startScreensaver, 8000);
    }
  }

  function startScreensaver() {
    const el = containerRef.current;
    if (!el) return;
    screensaverActive.current = true;
    const SPEED = 0.6; // px per frame
    function step() {
      if (!containerRef.current || !screensaverActive.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;
      containerRef.current.scrollTop += SPEED * screensaverDir.current;
      if (containerRef.current.scrollTop >= maxScroll) screensaverDir.current = -1;
      if (containerRef.current.scrollTop <= 0) screensaverDir.current = 1;
      screensaverRaf.current = requestAnimationFrame(step);
    }
    screensaverRaf.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    if (screensaverEnabled) startIdleTimer();
    else stopScreensaver();
    return () => stopScreensaver();
  }, [records.length, screensaverEnabled]);

  const TOTAL_UNITS = 4;
  const GAP = 2;

  const tiles = computeTileSizes(records, playCounts);

  if (!containerWidth) {
    return <div ref={containerRef} className="flex-1" />;
  }

  // CSS Grid: each unit = one grid cell. Big tiles span multiple cells in both
  // dimensions (square). Dense auto-flow makes the browser slot smaller tiles
  // into any gaps left by larger ones — no manual row packing needed.
  const UNIT = Math.round((containerWidth - GAP * (TOTAL_UNITS - 1)) / TOTAL_UNITS);

  return (
    // Outer: native scroll container — overflow-y:scroll + overscroll-behavior:contain
    // lets Android recognise it for long/scroll screenshot capture.
    // Native momentum (iOS -webkit-overflow-scrolling, Android Chrome inertia) handles
    // the feel; we only add the idle screensaver on top.
    <div
      ref={containerRef}
      className="flex-1"
      style={{
        overflowY: "scroll",
        overflowX: "hidden",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
      onScroll={() => { if (!screensaverActive.current) startIdleTimer(); if (onInteract) onInteract(); }}
      onPointerDown={(e) => { stopScreensaver(); pointerStartY.current = e.clientY; startIdleTimer(); if (onInteract) onInteract(); }}
    >
      {/* Inner: CSS grid — measured for width */}
      <div
        ref={innerRef}
        className="pb-8"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TOTAL_UNITS}, ${UNIT}px)`,
          gridAutoRows: `${UNIT}px`,
          gap: GAP,
          gridAutoFlow: "dense",
          alignContent: "start",
        }}
      >
      {tiles.map(({ record, units, plays }) => (
        <TileItem
          key={record.id}
          record={record}
          units={units}
          plays={plays}
          UNIT={UNIT}
          GAP={GAP}
          onSelect={onSelect}
          onDoubleTap={onDoubleTap}
          pointerStartY={pointerStartY}
        />
      ))}
      </div>
    </div>
  );
}

function RecoCard({ reco, onClose, onGenreClick, activeGenres = new Set(), onLogPlay, onSelect }) {
  if (!reco) return null;
  const { record, reason, label } = reco;
  return (
    <div className="rounded-2xl border border-stone-700/60 bg-stone-900/80 p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">{label}</span>
        <button onClick={onClose} className="text-stone-600 hover:text-stone-300 text-xl leading-none">×</button>
      </div>
      <div
        className="flex items-center gap-4 mb-3 cursor-pointer"
        onClick={() => onSelect?.(record)}
      >
        <CoverArt record={record} size={70} />
        <div className="flex-1 min-w-0">
          <div
            style={{ fontFamily: "'Fraunces',serif", fontSize: 21 }}
            className="text-amber-50 font-semibold leading-tight"
          >
            {record.title}
          </div>
          <div className="text-stone-400 text-sm">{stripArtistNum(record.artist)}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(record.year_original || record.year_pressed) && (
              <span className="text-stone-500 text-xs">{record.year_original || record.year_pressed}</span>
            )}
            {getGenres(record).map((g) => (
              <GenreTag key={g} genre={g} onClick={(g) => { onGenreClick?.(g); }} active={activeGenres.has(g)} />
            ))}
          </div>
        </div>
      </div>
      {reason && (
        <div className="border-t border-white/[0.06] pt-3 pb-3 text-stone-300 text-sm leading-relaxed italic">{reason}</div>
      )}
      <div className="flex items-center justify-end border-t border-white/[0.06] pt-3">
        <button
          onClick={() => onLogPlay?.(record.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-900/20 border border-amber-800/30 text-amber-400/80 text-xs font-medium hover:bg-amber-900/35 hover:text-amber-300 transition-colors"
        >
          <svg viewBox="0 0 8 10" fill="currentColor" className="w-2 h-2.5 shrink-0"><path d="M0 0L8 5L0 10z"/></svg>
          Log play
        </button>
      </div>
    </div>
  );
}

// Feature 2: Import progress bar showing stages: importing → enriching → done
function ImportProgressBar({ importResult, enrichLoading }) {
  const stage = importResult?.stage;
  const progress = importResult?.enrichProgress;
  const meta = importResult?.meta;

  // Total records in DB (cumulative processed count from import job)
  const recordCount = importResult?.processed || (importResult?.imported || 0) + (importResult?.updated || 0);

  // Import progress line
  const currentPage = importResult?.current_page || importResult?.batch_offset || 0;
  const totalPages = importResult?.total_pages;
  const isImporting = stage === "importing" && importResult?.status !== "completed";

  let importLine = null;
  if (isImporting) {
    importLine = (
      <div className="flex items-center gap-1.5">
        <span className="text-amber-500 animate-spin inline-block">⟳</span>
        <span className="text-amber-500/70">
          {totalPages
            ? `Importing… page ${currentPage} of ${totalPages}`
            : `Importing… ${recordCount} records`}
        </span>
      </div>
    );
  } else {
    importLine = (
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-400">✓</span>
        <span className="text-emerald-400/80">
          Collection loaded{recordCount > 0 ? ` (${recordCount} records)` : ""}
        </span>
      </div>
    );
  }

  // Enrichment / metadata line
  let enrichLine = null;
  if (stage === "enriching" || enrichLoading) {
    const offset = progress?.offset;
    const total  = progress?.total;
    const progressLabel = offset != null && total
      ? `${offset} of ${total} records`
      : offset != null
        ? `${offset} records`
        : null;
    enrichLine = (
      <div className="flex items-center gap-1.5">
        <span className="text-amber-500 animate-spin inline-block">⟳</span>
        <span className="text-amber-500/70">
          {progressLabel ? `Fetching metadata… ${progressLabel}` : "Fetching metadata…"}
        </span>
      </div>
    );
  } else if (stage === "done" && meta) {
    const nothingToDo = meta.considered === 0;
    enrichLine = (
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-400">✓</span>
        <span className="text-emerald-400/70">
          {nothingToDo ? "Everything up to date" : `${meta.updated || 0} records enriched`}
        </span>
      </div>
    );
  } else if (!isImporting) {
    enrichLine = (
      <div className="flex items-center gap-1.5">
        <span className="text-stone-600">· Metadata pending</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {importLine}
      {enrichLine}
    </div>
  );
}

function CrateSyncAnimation() {
  return (
    <>
      <style>{`
        @keyframes recordFall {
          0%   { transform: translateY(-18px); opacity: 0; }
          15%  { opacity: 1; }
          55%  { transform: translateY(10px); opacity: 1; }
          75%  { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(10px); opacity: 0; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", width: 48, height: 38, flexShrink: 0 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: 6 + i * 10,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: `radial-gradient(circle at 38% 38%, #1f0a0a, #3a0d0d)`,
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
                animation: `recordFall 1.8s ease-in-out ${i * 0.45}s infinite`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0a0505" }} />
            </div>
          ))}
          {/* Crate body */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 18,
            border: "1.5px solid rgba(180,100,20,0.5)",
            borderTop: "2px solid rgba(180,100,20,0.7)",
            borderRadius: "0 0 3px 3px",
            overflow: "hidden",
          }}>
            {[14, 28].map((x) => (
              <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: x, width: 1, background: "rgba(180,100,20,0.3)" }} />
            ))}
          </div>
        </div>
        <span>Syncing — first time may take a few minutes for large collections</span>
      </div>
    </>
  );
}

async function callClaude(messages, maxTokens = 400, system = null, model = "claude-haiku-4-5-20251001") {
  const body = { messages, max_tokens: maxTokens, model };
  if (system) body.system = system;
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.content?.[0]?.text || "";
}

function extractJson(text) {
  // Strip markdown code fences that some models add despite instructions
  const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // Fall back to greedy regex — finds first { to last } in the text
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no-json");
    try { parsed = JSON.parse(match[0]); } catch { throw new Error("no-json"); }
  }
  // Unwrap if the model returned an array — take first element
  if (Array.isArray(parsed)) parsed = parsed[0];
  if (!parsed || typeof parsed !== "object") throw new Error("no-json");
  // Normalize id to number in case model returns it as a string
  if (typeof parsed.id === "string") parsed.id = parseInt(parsed.id, 10);
  if (typeof parsed.id !== "number" || isNaN(parsed.id) || typeof parsed.reason !== "string") throw new Error("bad-schema");
  return parsed;
}

async function readJsonOrText(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Don't dump raw HTML (Next.js error pages etc.) into the UI
    const isHtml = text.trimStart().startsWith("<!") || text.trimStart().startsWith("<html");
    return { error: isHtml ? `Server error (${res.status}) — please try again` : text || `Request failed (${res.status})` };
  }
}

function StreamingButtons({ artist, title }) {
  const query = encodeURIComponent(`${artist} ${title}`);
  const platforms = [
    {
      name: "Spotify",
      url: `https://open.spotify.com/search/${query}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      ),
    },
    {
      name: "Apple",
      url: `https://music.apple.com/search?term=${query}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      ),
    },
    {
      name: "YT Music",
      url: `https://music.youtube.com/search?q=${query}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
        </svg>
      ),
    },
    {
      name: "Tidal",
      url: `https://listen.tidal.com/search?q=${query}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004 4.004-4.004 4.004 4.004 4.004-4.004zM8.008 16.004l4.004-4.004 4.004 4.004 4.004-4.004-4.004-4.004-4.004 4.004-4.004-4.004-4.004 4.004z"/>
        </svg>
      ),
    },
  ];
  return (
    <div>
      <div className="text-xs text-stone-500 mb-1.5">Play on</div>
      <div className="grid grid-cols-4 gap-2">
        {platforms.map(({ name, url, icon }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center py-2.5 rounded-xl border border-stone-700/60 text-stone-400 hover:bg-white hover:text-stone-900 hover:border-white/80 transition-colors"
          >
            {icon}
          </a>
        ))}
      </div>
    </div>
  );
}

// Genre-based audio profile estimates (used when Spotify audio-features are unavailable)
// loudness is normalized from dB: (dB + 30) / 27, clamped [0,1]
// e.g. -3 dB (very loud) ≈ 1.0 · -14 dB (typical) ≈ 0.59 · -30 dB (very dynamic) ≈ 0.0
const GENRE_AUDIO_PROFILES = {
  "Electronic":       { energy: 0.82, valence: 0.58, danceability: 0.78, acousticness: 0.05, tempo: 128, loudness: 0.89 },
  "House":            { energy: 0.86, valence: 0.64, danceability: 0.87, acousticness: 0.02, tempo: 124, loudness: 0.89 },
  "Techno":           { energy: 0.88, valence: 0.48, danceability: 0.84, acousticness: 0.02, tempo: 132, loudness: 0.93 },
  "Ambient":          { energy: 0.28, valence: 0.45, danceability: 0.25, acousticness: 0.75, tempo: 80,  loudness: 0.37 },
  "Jazz":             { energy: 0.44, valence: 0.58, danceability: 0.55, acousticness: 0.72, tempo: 108, loudness: 0.59 },
  "Classical":        { energy: 0.34, valence: 0.52, danceability: 0.28, acousticness: 0.92, tempo: 96,  loudness: 0.19 },
  "Metal":            { energy: 0.92, valence: 0.38, danceability: 0.55, acousticness: 0.05, tempo: 148, loudness: 0.85 },
  "Punk":             { energy: 0.90, valence: 0.55, danceability: 0.65, acousticness: 0.05, tempo: 168, loudness: 0.81 },
  "Rock":             { energy: 0.76, valence: 0.54, danceability: 0.60, acousticness: 0.15, tempo: 120, loudness: 0.78 },
  "Alternative Rock": { energy: 0.72, valence: 0.48, danceability: 0.57, acousticness: 0.18, tempo: 118, loudness: 0.78 },
  "Indie Rock":       { energy: 0.65, valence: 0.50, danceability: 0.58, acousticness: 0.25, tempo: 116, loudness: 0.74 },
  "Pop":              { energy: 0.68, valence: 0.70, danceability: 0.72, acousticness: 0.20, tempo: 120, loudness: 0.85 },
  "Hip Hop":          { energy: 0.70, valence: 0.55, danceability: 0.80, acousticness: 0.15, tempo: 90,  loudness: 0.81 },
  "R&B":              { energy: 0.60, valence: 0.60, danceability: 0.74, acousticness: 0.30, tempo: 95,  loudness: 0.78 },
  "Soul":             { energy: 0.62, valence: 0.66, danceability: 0.70, acousticness: 0.40, tempo: 100, loudness: 0.70 },
  "Funk":             { energy: 0.78, valence: 0.72, danceability: 0.82, acousticness: 0.15, tempo: 104, loudness: 0.74 },
  "Blues":            { energy: 0.52, valence: 0.48, danceability: 0.58, acousticness: 0.55, tempo: 88,  loudness: 0.67 },
  "Country":          { energy: 0.56, valence: 0.65, danceability: 0.62, acousticness: 0.55, tempo: 112, loudness: 0.70 },
  "Folk":             { energy: 0.42, valence: 0.58, danceability: 0.45, acousticness: 0.78, tempo: 96,  loudness: 0.59 },
  "Reggae":           { energy: 0.58, valence: 0.72, danceability: 0.78, acousticness: 0.30, tempo: 80,  loudness: 0.74 },
  "Latin":            { energy: 0.72, valence: 0.78, danceability: 0.84, acousticness: 0.22, tempo: 100, loudness: 0.81 },
  "Disco":            { energy: 0.80, valence: 0.78, danceability: 0.88, acousticness: 0.08, tempo: 116, loudness: 0.78 },
  "Dance":            { energy: 0.84, valence: 0.68, danceability: 0.86, acousticness: 0.05, tempo: 126, loudness: 0.89 },
};

function estimateFeaturesFromRecord(record) {
  const genreStr = (record.genre || "").toLowerCase();
  const styleStr = (record.style || record.styles || "").toLowerCase();
  const combined = genreStr + " " + styleStr;
  const match = Object.entries(GENRE_AUDIO_PROFILES).find(([key]) => combined.includes(key.toLowerCase()));
  const base = match ? { ...match[1] } : { energy: 0.60, valence: 0.55, danceability: 0.60, acousticness: 0.40, tempo: 105, loudness: 0.70 };
  // Older records skew more acoustic
  const year = record.year_original || record.year_pressed;
  if (year && year < 1965) base.acousticness = Math.min(1, base.acousticness + 0.2);
  else if (year && year >= 1990) base.acousticness = Math.max(0, base.acousticness - 0.08);
  return base;
}

const SEASON_GENRES = {
  winter: ["Jazz", "Blues", "Classical", "Ambient", "Soul", "R&B"],
  spring: ["Folk", "Funk", "Pop", "Indie", "Country", "Afrobeat"],
  summer: ["Reggae", "Dance", "Electronic", "Latin", "Rock", "Hip Hop", "Ska"],
  fall:   ["Folk", "Country", "Americana", "Blues", "Rock", "Jazz", "Soul"],
};

function getSeason(month) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

function buildTodayHook(myRecords, lastPlayedDates, playCounts, spotifyFeatures = {}, artistMembers = {}, todayWeather = null, playSessions = [], lastfmVibeData = null) {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay   = today.getDate();
  const todayYear  = today.getFullYear();
  const todayDow   = today.getDay(); // 0=Sun … 6=Sat
  const now = Date.now();

  // Hooks 1a, 1b, 2: only skip if played in the last 2 days (today or yesterday)
  const notPlayedVeryRecently = (r) => {
    const last = lastPlayedDates[r.id];
    if (!last) return true;
    return (now - new Date(last).getTime()) / 86400000 >= 2;
  };

  // All other hooks: skip if played in the last 14 days
  const notRecentlyPlayed = (r) => {
    const last = lastPlayedDates[r.id];
    if (!last) return true;
    return (now - new Date(last).getTime()) / 86400000 >= 14;
  };

  // ±1 day window helpers (handles month boundaries)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
  function dayLabel(month, day) {
    if (month === todayMonth && day === todayDay) return "today";
    if (month === (yesterday.getMonth() + 1) && day === yesterday.getDate()) return "yesterday";
    return "tomorrow";
  }
  function withinDayWindow(month, day) {
    return (
      (month === todayMonth && day === todayDay) ||
      (month === (yesterday.getMonth() + 1) && day === yesterday.getDate()) ||
      (month === (tomorrow.getMonth() + 1)  && day === tomorrow.getDate())
    );
  }

  // ±3 day window for release anniversary (handles year boundaries)
  function withinNarrowWindow(releaseMonth, releaseDay) {
    for (const yr of [todayYear - 1, todayYear, todayYear + 1]) {
      const d = new Date(yr, releaseMonth - 1, releaseDay);
      if (Math.abs(now - d.getTime()) / 86400000 <= 3) return true;
    }
    return false;
  }

  // ─── Main hooks (1a, 1b, 2): collect all that fire, then pick randomly ──────
  // Each hook builds a candidate result. At the end we pick one at random so
  // birthday / death / release anniversary each get equal chance on days when
  // more than one applies. If none fire, we fall through to the lower hooks.
  const mainHookCandidates = [];
  const isVA = (a) => /^various(\s+artists?)?$/i.test((a || "").trim());

  // ─── Hook 1a: Artist or band member birthday ±1 day ──────────────────────
  {
    const soloBirthday = myRecords.filter(
      (r) => !isVA(r.artist) && withinDayWindow(r.artist_birth_month, r.artist_birth_day)
    ).filter(notPlayedVeryRecently);

    const memberBirthday = myRecords.filter((r) => {
      const members = artistMembers[r.artist] || [];
      return members.some((m) => withinDayWindow(m.birth_month, m.birth_day));
    }).filter(notPlayedVeryRecently);

    const allBirthday = [...soloBirthday, ...memberBirthday];
    if (allBirthday.length > 0) {
      const pick = allBirthday[Math.floor(Math.random() * allBirthday.length)];
      const isSolo = soloBirthday.includes(pick);
      if (isSolo) {
        const when = dayLabel(pick.artist_birth_month, pick.artist_birth_day);
        const years = pick.artist_birth_year ? todayYear - pick.artist_birth_year : null;
        const deceased = !!pick.artist_death_year;
        mainHookCandidates.push({
          type: "birthday",
          record: pick,
          fact: years
            ? deceased
              ? `${pick.artist} would have turned ${years} today (${when}). They passed in ${pick.artist_death_year}.`
              : `${pick.artist} turns ${years} today — their birthday is ${when}.`
            : `${pick.artist}'s birthday is ${when}.`,
        });
      } else {
        const member = (artistMembers[pick.artist] || []).find(
          (m) => withinDayWindow(m.birth_month, m.birth_day)
        );
        const when = dayLabel(member.birth_month, member.birth_day);
        const years = member?.birth_year ? todayYear - member.birth_year : null;
        const deceased = !!member?.death_year;
        mainHookCandidates.push({
          type: "birthday",
          record: pick,
          fact: years
            ? deceased
              ? `${member.name} of ${pick.artist} would have turned ${years} today (${when}). They passed in ${member.death_year}.`
              : `${member.name} of ${pick.artist} turns ${years} today — their birthday is ${when}.`
            : `${member.name} of ${pick.artist}'s birthday is ${when}.`,
        });
      }
    }
  }

  // ─── Hook 1b: Artist or band member death anniversary ±1 day ─────────────
  {
    const soloDeath = myRecords.filter(
      (r) => !isVA(r.artist) && withinDayWindow(r.artist_death_month, r.artist_death_day)
    ).filter(notPlayedVeryRecently);

    const memberDeath = myRecords.filter((r) => {
      const members = artistMembers[r.artist] || [];
      return members.some((m) => withinDayWindow(m.death_month, m.death_day));
    }).filter(notPlayedVeryRecently);

    const allDeath = [...soloDeath, ...memberDeath];
    if (allDeath.length > 0) {
      const pick = allDeath[Math.floor(Math.random() * allDeath.length)];
      const isSolo = soloDeath.includes(pick);
      if (isSolo) {
        const when = dayLabel(pick.artist_death_month, pick.artist_death_day);
        const years = pick.artist_death_year ? todayYear - pick.artist_death_year : null;
        mainHookCandidates.push({
          type: "death",
          record: pick,
          fact: years
            ? `${pick.artist} passed away ${years} years ago — the anniversary is ${when}.`
            : `${pick.artist}'s passing anniversary is ${when}.`,
        });
      } else {
        const member = (artistMembers[pick.artist] || []).find(
          (m) => withinDayWindow(m.death_month, m.death_day)
        );
        const when = dayLabel(member.death_month, member.death_day);
        const years = member?.death_year ? todayYear - member.death_year : null;
        mainHookCandidates.push({
          type: "death",
          record: pick,
          fact: years
            ? `${member.name} of ${pick.artist} passed away ${years} years ago — the anniversary is ${when}.`
            : `${member.name} of ${pick.artist}'s passing anniversary is ${when}.`,
        });
      }
    }
  }

  // ─── Hook 2: Release anniversary ─────────────────────────────────────────
  {
    const MILESTONE_YEARS = new Set([10, 15, 20, 25, 30, 40, 50, 60, 75, 100]);

    const exactDay = myRecords.filter((r) => {
      if (!r.release_day || r.release_day === 0) return false;
      if (!r.release_month) return false;
      const releaseYear = r.year_original || r.year_pressed;
      if (!releaseYear || todayYear - releaseYear < 10) return false;
      return withinNarrowWindow(r.release_month, r.release_day);
    }).filter(notPlayedVeryRecently);

    if (exactDay.length > 0) {
      exactDay.sort((a, b) => (b.year_original || b.year_pressed || 0) - (a.year_original || a.year_pressed || 0));
      const pick = exactDay[Math.floor(Math.random() * Math.min(3, exactDay.length))];
      const age = todayYear - (pick.year_original || pick.year_pressed);
      mainHookCandidates.push({
        type: "anniversary",
        record: pick,
        fact: `"${pick.title}" by ${pick.artist} was released ${age} years ago today.`,
      });
    } else {
      // Month-only fallback — must be a milestone year, ±7 days from the 1st
      const monthMatch = myRecords.filter((r) => {
        if (!r.release_month) return false;
        const releaseYear = r.year_original || r.year_pressed;
        if (!releaseYear) return false;
        const age = todayYear - releaseYear;
        if (!MILESTONE_YEARS.has(age)) return false;
        // Only fire in the first 7 days of the release month
        if (r.release_month !== todayMonth) return false;
        return todayDay <= 7;
      }).filter(notPlayedVeryRecently);

      if (monthMatch.length > 0) {
        monthMatch.sort((a, b) => {
          const ageA = todayYear - (a.year_original || a.year_pressed);
          const ageB = todayYear - (b.year_original || b.year_pressed);
          return ageB - ageA;
        });
        const topAge = todayYear - (monthMatch[0].year_original || monthMatch[0].year_pressed);
        const topTier = monthMatch.filter(r => todayYear - (r.year_original || r.year_pressed) === topAge);
        const pick = topTier[Math.floor(Math.random() * topTier.length)];
        const age = todayYear - (pick.year_original || pick.year_pressed);
        mainHookCandidates.push({
          type: "anniversary",
          record: pick,
          fact: `"${pick.title}" by ${pick.artist} turns ${age} this month.`,
        });
      }
    }
  }

  // ─── Collect strong hooks: main candidates + recent vibe match ────────────
  const strongHooks = [...mainHookCandidates];

  // Priority 3: Recent vibe match (Last.fm)
  // Uses recently-played artists as seeds to find a similar record in-collection
  // not played in 14+ days. Fires for all users (no Spotify required).
  if (lastfmVibeData?.map?.size > 0) {
    const candidates = myRecords
      .filter(notRecentlyPlayed)
      .map((r) => {
        const key = stripArtistNum(r.artist || "").toLowerCase().trim();
        const score = lastfmVibeData.map.get(key) || 0;
        return { record: r, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const pool = candidates.slice(0, 5);
      const { record } = pool[Math.floor(Math.random() * pool.length)];
      const seedNames = (lastfmVibeData.seeds || []).slice(0, 2).join(" and ");
      strongHooks.push({
        type: "recent_vibe",
        record,
        fact: seedNames
          ? `"${record.title}" by ${record.artist} is in the same sonic neighborhood as ${seedNames}, which you've been spinning lately.`
          : `"${record.title}" by ${record.artist} sounds like what you've been playing lately.`,
      });
    }
  }

  // Return all strong hooks (up to 4) — caller caches and serves probabilistically
  if (strongHooks.length > 0) return strongHooks.slice(0, 4);

  // ─── Priority 4: Weather match ────────────────────────────────────────────
  // Matches the current weather mood to audio features via Spotify data.
  // Requires location to be set and at least 5 records with features.
  {
    const WEATHER_TARGETS = {
      "upbeat":      { valence: 0.75, energy: 0.75, acousticness: 0.20 },
      "crisp":       { valence: 0.60, energy: 0.65, acousticness: 0.30 },
      "mellow":      { valence: 0.55, energy: 0.45, acousticness: 0.50 },
      "atmospheric": { valence: 0.45, energy: 0.35, acousticness: 0.75 },
      "melancholic": { valence: 0.30, energy: 0.35, acousticness: 0.65 },
      "cozy":        { valence: 0.55, energy: 0.30, acousticness: 0.80 },
      "intense":     { valence: 0.35, energy: 0.85, acousticness: 0.10 },
    };
    const target = todayWeather?.mood ? WEATHER_TARGETS[todayWeather.mood] : null;
    const featureCount = Object.keys(spotifyFeatures).length;
    if (target && featureCount >= 5) {
      const scored = myRecords
        .filter(notRecentlyPlayed)
        .map((r) => {
          const f = spotifyFeatures[r.id];
          if (!f) return null;
          const score =
            (1 - Math.abs(f.valence      - target.valence))      * 0.4 +
            (1 - Math.abs(f.energy       - target.energy))       * 0.4 +
            (1 - Math.abs(f.acousticness - target.acousticness)) * 0.2;
          return { record: r, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        const pick = scored[Math.floor(Math.random() * Math.min(5, scored.length))].record;
        const weatherLabel = todayWeather.label?.toLowerCase() || "today's weather";
        return [{
          type: "weather",
          record: pick,
          fact: `"${pick.title}" by ${pick.artist} is a perfect match for the ${weatherLabel}.`,
        }];
      }
    }
  }

  // ─── Priority 5: Day-of-week energy match ────────────────────────────────
  {
    const featureCount = Object.keys(spotifyFeatures).length;
    if (featureCount >= 5) {
      const isWeekend = todayDow === 0 || todayDow === 6;
      const isFriday  = todayDow === 5;
      const isSunday  = todayDow === 0;
      const scored = myRecords
        .filter(notRecentlyPlayed)
        .map((r) => {
          const f = spotifyFeatures[r.id];
          if (!f) return null;
          let score = 0;
          if (isFriday)       score = f.energy * 0.5 + f.danceability * 0.5;
          else if (isSunday)  score = f.acousticness * 0.5 + (1 - f.energy) * 0.3 + f.valence * 0.2;
          else if (isWeekend) score = f.valence * 0.4 + f.danceability * 0.3 + f.energy * 0.3;
          else                score = f.valence * 0.4 + f.energy * 0.3 + (1 - f.acousticness) * 0.3;
          return { record: r, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        const pick = scored[Math.floor(Math.random() * Math.min(5, scored.length))].record;
        const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][todayDow];
        const vibeLabel = isFriday ? "high-energy Friday listen" : isSunday ? "relaxed Sunday listen" : isWeekend ? "weekend mood" : "mid-week listen";
        return [{
          type: "vibe",
          record: pick,
          fact: `"${pick.title}" by ${pick.artist} fits the ${dayName} ${vibeLabel} perfectly.`,
        }];
      }
    }
  }

  // ─── Priority 6: Season-appropriate genre ────────────────────────────────
  {
    const season = getSeason(todayMonth);
    const preferredGenres = SEASON_GENRES[season];
    const seasonal = myRecords
      .filter(notRecentlyPlayed)
      .filter((r) => {
        const g = (r.genre || "").toLowerCase();
        const s = (r.style || "").toLowerCase();
        return preferredGenres.some((pg) => g.includes(pg.toLowerCase()) || s.includes(pg.toLowerCase()));
      });
    if (seasonal.length > 0) {
      const pool = [...seasonal].sort(() => Math.random() - 0.5).slice(0, 8);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const seasonLabel = season.charAt(0).toUpperCase() + season.slice(1);
      return [{
        type: "seasonal",
        record: pick,
        fact: `"${pick.title}" by ${pick.artist} has exactly the kind of sound that fits a ${seasonLabel} day.`,
      }];
    }
  }

  // ─── Priority 7: Played this day last year (±3 days) ─────────────────────
  {
    const lastYearToday = new Date(todayYear - 1, todayMonth - 1, todayDay);
    const seenIds = new Set();
    const playedLastYear = playSessions
      .filter((s) => Math.abs(new Date(s.played_at) - lastYearToday) / 86400000 <= 3)
      .map((s) => myRecords.find((r) => String(r.id) === String(s.record_id)))
      .filter(Boolean)
      .filter((r) => { if (seenIds.has(r.id)) return false; seenIds.add(r.id); return true; })
      .filter(notRecentlyPlayed);

    if (playedLastYear.length > 0) {
      const pick = playedLastYear[Math.floor(Math.random() * playedLastYear.length)];
      return [{
        type: "memory",
        record: pick,
        fact: `You played "${pick.title}" by ${pick.artist} around this time last year.`,
      }];
    }
  }

  // ─── Priority 8: Round-year milestone (≥10 years, divisible by 5) ────────
  {
    const milestoneRecords = myRecords
      .filter((r) => {
        const yr = r.year_original || r.year_pressed;
        if (!yr) return false;
        const age = todayYear - yr;
        return age >= 10 && age % 5 === 0;
      })
      .filter(notRecentlyPlayed);

    if (milestoneRecords.length > 0) {
      milestoneRecords.sort((a, b) => {
        const ageA = todayYear - (a.year_original || a.year_pressed);
        const ageB = todayYear - (b.year_original || b.year_pressed);
        const scoreA = ageA % 25 === 0 ? 3 : ageA % 10 === 0 ? 2 : 1;
        const scoreB = ageB % 25 === 0 ? 3 : ageB % 10 === 0 ? 2 : 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return ageB - ageA;
      });
      const topAge = todayYear - (milestoneRecords[0].year_original || milestoneRecords[0].year_pressed);
      const topScoreVal = topAge % 25 === 0 ? 3 : topAge % 10 === 0 ? 2 : 1;
      const topTier = milestoneRecords.filter((r) => {
        const age = todayYear - (r.year_original || r.year_pressed);
        const s = age % 25 === 0 ? 3 : age % 10 === 0 ? 2 : 1;
        return s === topScoreVal;
      });
      const pick = topTier[Math.floor(Math.random() * topTier.length)];
      const age = todayYear - (pick.year_original || pick.year_pressed);
      return [{
        type: "milestone",
        record: pick,
        fact: `"${pick.title}" by ${pick.artist} turns ${age} this year — a milestone worth celebrating.`,
      }];
    }
  }

  // ─── Priority 9: Beloved-but-forgotten (played before, silent 90+ days) ──
  {
    const staleCandidates = myRecords
      .filter((r) => {
        const last = lastPlayedDates[r.id];
        if (!last) return false;
        return (now - new Date(last).getTime()) / 86400000 >= 90;
      })
      .sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0));

    if (staleCandidates.length > 0) {
      const pool = staleCandidates.slice(0, 10);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const daysSince = Math.floor((now - new Date(lastPlayedDates[pick.id]).getTime()) / 86400000);
      const plays = playCounts[pick.id] || 0;
      return [{
        type: "stale",
        record: pick,
        fact: plays > 1
          ? `You've played "${pick.title}" by ${pick.artist} ${plays} times, but not in ${daysSince} days.`
          : `You haven't played "${pick.title}" by ${pick.artist} in ${daysSince} days.`,
      }];
    }
  }

  return [];
}

// ─── CompareView ────────────────────────────────────────────────────────────
function CompareView({ recordA, recordB, featuresA, featuresB, playCountA, playCountB, lastPlayedA, lastPlayedB, collection, onToggleForSale, onOpenRecord, onClose }) {
  const [pickerQuery, setPickerQuery] = useState("");
  const [entered, setEntered] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);

  const isPickerMode = !recordB;

  const filtered = isPickerMode
    ? (collection || [])
        .filter(r => r.id !== recordA?.id && (
          (r.title || "").toLowerCase().includes(pickerQuery.toLowerCase()) ||
          (r.artist || "").toLowerCase().includes(pickerQuery.toLowerCase())
        ))
        .slice(0, 40)
    : [];

  function fmtLastPlayed(d) {
    if (!d) return null;
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return `${days}d ago`;
  }

  function RecordCol({ record, features, playCount, lastPlayed, side }) {
    const f = features || estimateFeaturesFromRecord(record);
    const isEst = !features;
    const accentA = "#f59e0b"; // amber
    const accentB = "#2dd4bf"; // teal
    const accent = side === "A" ? accentA : accentB;
    return (
      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
        {/* Cover art — tappable to open detail */}
        <button onClick={() => onOpenRecord(record)} className="rounded-xl overflow-hidden shrink-0 relative" style={{ width: 110, height: 110, border: `2px solid ${accent}40` }}>
          <CoverArt record={record} size={110} />
          {isEst && (
            <span style={{ position: "absolute", top: 3, right: 3, fontSize: 8, background: "rgba(0,0,0,0.6)", color: "#a8a29e", borderRadius: 3, padding: "1px 3px" }}>~</span>
          )}
        </button>
        {/* Title + artist */}
        <div className="w-full text-center px-1">
          <div className="text-amber-50 font-semibold leading-tight truncate" style={{ fontSize: 11 }}>{record.title}</div>
          <div className="text-stone-400 truncate" style={{ fontSize: 10 }}>{stripArtistNum(record.artist)}</div>
          {record.year_original && <div className="text-stone-600" style={{ fontSize: 9 }}>{record.year_original}</div>}
        </div>
        {/* Genre tags */}
        <div className="flex flex-wrap gap-1 justify-center px-1">
          {getGenres(record).slice(0, 3).map(g => (
            <span key={g} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "#78716c", border: "1px solid #44403c" }}>{g}</span>
          ))}
        </div>
        {/* Play count + last played */}
        <div className="text-center" style={{ fontSize: 9, color: "#57534e" }}>
          {playCount > 0 ? `${playCount} play${playCount !== 1 ? "s" : ""}` : "never played"}
          {lastPlayed && <span> · {fmtLastPlayed(lastPlayed)}</span>}
        </div>
        {/* BPM */}
        <div style={{ fontSize: 9, color: "#57534e" }}>~{Math.round(f.tempo || 120)} BPM</div>
        {/* Mark for sale */}
        <button
          onClick={() => onToggleForSale(record)}
          className={`w-full py-1.5 rounded-lg border text-center transition-colors`}
          style={{
            fontSize: 9,
            borderColor: record.for_sale ? "#be123c60" : "#3c3532",
            color: record.for_sale ? "#fda4af" : "#57534e",
            background: record.for_sale ? "rgba(190,18,60,0.12)" : "transparent",
          }}
        >{record.for_sale ? "✓ For Sale" : "Mark for sale"}</button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[260] flex flex-col"
      style={{
        background: "rgba(0,0,0,0.97)",
        transform: entered ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-3 shrink-0">
        <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-sm transition-colors">← Close</button>
        <span className="text-stone-600 text-xs uppercase tracking-widest">{isPickerMode ? "Pick a record to compare" : "Compare"}</span>
        <div className="w-16" />
      </div>

      {isPickerMode ? (
        // ── Picker mode ──
        <div className="flex-1 flex flex-col overflow-hidden px-4">
          {/* Selected record A preview */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: "#1c1917" }}>
            <div className="rounded-lg overflow-hidden shrink-0" style={{ width: 44, height: 44 }}>
              <CoverArt record={recordA} size={44} />
            </div>
            <div className="min-w-0">
              <div className="text-amber-50 truncate" style={{ fontSize: 12 }}>{recordA.title}</div>
              <div className="text-stone-500 truncate" style={{ fontSize: 10 }}>{stripArtistNum(recordA.artist)}</div>
            </div>
            <div className="text-amber-500/60 text-xs shrink-0">comparing…</div>
          </div>
          <input
            autoFocus
            value={pickerQuery}
            onChange={e => setPickerQuery(e.target.value)}
            placeholder="Search your crate…"
            className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-200 placeholder-stone-600 outline-none mb-3"
          />
          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.map(r => (
              <button
                key={r.id}
                onClick={() => onOpenRecord(r, true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.05] text-left transition-colors"
              >
                <div className="rounded-lg overflow-hidden shrink-0" style={{ width: 36, height: 36 }}>
                  <CoverArt record={r} size={36} />
                </div>
                <div className="min-w-0">
                  <div className="text-stone-200 truncate" style={{ fontSize: 12 }}>{r.title}</div>
                  <div className="text-stone-500 truncate" style={{ fontSize: 10 }}>{stripArtistNum(r.artist)}{r.year_original ? ` · ${r.year_original}` : ""}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // ── Comparison mode ──
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* Two column header */}
          <div className="flex gap-3 mb-5">
            <RecordCol record={recordA} features={featuresA} playCount={playCountA} lastPlayed={lastPlayedA} side="A" />
            <div className="w-px bg-stone-800/60 shrink-0 self-stretch" />
            <RecordCol record={recordB} features={featuresB} playCount={playCountB} lastPlayed={lastPlayedB} side="B" />
          </div>

          {/* Radar chart + pills */}
          {(() => {
            const fA = featuresA || estimateFeaturesFromRecord(recordA);
            const fB = featuresB || estimateFeaturesFromRecord(recordB);

            // 5 radar axes — order determines polygon shape (clockwise from top)
            const axes = [
              { label: "Energy",   vA: fA.energy ?? 0.5,       vB: fB.energy ?? 0.5 },
              { label: "Mood",     vA: fA.valence ?? 0.5,      vB: fB.valence ?? 0.5 },
              { label: "Dance",    vA: fA.danceability ?? 0.5, vB: fB.danceability ?? 0.5 },
              { label: "Acoustic", vA: fA.acousticness ?? 0.5, vB: fB.acousticness ?? 0.5 },
              { label: "Loud",     vA: fA.loudness ?? 0.70,    vB: fB.loudness ?? 0.70 },
            ];
            const N = axes.length;
            const CX = 110; const CY = 110; const R = 72;
            const labelR = R + 16;

            function pt(i, v) {
              const clamped = Math.min(1, Math.max(0, v));
              const angle = -Math.PI / 2 + (2 * Math.PI / N) * i;
              return [CX + clamped * R * Math.cos(angle), CY + clamped * R * Math.sin(angle)];
            }
            function polygon(vals, color) {
              const pts = vals.map((v, i) => pt(i, v).join(",")).join(" ");
              return <polygon points={pts} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.5} strokeOpacity={0.7} />;
            }

            // Descriptor pills — only for records with real Spotify features
            function getPills(f, hasReal) {
              if (!hasReal) return [];
              const p = [];
              if (f.energy > 0.7) p.push("High Energy");
              else if (f.energy < 0.4) p.push("Laid Back");
              if (f.valence > 0.6) p.push("Feel Good");
              else if (f.valence < 0.35) p.push("Melancholic");
              if (f.danceability > 0.65) p.push("Danceable");
              else if (f.danceability < 0.4) p.push("Headphone Music");
              return p;
            }
            const pillsA = getPills(fA, !!featuresA);
            const pillsB = getPills(fB, !!featuresB);

            return (
              <div className="mb-2">
                <div className="text-stone-600 text-xs uppercase tracking-widest text-center mb-2">Sound Profile</div>

                {/* SVG radar */}
                <div className="flex justify-center">
                  <svg width={220} height={220} viewBox="0 0 220 220">
                    {/* Grid rings */}
                    {[0.25, 0.5, 0.75, 1].map(t => (
                      <polygon key={t}
                        points={axes.map((_, i) => pt(i, t).join(",")).join(" ")}
                        fill="none" stroke="#292524" strokeWidth={1}
                      />
                    ))}
                    {/* Axis spokes */}
                    {axes.map((_, i) => {
                      const [x, y] = pt(i, 1);
                      return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#292524" strokeWidth={1} />;
                    })}
                    {/* Data polygons */}
                    {polygon(axes.map(a => a.vA), "#f59e0b")}
                    {polygon(axes.map(a => a.vB), "#2dd4bf")}
                    {/* Axis labels */}
                    {axes.map(({ label }, i) => {
                      const angle = -Math.PI / 2 + (2 * Math.PI / N) * i;
                      const lx = CX + labelR * Math.cos(angle);
                      const ly = CY + labelR * Math.sin(angle);
                      return (
                        <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                          fill="#78716c" fontSize={8}>{label}</text>
                      );
                    })}
                  </svg>
                </div>

                {/* Tempo + legend */}
                <div className="flex items-center gap-2 mt-1 mb-3">
                  <div className="flex-1 text-right" style={{ fontSize: 10, color: "#f59e0b99" }}>{Math.round(fA.tempo || 120)} BPM</div>
                  <div className="text-stone-700 shrink-0 text-center" style={{ fontSize: 9, width: 52 }}>Tempo</div>
                  <div className="flex-1 text-left" style={{ fontSize: 10, color: "#2dd4bf99" }}>{Math.round(fB.tempo || 120)} BPM</div>
                </div>
                <div className="flex justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#f59e0b" }} />
                    <span className="text-stone-500 truncate" style={{ fontSize: 9, maxWidth: 100 }}>{recordA.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500 truncate" style={{ fontSize: 9, maxWidth: 100 }}>{recordB.title}</span>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#2dd4bf" }} />
                  </div>
                </div>

                {/* Descriptor pills — only shown when real Spotify data exists */}
                {(pillsA.length > 0 || pillsB.length > 0) && (
                  <div className="flex gap-3 pt-3 border-t border-stone-800/40">
                    <div className="flex-1 flex flex-wrap gap-1 justify-start">
                      {pillsA.map(p => (
                        <span key={p} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 99, background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.25)" }}>{p}</span>
                      ))}
                    </div>
                    <div className="flex-1 flex flex-wrap gap-1 justify-end">
                      {pillsB.map(p => (
                        <span key={p} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 99, background: "rgba(45,212,191,0.1)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.25)" }}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function PlayTrailView({ centerRecord, suggestions, loading, error, history, collection, searchOpen, searchQuery, onNavigate, onSearchChange, onToggleSearch, onClose, onMinimize, playCounts, savePrompt, saving, onSaveSession, onDiscardSession, onRefresh }) {
  const CENTER = 140;
  const SLOT = 100;
  const GAP = 18;

  const directions = [
    { key: "windDown", label: "cool off",    offsetX: -(SLOT + GAP), offsetY: (CENTER - SLOT) / 2, color: "#60a5fa" },
    { key: "liftUp",  label: "turn it up", offsetX: CENTER + GAP,    offsetY: (CENTER - SLOT) / 2, color: "#f87171" },
    { key: "sideways",label: "left turn",  offsetX: (CENTER - SLOT) / 2, offsetY: -(SLOT + GAP),  color: "#a78bfa" },
  ];

  const filteredSearch = searchQuery
    ? collection.filter(r =>
        (r.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.artist || "").toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: "rgba(0,0,0,0.96)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4 shrink-0">
        <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-sm flex items-center gap-1.5 transition-colors">
          ← Close
        </button>
        <span className="text-stone-600 text-xs uppercase tracking-widest">Your Session</span>
        <div className="flex items-center gap-3">
          {onRefresh && !loading && suggestions && (
            <button onClick={onRefresh} className="text-stone-500 hover:text-stone-300 transition-colors" title="Shuffle suggestions">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/><path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14"/></svg>
            </button>
          )}
          <button onClick={onMinimize} className="text-stone-500 hover:text-stone-300 transition-colors" title="Minimize session">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M19 15l-7 7-7-7"/></svg>
          </button>
        </div>
      </div>

      {/* History strip */}
      {history.length > 1 && (
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {history.map((r, i) => (
              <div key={`${r.id}-${i}`} className="flex items-center gap-1.5 shrink-0">
                {i > 0 && <span className="text-stone-700 text-xs">→</span>}
                <div
                  className={`rounded-lg overflow-hidden border-2 transition-colors ${i === history.length - 1 ? "border-amber-500/70" : "border-stone-700/50"}`}
                  style={{ width: 32, height: 32 }}
                >
                  <CoverArt record={r} size={32} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trail map */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Error */}
        {error && (
          <div className="text-red-400/70 text-sm text-center px-8">{error}</div>
        )}

        {!error && (
          <div className="relative" style={{ width: CENTER, height: CENTER }}>
            {/* Center record */}
            <div className="rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-2xl"
              style={{ width: CENTER, height: CENTER, boxShadow: "0 0 40px rgba(180,120,30,0.3)" }}>
              <CoverArt record={centerRecord} size={CENTER} />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)",
                display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 8,
              }}>
                <p style={{ color: "#fef3c7", fontSize: 10, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{centerRecord.title}</p>
                <p style={{ color: "#a8a29e", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripArtistNum(centerRecord.artist)}</p>
              </div>
            </div>

            {/* Directional slots */}
            {directions.map(({ key, label, offsetX, offsetY, color }) => {
              const suggestion = suggestions?.[key];
              const rec = suggestion?.record;
              const isLoading = loading && !suggestions;
              if (!isLoading && suggestions && !rec && key !== "sideways") return null;
              const isSideways = key === "sideways";
              return (
                <div
                  key={key}
                  style={{ position: "absolute", left: offsetX, top: offsetY, width: SLOT }}
                >
                  {/* Direction label — always above */}
                  <div style={{
                    position: "absolute",
                    fontSize: 14, fontFamily: "'Fraunces', serif", fontWeight: 700, letterSpacing: "0.02em",
                    color, opacity: 0.85, whiteSpace: "nowrap",
                    bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                  }}>
                    {label}
                  </div>

                  {/* Art box */}
                  <div style={{ width: SLOT, height: SLOT, position: "relative" }}>
                    {isLoading ? (
                      <div className="rounded-xl w-full h-full animate-pulse" style={{ background: "#1c1917" }} />
                    ) : rec ? (
                      <button
                        onClick={() => onNavigate(rec)}
                        className="rounded-xl overflow-hidden w-full h-full relative transition-transform hover:scale-105 active:scale-95"
                        style={{ border: `1.5px solid ${color}40`, boxShadow: `0 4px 20px rgba(0,0,0,0.6)` }}
                      >
                        <CoverArt record={rec} size={SLOT} />
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)",
                          display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 5,
                        }}>
                          {suggestion.estimated && (
                            <span style={{ position: "absolute", top: 4, right: 4, fontSize: 8, color: "#a8a29e", opacity: 0.7, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "1px 3px" }}>~</span>
                          )}
                          <p style={{ color: "#fef3c7", fontSize: 8, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</p>
                          <p style={{ color: "#a8a29e", fontSize: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripArtistNum(rec.artist)}</p>
                        </div>
                      </button>
                    ) : (
                      <div className="rounded-xl w-full h-full flex items-center justify-center" style={{ background: "#1c1917", border: "1px dashed #3c3532" }}>
                        <span className="text-stone-700 text-xs">?</span>
                      </div>
                    )}

                    {/* Detour: explanation pills to the right of art */}
                    {isSideways && rec && suggestion?.explanation?.length > 0 && (
                      <div style={{ position: "absolute", left: SLOT + 8, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 2 }}>
                        {suggestion.explanation.map(pill => (
                          <span key={pill} style={{ fontSize: 9, color, opacity: 0.9, background: "rgba(0,0,0,0.55)", borderRadius: 3, padding: "2px 4px", whiteSpace: "nowrap" }}>{pill}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Wind down / lift up: explanation pills below art */}
                  {!isSideways && rec && suggestion?.explanation?.length > 0 && (
                    <div style={{ paddingTop: 4, display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                      {suggestion.explanation.map(pill => (
                        <span key={pill} style={{ fontSize: 9, color, opacity: 0.9, background: "rgba(0,0,0,0.55)", borderRadius: 3, padding: "2px 4px", whiteSpace: "nowrap" }}>{pill}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* DOWN slot — custom pick */}
            <div style={{ position: "absolute", left: (CENTER - SLOT) / 2, top: CENTER + GAP, width: SLOT }}>
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", fontSize: 14, fontFamily: "'Fraunces', serif", fontWeight: 700, letterSpacing: "0.02em", color: "#78716c", whiteSpace: "nowrap" }}>
                your pick
              </div>
              {searchOpen ? (
                <div className="absolute z-10" style={{ bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", width: 220 }}>
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Search your crate..."
                    className="w-full bg-stone-900 border border-stone-600 rounded-xl px-3 py-2 text-sm text-stone-200 placeholder-stone-600 outline-none mb-1"
                  />
                  <div className="bg-stone-900 rounded-xl overflow-hidden border border-stone-800">
                    {filteredSearch.map(r => (
                      <button key={r.id} onClick={() => onNavigate(r)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] text-left transition-colors">
                        <CoverArt record={r} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="text-stone-200 text-xs truncate">{r.title}</div>
                          <div className="text-stone-600 text-[10px] truncate">{stripArtistNum(r.artist)}</div>
                        </div>
                      </button>
                    ))}
                    {searchQuery && filteredSearch.length === 0 && (
                      <div className="text-stone-700 text-xs text-center py-3">No matches</div>
                    )}
                  </div>
                </div>
              ) : null}
              <button
                onClick={onToggleSearch}
                className="rounded-xl w-full flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                style={{ height: SLOT, background: "#1c1917", border: "1.5px dashed #44403c" }}
              >
                <span className="text-stone-500 text-2xl leading-none">+</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center pb-6 text-stone-600 text-xs">Finding next records…</div>
      )}

      {/* Save session prompt overlay */}
      {savePrompt && (
        <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }}>
          <div className="flex flex-col h-full px-5 pt-12 pb-8">
            <div className="text-stone-500 text-xs uppercase tracking-widest mb-1">Session complete</div>
            <div className="text-amber-50 text-2xl mb-4" style={{ fontFamily: "'Fraunces',serif" }}>
              Save this listening session?
            </div>
            {/* Record list */}
            <div className="flex-1 overflow-y-auto space-y-1 mb-4">
              {history.map((rec, i) => (
                <div key={`${rec.id}-${i}`} className="flex items-center gap-3 px-2.5 py-2 rounded-xl">
                  <CoverArt record={rec} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-amber-50 text-sm truncate" style={{ fontFamily: "'Fraunces',serif" }}>{rec.title}</div>
                    <div className="text-stone-500 text-xs truncate">{rec.artist}</div>
                  </div>
                  {i === 0 && (
                    <span className="text-stone-600 text-[10px] shrink-0">start</span>
                  )}
                </div>
              ))}
            </div>
            <div className="text-stone-600 text-xs text-center mb-4">{history.length} record{history.length !== 1 ? "s" : ""}</div>
            <div className="flex gap-3">
              <button
                onClick={onDiscardSession}
                className="flex-1 py-3 rounded-xl border border-stone-700 text-stone-400 text-sm hover:border-stone-600 hover:text-stone-300 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={onSaveSession}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border border-amber-800/60 bg-amber-900/20 text-amber-300 text-sm hover:bg-amber-900/40 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const GENRE_PROXIMITY = {
  "Rock": ["Alternative Rock", "Indie Rock", "Metal", "Punk", "Pop Rock", "Folk Rock"],
  "Jazz": ["Blues", "Soul", "Funk", "R&B", "Bossa Nova", "Latin Jazz"],
  "Electronic": ["House", "Techno", "Ambient", "Dance", "Synth-pop", "Electronica"],
  "Hip Hop": ["R&B", "Funk", "Soul", "Rap"],
  "Classical": ["Contemporary Classical", "Baroque", "Orchestral", "Chamber Music"],
  "Reggae": ["Dub", "Ska", "Dancehall"],
  "Folk": ["Country", "Americana", "Singer-Songwriter", "World"],
  "Pop": ["Synth-pop", "Indie Pop", "Dream Pop"],
};

function computeForceLayout(bubbles, width, height) {
  const PADDING = 8;
  // Init random positions
  const nodes = bubbles.map((b, i) => ({
    ...b,
    cx: PADDING + b.r + Math.random() * (width - b.r * 2 - PADDING * 2),
    cy: PADDING + b.r + Math.random() * (height - b.r * 2 - PADDING * 2),
    vx: 0, vy: 0,
  }));

  const labelSet = new Set(nodes.map(n => n.label));

  for (let iter = 0; iter < 80; iter++) {
    // Reset forces
    for (const n of nodes) { n.vx = 0; n.vy = 0; }

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.cx - b.cx, dy = a.cy - b.cy;
        const dist = Math.max(Math.hypot(dx, dy), 0.1);
        const minDist = a.r + b.r + 6;
        if (dist < minDist) {
          const force = (minDist - dist) * 0.3;
          const nx = dx / dist, ny = dy / dist;
          a.vx += nx * force; a.vy += ny * force;
          b.vx -= nx * force; b.vy -= ny * force;
        } else {
          const force = 800 / (dist * dist);
          const nx = dx / dist, ny = dy / dist;
          a.vx += nx * force; a.vy += ny * force;
          b.vx -= nx * force; b.vy -= ny * force;
        }
      }
    }

    // Center gravity (larger bubbles pulled stronger)
    const cx = width / 2, cy = height / 2;
    for (const n of nodes) {
      const dx = cx - n.cx, dy = cy - n.cy;
      const strength = 0.015 * Math.sqrt(n.count);
      n.vx += dx * strength;
      n.vy += dy * strength;
    }

    // Proximity attraction
    for (const [genre, relatives] of Object.entries(GENRE_PROXIMITY)) {
      const gNode = nodes.find(n => n.label === genre);
      if (!gNode) continue;
      for (const rel of relatives) {
        if (!labelSet.has(rel)) continue;
        const rNode = nodes.find(n => n.label === rel);
        if (!rNode) continue;
        const dx = rNode.cx - gNode.cx, dy = rNode.cy - gNode.cy;
        const dist = Math.max(Math.hypot(dx, dy), 0.1);
        const force = 0.04;
        gNode.vx += (dx / dist) * force * dist;
        gNode.vy += (dy / dist) * force * dist;
        rNode.vx -= (dx / dist) * force * dist;
        rNode.vy -= (dy / dist) * force * dist;
      }
    }

    // Apply velocities + clamp to boundary
    for (const n of nodes) {
      n.cx = Math.max(n.r + PADDING, Math.min(width - n.r - PADDING, n.cx + n.vx * 0.3));
      n.cy = Math.max(n.r + PADDING, Math.min(height - n.r - PADDING, n.cy + n.vy * 0.3));
    }
  }

  return nodes;
}

function computeStyleLayout(styleList, cx, cy, genreR, fullscreen) {
  if (styleList.length === 0) return [];
  const maxSCount = Math.max(...styleList.map(x => x.count), 1);
  const nodes = styleList.map((s, i) => {
    const sr = (fullscreen ? 14 : 9) + (fullscreen ? 18 : 12) * Math.sqrt(s.count / maxSCount);
    const angle = (i / styleList.length) * Math.PI * 2;
    const initR = genreR + sr + (fullscreen ? 40 : 26);
    return { ...s, sr, cx: cx + initR * Math.cos(angle), cy: cy + initR * Math.sin(angle), vx: 0, vy: 0 };
  });
  for (let iter = 0; iter < 60; iter++) {
    for (const n of nodes) { n.vx = 0; n.vy = 0; }
    // Repulsion between style bubbles
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.cx - b.cx, dy = a.cy - b.cy;
        const dist = Math.max(Math.hypot(dx, dy), 0.1);
        const minDist = a.sr + b.sr + 6;
        if (dist < minDist) {
          const force = (minDist - dist) * 0.4;
          const nx = dx / dist, ny = dy / dist;
          a.vx += nx * force; a.vy += ny * force;
          b.vx -= nx * force; b.vy -= ny * force;
        } else {
          const force = 300 / (dist * dist);
          const nx = dx / dist, ny = dy / dist;
          a.vx += nx * force; a.vy += ny * force;
          b.vx -= nx * force; b.vy -= ny * force;
        }
      }
    }
    // Orbital attraction — each style settles at a ring proportional to its size
    for (const n of nodes) {
      const dx = n.cx - cx, dy = n.cy - cy;
      const dist = Math.max(Math.hypot(dx, dy), 0.1);
      const targetR = genreR + n.sr + (fullscreen ? 28 : 18);
      const diff = dist - targetR;
      n.vx -= (dx / dist) * diff * 0.07;
      n.vy -= (dy / dist) * diff * 0.07;
    }
    for (const n of nodes) {
      n.cx += n.vx * 0.4;
      n.cy += n.vy * 0.4;
    }
  }
  return nodes;
}

function GenreBubbleMapInner({ items, styleItems, onBubbleClick, onStyleClick, fullscreen = false }) {
  const [containerWidth, setContainerWidth] = useState(fullscreen && typeof window !== "undefined" ? window.innerWidth : 320);
  const [expandedGenre, setExpandedGenre] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!fullscreen && ref.current) setContainerWidth(ref.current.clientWidth);
    if (fullscreen) {
      const update = () => setContainerWidth(window.innerWidth);
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
  }, [fullscreen]);

  const width = containerWidth;
  const height = fullscreen
    ? Math.max(400, window.innerHeight - 140)
    : Math.max(220, Math.min(380, items.length * 18));

  const maxCount = Math.max(...items.map(i => i.count), 1);
  const MAX_R = fullscreen ? Math.min(width * 0.12, 80) : Math.min(width * 0.18, 60);
  const MIN_R = fullscreen ? 22 : 16;

  // Genre bubbles
  const bubbles = useMemo(() => {
    return [...items]
      .sort((a, b) => b.count - a.count)
      .map(item => ({ ...item, r: MIN_R + (MAX_R - MIN_R) * Math.sqrt(item.count / maxCount) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, width, fullscreen]);

  const placed = useMemo(() => {
    if (bubbles.length === 0) return [];
    return computeForceLayout(bubbles, width, height);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbles]);

  // Style bubbles — same force layout as genres, computed when a genre is expanded
  const currentStyleList = expandedGenre ? (styleItems?.[expandedGenre] || []) : [];
  const styleMaxCount = Math.max(...currentStyleList.map(i => i.count), 1);

  const styleBubbles = useMemo(() => {
    if (!expandedGenre || currentStyleList.length === 0) return [];
    return [...currentStyleList]
      .sort((a, b) => b.count - a.count)
      .map(item => ({ ...item, r: MIN_R + (MAX_R - MIN_R) * Math.sqrt(item.count / styleMaxCount) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedGenre, currentStyleList.length, width, fullscreen]);

  const stylePlaced = useMemo(() => {
    if (styleBubbles.length === 0) return [];
    return computeForceLayout(styleBubbles, width, height);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleBubbles]);

  function renderGenreBubbles() {
    return placed.map(b => {
      const { fill, stroke, text } = genreSvgColor(b.label);
      const showLabel = b.r >= 22;
      const showCount = b.r >= 18;
      const hasStyles = (styleItems?.[b.label] || []).length > 0;
      return (
        <g key={b.label}
          onClick={(e) => {
            e.stopPropagation();
            if (hasStyles) setExpandedGenre(b.label);
            else onBubbleClick(b.label);
          }}
          style={{ cursor: "pointer" }}
        >
          <circle cx={b.cx} cy={b.cy} r={b.r} fill={fill} stroke={stroke} strokeWidth={1.5} />
          {showLabel && (
            <text x={b.cx} y={b.cy - (showCount ? 7 : 0)} textAnchor="middle"
              dominantBaseline="middle" fill={text} fontSize={Math.max(9, b.r * 0.32)}
              style={{ pointerEvents: "none", userSelect: "none" }}>
              {b.label.length > 12 ? b.label.slice(0, 11) + "…" : b.label}
            </text>
          )}
          {showCount && (
            <text x={b.cx} y={b.cy + (showLabel ? 11 : 0)} textAnchor="middle"
              dominantBaseline="middle" fill={text} fontSize={Math.max(8, b.r * 0.26)}
              opacity={0.7} style={{ pointerEvents: "none", userSelect: "none" }}>
              {b.count}
            </text>
          )}
        </g>
      );
    });
  }

  function renderStyleBubbles() {
    return stylePlaced.map(b => {
      const { fill, stroke, text } = genreSvgColor(b.label);
      const showLabel = b.r >= 22;
      const showCount = b.r >= 18;
      return (
        <g key={b.label}
          onClick={(e) => { e.stopPropagation(); onStyleClick?.(b.label, expandedGenre); }}
          style={{ cursor: "pointer" }}
        >
          <circle cx={b.cx} cy={b.cy} r={b.r} fill={fill} stroke={stroke} strokeWidth={1.5} />
          {showLabel && (
            <text x={b.cx} y={b.cy - (showCount ? 7 : 0)} textAnchor="middle"
              dominantBaseline="middle" fill={text} fontSize={Math.max(9, b.r * 0.32)}
              style={{ pointerEvents: "none", userSelect: "none" }}>
              {b.label.length > 12 ? b.label.slice(0, 11) + "…" : b.label}
            </text>
          )}
          {showCount && (
            <text x={b.cx} y={b.cy + (showLabel ? 11 : 0)} textAnchor="middle"
              dominantBaseline="middle" fill={text} fontSize={Math.max(8, b.r * 0.26)}
              opacity={0.7} style={{ pointerEvents: "none", userSelect: "none" }}>
              {b.count}
            </text>
          )}
        </g>
      );
    });
  }

  return (
    <div ref={ref} className="w-full h-full relative">
      {expandedGenre && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setExpandedGenre(null)}
            className="text-xs px-2.5 py-1 rounded-full border border-stone-700 text-stone-400 hover:text-amber-300 transition-colors"
          >
            ← {expandedGenre}
          </button>
          <span className="text-stone-600 text-xs">{currentStyleList.length} styles · tap to filter</span>
        </div>
      )}
      <svg width={width} height={height} onClick={() => expandedGenre && setExpandedGenre(null)} style={{ display: "block" }}>
        {expandedGenre ? renderStyleBubbles() : renderGenreBubbles()}
      </svg>
    </div>
  );
}

function GenreBubbleMap({ items, styleItems, onBubbleClick, onStyleClick }) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return (
    <div className="w-full relative">
      {/* Enlarge button */}
      <button
        onClick={() => setFullscreen(true)}
        className="absolute top-0 right-0 z-10 text-stone-600 hover:text-amber-400 transition-colors p-1"
        title="Expand map"
        style={{ lineHeight: 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
        </svg>
      </button>

      <GenreBubbleMapInner
        items={items}
        styleItems={styleItems}
        onBubbleClick={onBubbleClick}
        onStyleClick={onStyleClick}
      />

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <span className="text-stone-400 text-sm font-medium tracking-wide">Collection Map</span>
            <button
              onClick={() => setFullscreen(false)}
              className="text-stone-500 hover:text-amber-400 transition-colors text-lg leading-none px-2"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <GenreBubbleMapInner
              items={items}
              styleItems={styleItems}
              onBubbleClick={(g) => { onBubbleClick(g); setFullscreen(false); }}
              onStyleClick={(s, parentGenre) => { onStyleClick(s, parentGenre); setFullscreen(false); }}
              fullscreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RadarChart({ myData, theirData, myLabel, theirLabel }) {
  const cx = 100, cy = 105, R = 68;
  const keys  = ["energy", "valence", "danceability", "acousticness", "loudness"];
  const labels = ["Energy", "Mood", "Dance", "Acoustic", "Loudness"];
  const n = keys.length;
  const angle = (k) => -Math.PI / 2 + (k * 2 * Math.PI) / n;
  const pt = (k, v) => { const c = Math.min(1, Math.max(0, v)); return [cx + c * R * Math.cos(angle(k)), cy + c * R * Math.sin(angle(k))]; };
  const poly = (data) => keys.map((key, k) => pt(k, data?.[key] ?? 0).join(",")).join(" ");
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 200 210" className="w-full max-w-[200px] mx-auto">
      {/* Background grid */}
      {gridLevels.map(level => (
        <polygon key={level}
          points={keys.map((_, k) => pt(k, level).join(",")).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {keys.map((_, k) => (
        <line key={k}
          x1={cx} y1={cy}
          x2={pt(k, 1)[0]} y2={pt(k, 1)[1]}
          stroke="rgba(255,255,255,0.07)" strokeWidth="1"
        />
      ))}
      {/* Their polygon */}
      {theirData && (
        <polygon points={poly(theirData)}
          fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.55)" strokeWidth="1.5"
        />
      )}
      {/* My polygon */}
      {myData && (
        <polygon points={poly(myData)}
          fill="rgba(217,119,6,0.12)" stroke="rgba(217,119,6,0.55)" strokeWidth="1.5"
        />
      )}
      {/* Axis labels */}
      {labels.map((label, k) => {
        const [x, y] = pt(k, 1.28);
        return (
          <text key={k} x={x} y={y}
            textAnchor="middle" dominantBaseline="middle"
            fill="rgba(120,113,108,0.9)" fontSize="8.5"
          >{label}</text>
        );
      })}
      {/* Legend */}
      <circle cx={18} cy={200} r={3} fill="rgba(217,119,6,0.7)" />
      <text x={24} y={200} dominantBaseline="middle" fill="rgba(120,113,108,0.8)" fontSize="7.5">{myLabel}</text>
      {theirLabel && <>
        <circle cx={90} cy={200} r={3} fill="rgba(14,165,233,0.7)" />
        <text x={96} y={200} dominantBaseline="middle" fill="rgba(120,113,108,0.8)" fontSize="7.5">{theirLabel}</text>
      </>}
    </svg>
  );
}

const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

// Parse "M:SS" or "H:MM:SS" duration strings from a Discogs tracklist and sum to total seconds
function parseDurationSecs(tracklist) {
  let total = 0;
  for (const t of tracklist || []) {
    if (!t.duration) continue;
    const parts = t.duration.split(":").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) total += parts[0] * 60 + parts[1];
    else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) total += parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return total > 0 ? total : null;
}

function groupPlaySessions(playSessions, collection) {
  const chronological = [...playSessions].reverse();
  const groups = [];
  let current = null;
  for (const play of chronological) {
    const t = new Date(play.played_at).getTime();
    if (!current || t - current.lastTime > SESSION_GAP_MS) {
      current = { plays: [play], startTime: t, lastTime: t };
      groups.push(current);
    } else {
      current.plays.push(play);
      current.lastTime = t;
    }
  }
  return groups.reverse().map(g => {
    const records = g.plays
      .map(p => collection?.find(r => String(r.id) === String(p.record_id)))
      .filter(Boolean);
    const unique = [...new Map(records.map(r => [r.id, r])).values()];
    const genreCounts = {};
    for (const r of unique) {
      for (const genre of (r.genres || r.genre?.split(',').map(s => s.trim()) || [])) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }
    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const durationMins = Math.round((g.lastTime - g.startTime) / 60000);
    // Compute actual listening time: album duration × play count per record
    const playCounts = {};
    for (const play of g.plays) playCounts[play.record_id] = (playCounts[play.record_id] || 0) + 1;
    const allHaveDuration = unique.length > 0 && unique.every(r => r.duration_secs > 0);
    const listeningSecs = allHaveDuration
      ? unique.reduce((sum, r) => sum + r.duration_secs * (playCounts[r.id] || 1), 0)
      : null;
    return {
      id: `session-${g.startTime}`,
      plays: [...g.plays].reverse(),
      records: unique,
      startTime: g.startTime,
      playCount: g.plays.length,
      durationMins,
      listeningSecs,
      topGenre,
    };
  });
}

function sessionDateLabel(t) {
  const d = new Date(t);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatListeningTime(secs) {
  const m = Math.round(secs / 60);
  if (m < 1) return null;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  return `${h}h${rem > 0 ? ` ${rem}m` : ""}`;
}

function sessionDurationLabel(playCount, listeningSecs) {
  const countStr = playCount === 1 ? "1 record" : `${playCount} records`;
  const timeStr = listeningSecs != null ? formatListeningTime(listeningSecs) : null;
  return timeStr ? `${countStr} · ${timeStr}` : countStr;
}

// ─── Crate Story canvas generator ────────────────────────────────────────────

function loadImgForCanvas(url) {
  if (!url) return Promise.resolve(null);
  const proxied = `/api/proxy-image?url=${encodeURIComponent(url)}`;
  return new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 6000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = proxied;
  });
}

function canvasRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Renders all tiles to an offscreen canvas and returns it.
// Replicates the CSS Grid dense layout (TOTAL_UNITS=4 columns) so the export
// matches what the user sees in the app.
// mode: "full" = entire collection tall image | "square" = 1:1, all records, adaptive columns
async function generateTileExport(records, playCounts, mode = "full") {
  await document.fonts.ready;

  const GAP = 3;
  const PADDING = 8;
  const TARGET = 1080; // export resolution

  // --- compute tile sizes (percentile-based, same as TileView) ---
  const tiles = computeTileSizes(records, playCounts);

  // Square mode: choose COLS so the grid is naturally ~square.
  // Total grid cells = Σ(units²). A square grid needs COLS² ≈ totalCells → COLS ≈ √totalCells.
  // Full mode: fixed 4 columns (tall portrait, like the app).
  const totalCells = tiles.reduce((sum, t) => sum + t.units * t.units, 0);
  const COLS = mode === "square"
    ? Math.max(4, Math.ceil(Math.sqrt(totalCells)))
    : 4;

  const UNIT = Math.floor((TARGET - PADDING * 2 - GAP * (COLS - 1)) / COLS);

  // --- simulate CSS Grid dense auto-placement ---
  const occupied = [];
  function isFree(startRow, startCol, span) {
    if (startCol + span > COLS) return false;
    for (let r = startRow; r < startRow + span; r++) {
      for (let c = startCol; c < startCol + span; c++) {
        if (occupied[r]?.[c]) return false;
      }
    }
    return true;
  }
  function occupy(startRow, startCol, span) {
    for (let r = startRow; r < startRow + span; r++) {
      if (!occupied[r]) occupied[r] = [];
      for (let c = startCol; c < startCol + span; c++) {
        occupied[r][c] = true;
      }
    }
  }

  // Sort largest tiles first so they fill the top; 1x tiles flow to the bottom,
  // meaning any incomplete final row only leaves a gap in the bottom-right corner.
  const sortedTiles = [...tiles].sort((a, b) => b.units - a.units);

  const placements = [];
  let cursor = { row: 0, col: 0 };
  for (const tile of sortedTiles) {
    const span = tile.units;
    let placed = false;
    outer: for (let row = 0; row < cursor.row + span + 1; row++) {
      for (let col = 0; col <= COLS - span; col++) {
        if (isFree(row, col, span)) {
          occupy(row, col, span);
          placements.push({ tile, row, col });
          if (row > cursor.row || (row === cursor.row && col >= cursor.col)) {
            cursor = { row, col: col + span >= COLS ? row + span : row, col2: col + span };
          }
          placed = true;
          break outer;
        }
      }
    }
    if (!placed) {
      const row = occupied.length || 0;
      occupy(row, 0, span);
      placements.push({ tile, row, col: 0 });
    }
  }

  const totalRows = occupied.length;
  const W = COLS * UNIT + (COLS - 1) * GAP + PADDING * 2;
  // Square: canvas is W×W (COLS ≈ totalRows so the grid fills it naturally).
  // Full: canvas height matches actual content.
  const H = mode === "square"
    ? W
    : totalRows * UNIT + (totalRows - 1) * GAP + PADDING * 2;
  const visiblePlacements = placements; // all records always included

  // --- load all images ---
  const imgMap = new Map();
  await Promise.all(visiblePlacements.map(async ({ tile }) => {
    if (imgMap.has(tile.record.id)) return;
    const url = _artCache.get(tile.record.id) || tile.record.thumb || null;
    const img = await loadImgForCanvas(url);
    imgMap.set(tile.record.id, img);
  }));

  // --- draw ---
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0c0b09";
  ctx.fillRect(0, 0, W, H);

  for (const { tile, row, col } of visiblePlacements) {
    const { record, units, plays } = tile;
    const px = PADDING + col * (UNIT + GAP);
    const py = PADDING + row * (UNIT + GAP);
    const size = units * UNIT + (units - 1) * GAP;

    const primaryGenre = getGenres(record)[0] || "";
    const genreHex = getGenrePalette(primaryGenre).hex;
    const img = imgMap.get(record.id);

    // clip to rounded rect
    ctx.save();
    canvasRoundRect(ctx, px, py, size, size, 6);
    ctx.clip();

    // art or genre placeholder
    if (img) {
      ctx.drawImage(img, px, py, size, size);
    } else {
      ctx.fillStyle = `${genreHex}28`;
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = `${genreHex}60`;
      ctx.font = `${Math.round(size * 0.3)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("◇", px + size / 2, py + size / 2);
    }

    // gradient + title for large tiles
    // genre accent bar (left edge)
    ctx.fillStyle = `${genreHex}66`;
    ctx.fillRect(px, py, Math.round(size * 0.05), size);

    ctx.restore();
  }

  return canvas;
}

// Returns honeycomb positions sorted center-outward, matching HoneycombView layout
function honeycombPositions(count, BASE_SIZE) {
  const COL_STEP = BASE_SIZE * 0.76;
  const ROW_STEP = BASE_SIZE * 0.88;
  const CIRCLE_RADIUS = BASE_SIZE * 3.2;
  const RANGE = 6;
  const positions = [];
  for (let col = -RANGE; col <= RANGE; col++) {
    for (let row = -RANGE; row <= RANGE; row++) {
      const px = col * COL_STEP;
      const py = row * ROW_STEP + (((col % 2) + 2) % 2 === 1 ? ROW_STEP / 2 : 0);
      const dist = Math.hypot(px, py);
      if (dist <= CIRCLE_RADIUS) positions.push({ px, py, dist });
    }
  }
  positions.sort((a, b) => a.dist - b.dist);
  return positions.slice(0, count);
}

// ── Shared canvas helpers for share cards ────────────────────────────────────

async function loadCardLogo() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/icon-192.png';
  });
}

function drawCardGradient(ctx, W, H, topGenres) {
  const sortedGenres = [...topGenres].sort((a, b) => b.count - a.count);
  const genreSlice = sortedGenres.slice(0, 4);
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  if (genreSlice.length === 0) {
    bgGrad.addColorStop(0, '#1b1b2f');
    bgGrad.addColorStop(1, '#162447');
  } else {
    const total = genreSlice.reduce((s, g) => s + g.count, 0);
    let pos = 0;
    genreSlice.forEach(({ genre, count }, i) => {
      const [c0, c1] = getStoryGradient(genre);
      bgGrad.addColorStop(pos, c0);
      pos += count / total;
      if (i === genreSlice.length - 1) bgGrad.addColorStop(1, c1);
    });
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawCardFooter(ctx, W, H, logoImg, username) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, H - 136); ctx.lineTo(W - 80, H - 136); ctx.stroke();

  const LOGO = 76;
  const LX = 80, LY = H - 122;
  if (logoImg) {
    ctx.save();
    canvasRoundRect(ctx, LX, LY, LOGO, LOGO, 16);
    ctx.clip();
    ctx.drawImage(logoImg, LX, LY, LOGO, LOGO);
    ctx.restore();
  }

  const textX = LX + LOGO + 20;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.font = `700 44px "Fraunces", serif`;
  ctx.fillText('CrateMate', textX, LY + 44);
  if (username) {
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.font = `300 28px "DM Sans", sans-serif`;
    ctx.fillText(`@${username}`, textX, LY + 44 + 38);
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(2);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.font = `500 26px "DM Sans", sans-serif`;
  ctx.fillText(`${dd}/${mm}/${yy}`, W - 80, LY + 56);
  ctx.restore();
}

function drawCardShadow(ctx) {
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
}

function cap(s) { return (s || '').replace(/\b\w/g, c => c.toUpperCase()); }

// ── Collection Share Card ────────────────────────────────────────────────────

async function generateCollectionDNA(stats, username) {
  await document.fonts.ready;
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const logoImg = await loadCardLogo();
  const TX = 80;

  drawCardGradient(ctx, W, H, stats.topGenres);
  drawCardShadow(ctx);

  const sortedGenres = [...stats.topGenres].sort((a, b) => b.count - a.count);

  // ── HEADER ─────────────────────────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `900 96px "Fraunces", serif`;
  ctx.fillText('Your collection.', TX, 118);

  // Decade badge + genre pills
  const pillH = 46;
  let pillX = TX;
  const pillY = 150;
  ctx.font = `400 26px "DM Sans", sans-serif`;

  const topDecade = stats.topDecades[0]?.decade;
  if (topDecade) {
    const badgeText = `Mostly ${topDecade}s`;
    const bw = ctx.measureText(badgeText).width + 36;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    canvasRoundRect(ctx, pillX, pillY, bw, pillH, pillH / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    canvasRoundRect(ctx, pillX, pillY, bw, pillH, pillH / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText(badgeText, pillX + 18, pillY + 31);
    pillX += bw + 10;
  }
  for (const { genre } of sortedGenres.slice(0, 3)) {
    const hex = getGenrePalette(genre).hex;
    const tw = ctx.measureText(cap(genre)).width;
    const pillW = tw + 30;
    if (pillX + pillW > W - 80) break;
    ctx.fillStyle = hex + '30';
    canvasRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.fill();
    ctx.strokeStyle = hex + '55'; ctx.lineWidth = 1;
    canvasRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.stroke();
    ctx.fillStyle = hex; ctx.textAlign = 'left';
    ctx.fillText(cap(genre), pillX + 15, pillY + 30);
    pillX += pillW + 10;
  }

  // Username + record count + hours owned
  const SEC_GAP = 60; // consistent spacing between all sections
  let curY = pillY + pillH + 40;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `300 32px "DM Sans", sans-serif`;
  ctx.textAlign = 'left';
  let headerSub = username ? `@${username} · ` : '';
  headerSub += `${stats.totalRecords} records`;
  if (stats.totalOwnedLabel) headerSub += ` · ${stats.totalOwnedLabel} of music`;
  ctx.fillText(headerSub, TX, curY);
  curY += SEC_GAP;

  // ── Shared constants for record grids ──
  const REC_THUMB = 176;
  const REC_GAP = 11;
  const REC_ROW_H = REC_THUMB + 48;

  // ── GENRE BAR ──────────────────────────────────────────────────────────────
  if (stats.topGenres.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.font = `500 26px "DM Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('YOUR SOUND', TX, curY);
    curY += 36;

    const totalGenreCount = stats.topGenres.reduce((s, g) => s + g.count, 0);
    const barH = 54;
    const barW = W - 160;
    let barX = TX;

    for (const { genre, count } of stats.topGenres) {
      const segW = Math.round((count / totalGenreCount) * barW);
      if (segW < 1) continue;
      const hex = getGenrePalette(genre).hex;
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = hex;
      ctx.fillRect(barX, curY, segW, barH);
      if (segW > 90) {
        ctx.beginPath(); ctx.rect(barX, curY, segW, barH); ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = `500 22px "DM Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(cap(genre), barX + segW / 2, curY + 35);
      }
      ctx.restore();
      barX += segW;
    }
    curY += barH + SEC_GAP;
  }

  // ── FAVORITE ARTISTS (with record thumbnails) ─────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.font = `500 26px "DM Sans", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('FAVORITE ARTISTS', TX, curY);
  ctx.textAlign = 'right';
  ctx.fillText('RECORDS', W - TX, curY);
  curY += 50;

  // Load all artist record thumbnails in parallel
  const artistThumbsMap = {};
  const thumbPromises = [];
  for (const { artist, records: artistRecords } of stats.topArtists.slice(0, 5)) {
    const recs = (artistRecords || []).slice(0, 5);
    artistThumbsMap[artist] = [];
    for (const rec of recs) {
      const localIdx = artistThumbsMap[artist].length;
      thumbPromises.push(
        (rec.thumb ? loadImgForCanvas(rec.thumb) : Promise.resolve(null)).then(img => ({ artist, idx: localIdx, img }))
      );
      artistThumbsMap[artist].push(null);
    }
  }
  const thumbResults = await Promise.all(thumbPromises);
  for (const { artist, idx, img } of thumbResults) {
    if (artistThumbsMap[artist]) artistThumbsMap[artist][idx] = img;
  }

  const ARTIST_THUMB = 56;
  const ARTIST_THUMB_GAP = 6;
  for (const { artist } of stats.topArtists.slice(0, 5)) {
    if (curY > H - 480) break;
    const cleanName = artist.replace(/\s*\(\d+\)\s*$/, '').trim();
    ctx.fillStyle = '#fef3c7';
    // Auto-size to fit — accommodates long names like Creedence Clearwater Revival
    const thumbs = artistThumbsMap[artist] || [];
    const thumbsW = thumbs.length > 0 ? thumbs.length * (ARTIST_THUMB + ARTIST_THUMB_GAP) + 20 : 0;
    const maxNameW = W - TX * 2 - thumbsW;
    let artistFontSize = 48;
    ctx.font = `700 ${artistFontSize}px "Fraunces", serif`;
    while (ctx.measureText(cleanName).width > maxNameW && artistFontSize > 32) {
      artistFontSize -= 2;
      ctx.font = `700 ${artistFontSize}px "Fraunces", serif`;
    }
    ctx.textAlign = 'left';
    ctx.fillText(cleanName, TX, curY + 10);

    const thumbStartX = W - TX - (thumbs.length * (ARTIST_THUMB + ARTIST_THUMB_GAP) - ARTIST_THUMB_GAP);
    thumbs.forEach((img, ti) => {
      const ttx = thumbStartX + ti * (ARTIST_THUMB + ARTIST_THUMB_GAP);
      const tty = curY - 36;
      ctx.save();
      ctx.shadowColor = 'transparent';
      canvasRoundRect(ctx, ttx, tty, ARTIST_THUMB, ARTIST_THUMB, 8);
      ctx.clip();
      if (img) {
        ctx.drawImage(img, ttx, tty, ARTIST_THUMB, ARTIST_THUMB);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(ttx, tty, ARTIST_THUMB, ARTIST_THUMB);
      }
      ctx.restore();
    });

    curY += 74;
  }

  // ── FAVORITE RECORDS (by % hearted) — 2 rows of 5 ─────────────────────────
  if (stats.favoriteRecords && stats.favoriteRecords.length > 0) {
    curY += SEC_GAP - 14;
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.font = `500 26px "DM Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('FAVORITE RECORDS', TX, curY);
    curY += 36;

    const favs = stats.favoriteRecords.slice(0, 10);

    const thumbImgs = await Promise.all(
      favs.map(rec => rec.thumb ? loadImgForCanvas(rec.thumb) : Promise.resolve(null))
    );

    for (let row = 0; row < 2; row++) {
      const rowFavs = favs.slice(row * 5, row * 5 + 5);
      if (rowFavs.length === 0) break;
      const rowY = curY + row * (REC_ROW_H + 8);

      rowFavs.forEach((rec, i) => {
        const gi = row * 5 + i;
        const tx = TX + i * (REC_THUMB + REC_GAP);
        const ty = rowY;
        const img = thumbImgs[gi];
        ctx.save();
        ctx.shadowColor = 'transparent';
        canvasRoundRect(ctx, tx, ty, REC_THUMB, REC_THUMB, 14);
        ctx.clip();
        if (img) {
          ctx.drawImage(img, tx, ty, REC_THUMB, REC_THUMB);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(tx, ty, REC_THUMB, REC_THUMB);
        }
        ctx.restore();
        // Heart badge
        ctx.fillStyle = 'rgba(220,38,38,0.85)';
        canvasRoundRect(ctx, tx + REC_THUMB - 40, ty + REC_THUMB - 30, 36, 24, 8); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = `500 15px "DM Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`♥${rec.heartCount}`, tx + REC_THUMB - 22, ty + REC_THUMB - 13);
        // Title + artist below
        const titleStr = (rec.title || '').length > 15 ? rec.title.slice(0, 13) + '…' : rec.title;
        const artistStr = (rec.artist || '').replace(/\s*\(\d+\)\s*$/, '').trim();
        const artistShort = artistStr.length > 15 ? artistStr.slice(0, 13) + '…' : artistStr;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `500 18px "DM Sans", sans-serif`;
        ctx.fillText(titleStr, tx, ty + REC_THUMB + 20);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `300 16px "DM Sans", sans-serif`;
        ctx.fillText(artistShort, tx, ty + REC_THUMB + 38);
      });
    }

    const rows = Math.min(2, Math.ceil(favs.length / 5));
    curY += rows * (REC_ROW_H + 8);
  }

  // ── SOUND PROFILE (anchored above footer) ──────────────────────────────────
  if (stats.audioProfile) {
    const { energy, valence, danceability, acousticness, tempo } = stats.audioProfile;
    const bars = [
      { label: 'Energy', value: energy, color: 'rgba(217,119,6,0.7)' },
      { label: 'Mood', value: valence, color: 'rgba(225,29,72,0.6)' },
      { label: 'Dance', value: danceability, color: 'rgba(5,150,105,0.6)' },
      { label: 'Acoustic', value: acousticness, color: 'rgba(120,113,108,0.7)' },
    ];
    const barMaxW = W - TX * 2 - 160;
    const profileH = bars.length * 40 + (tempo ? 40 : 0) + 44;
    let py = H - 136 - 24 - profileH;
    if (py > curY + SEC_GAP) {
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.font = `500 26px "DM Sans", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('SOUND PROFILE', TX, py);
      py += 44;

      for (const { label, value, color } of bars) {
        const v = Math.min(1, Math.max(0, value));
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `400 26px "DM Sans", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(label, TX, py);
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        canvasRoundRect(ctx, TX + 160, py - 18, barMaxW, 20, 10); ctx.fill();
        ctx.fillStyle = color;
        canvasRoundRect(ctx, TX + 160, py - 18, Math.max(8, v * barMaxW), 20, 10); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.50)';
        ctx.font = `400 22px "DM Sans", sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(v * 100)}%`, W - TX, py);
        py += 40;
      }
      if (tempo) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `400 26px "DM Sans", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('Avg BPM', TX, py);
        ctx.fillStyle = 'rgba(255,255,255,0.50)';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(tempo)}`, W - TX, py);
      }
    }
  }

  drawCardFooter(ctx, W, H, logoImg, username);
  return canvas;
}

// ── Listening Share Card ─────────────────────────────────────────────────────

async function generateListeningDNA(stats, username) {
  await document.fonts.ready;
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const logoImg = await loadCardLogo();
  const TX = 80;
  const SEC_GAP = 60;
  const REC_THUMB = 176;
  const REC_GAP = 11;
  const REC_ROW_H = REC_THUMB + 48;

  drawCardGradient(ctx, W, H, stats.topGenres);
  drawCardShadow(ctx);

  // ── HEADER ─────────────────────────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `900 96px "Fraunces", serif`;
  ctx.fillText('Your listening.', TX, 118);

  // Personality pills
  const pillH = 46;
  let pillX = TX;
  const pillY = 150;
  ctx.font = `400 26px "DM Sans", sans-serif`;

  const pills = [];
  if (stats.streak >= 7) pills.push(stats.streak >= 30 ? 'True Obsessive' : stats.streak >= 14 ? 'Dedicated Listener' : 'Week Warrior');
  if (stats.weekendPlays > stats.weekdayPlays * 0.6) pills.push('Weekend Spinner');
  else if (stats.weekdayPlays > stats.weekendPlays * 3) pills.push('Weekday Grinder');
  if (stats.nightPlays > stats.dayPlays) pills.push('Night Owl');
  else if (stats.dayPlays > stats.nightPlays * 3) pills.push('Daytime Listener');
  if (stats.uniqueRecords > 0 && stats.totalPlays / stats.uniqueRecords < 1.5) pills.push('Explorer');
  else if (stats.uniqueRecords > 0 && stats.totalPlays / stats.uniqueRecords > 3) pills.push('Deep Listener');

  for (const label of pills.slice(0, 3)) {
    const tw = ctx.measureText(label).width;
    const pillW = tw + 30;
    if (pillX + pillW > W - 80) break;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    canvasRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    canvasRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText(label, pillX + 15, pillY + 31);
    pillX += pillW + 10;
  }

  // Subtitle
  let curY = pillY + pillH + 40;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `300 32px "DM Sans", sans-serif`;
  ctx.textAlign = 'left';
  let sub = username ? `@${username} · ` : '';
  sub += `${stats.totalPlays} plays`;
  if (stats.totalListeningLabel) sub += ` · ${stats.totalListeningLabel} listened`;
  ctx.fillText(sub, TX, curY);
  curY += SEC_GAP;

  // ── GENRE BAR (by play count) ──────────────────────────────────────────────
  if (stats.topGenres.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.font = `500 26px "DM Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('WHAT YOU SPIN', TX, curY);
    curY += 36;

    const totalGenreCount = stats.topGenres.reduce((s, g) => s + g.count, 0);
    const barH = 54;
    const barW = W - 160;
    let barX = TX;

    for (const { genre, count } of stats.topGenres) {
      const segW = Math.round((count / totalGenreCount) * barW);
      if (segW < 1) continue;
      const hex = getGenrePalette(genre).hex;
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = hex;
      ctx.fillRect(barX, curY, segW, barH);
      if (segW > 90) {
        ctx.beginPath(); ctx.rect(barX, curY, segW, barH); ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = `500 22px "DM Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(cap(genre), barX + segW / 2, curY + 35);
      }
      ctx.restore();
      barX += segW;
    }
    curY += barH + SEC_GAP;
  }

  // ── TOP ARTISTS (same layout as collection card) ──────────────────────────
  if (stats.topPlayedArtists.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.font = `500 26px "DM Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('TOP ARTISTS', TX, curY);
    ctx.textAlign = 'right';
    ctx.fillText('PLAYS', W - TX, curY);
    curY += 50;

    const artistThumbsMap = {};
    const thumbPromises = [];
    for (const { artist, records: artistRecords } of stats.topPlayedArtists.slice(0, 5)) {
      const recs = (artistRecords || []).slice(0, 5);
      artistThumbsMap[artist] = [];
      for (const rec of recs) {
        const localIdx = artistThumbsMap[artist].length;
        thumbPromises.push(
          (rec.thumb ? loadImgForCanvas(rec.thumb) : Promise.resolve(null)).then(img => ({ artist, idx: localIdx, img }))
        );
        artistThumbsMap[artist].push(null);
      }
    }
    const thumbResults = await Promise.all(thumbPromises);
    for (const { artist, idx, img } of thumbResults) {
      if (artistThumbsMap[artist]) artistThumbsMap[artist][idx] = img;
    }

    const ARTIST_THUMB = 56;
    const ARTIST_THUMB_GAP = 6;
    for (const { artist, count } of stats.topPlayedArtists.slice(0, 5)) {
      if (curY > H - 600) break;
      const cleanName = artist.replace(/\s*\(\d+\)\s*$/, '').trim();
      ctx.fillStyle = '#fef3c7';
      // Auto-size to fit — leave room for play count + thumbnails
      const thumbs = artistThumbsMap[artist] || [];
      const thumbsW = thumbs.length > 0 ? thumbs.length * (ARTIST_THUMB + ARTIST_THUMB_GAP) + 20 : 0;
      const maxNameW = W - TX * 2 - thumbsW - 80; // 80 for play count
      let artistFontSize = 48;
      ctx.font = `700 ${artistFontSize}px "Fraunces", serif`;
      while (ctx.measureText(cleanName).width > maxNameW && artistFontSize > 32) {
        artistFontSize -= 2;
        ctx.font = `700 ${artistFontSize}px "Fraunces", serif`;
      }
      ctx.textAlign = 'left';
      ctx.fillText(cleanName, TX, curY + 10);
      // Play count next to name
      const nameW = ctx.measureText(cleanName).width;
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.font = `300 24px "DM Sans", sans-serif`;
      ctx.fillText(`${count}×`, TX + nameW + 14, curY + 6);

      // Record thumbnails on the right (thumbs already defined above for sizing)
      const thumbStartX = W - TX - (thumbs.length * (ARTIST_THUMB + ARTIST_THUMB_GAP) - ARTIST_THUMB_GAP);
      thumbs.forEach((img, ti) => {
        const ttx = thumbStartX + ti * (ARTIST_THUMB + ARTIST_THUMB_GAP);
        const tty = curY - 36;
        ctx.save();
        ctx.shadowColor = 'transparent';
        canvasRoundRect(ctx, ttx, tty, ARTIST_THUMB, ARTIST_THUMB, 8);
        ctx.clip();
        if (img) {
          ctx.drawImage(img, ttx, tty, ARTIST_THUMB, ARTIST_THUMB);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(ttx, tty, ARTIST_THUMB, ARTIST_THUMB);
        }
        ctx.restore();
      });

      curY += 74;
    }
  }

  // ── MOST PLAYED RECORDS — 2 rows × 5 ──────────────────────────────────────
  if (stats.topPlayed.length > 0) {
    curY += SEC_GAP - 14;
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.font = `500 26px "DM Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('MOST PLAYED', TX, curY);
    curY += 36;

    const recs = stats.topPlayed.slice(0, 10);

    const thumbImgs = await Promise.all(
      recs.map(({ record: r }) => r.thumb ? loadImgForCanvas(r.thumb) : Promise.resolve(null))
    );

    for (let row = 0; row < 2; row++) {
      const rowRecs = recs.slice(row * 5, row * 5 + 5);
      if (rowRecs.length === 0) break;
      const rowY = curY + row * (REC_ROW_H + 8);

      rowRecs.forEach(({ record: r, count }, i) => {
        const gi = row * 5 + i;
        const tx = TX + i * (REC_THUMB + REC_GAP);
        const ty = rowY;
        const img = thumbImgs[gi];
        ctx.save();
        ctx.shadowColor = 'transparent';
        canvasRoundRect(ctx, tx, ty, REC_THUMB, REC_THUMB, 14);
        ctx.clip();
        if (img) {
          ctx.drawImage(img, tx, ty, REC_THUMB, REC_THUMB);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(tx, ty, REC_THUMB, REC_THUMB);
        }
        ctx.restore();
        // Play count badge
        const countStr = `▷ ${count}`;
        ctx.font = `600 15px "DM Sans", sans-serif`;
        const badgeW = ctx.measureText(countStr).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.70)';
        canvasRoundRect(ctx, tx + REC_THUMB - badgeW - 4, ty + REC_THUMB - 28, badgeW, 22, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.90)';
        ctx.textAlign = 'center';
        ctx.fillText(countStr, tx + REC_THUMB - badgeW / 2 - 4, ty + REC_THUMB - 12);
        // Title + artist below
        const titleStr = (r.title || '').length > 15 ? r.title.slice(0, 13) + '…' : r.title;
        const artistStr = (r.artist || '').replace(/\s*\(\d+\)\s*$/, '').trim();
        const artistShort = artistStr.length > 15 ? artistStr.slice(0, 13) + '…' : artistStr;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `500 18px "DM Sans", sans-serif`;
        ctx.fillText(titleStr, tx, ty + REC_THUMB + 20);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `300 16px "DM Sans", sans-serif`;
        ctx.fillText(artistShort, tx, ty + REC_THUMB + 38);
      });
    }

    const rows = Math.min(2, Math.ceil(recs.length / 5));
    curY += rows * (REC_ROW_H + 8);
  }

  // ── SOUND PROFILE (play-weighted, anchored above footer) ───────────────────
  if (stats.playAudioProfile) {
    const { energy, valence, danceability, acousticness, tempo } = stats.playAudioProfile;
    const bars = [
      { label: 'Energy', value: energy, color: 'rgba(217,119,6,0.7)' },
      { label: 'Mood', value: valence, color: 'rgba(225,29,72,0.6)' },
      { label: 'Dance', value: danceability, color: 'rgba(5,150,105,0.6)' },
      { label: 'Acoustic', value: acousticness, color: 'rgba(120,113,108,0.7)' },
    ];
    const barMaxW = W - TX * 2 - 160;
    const profileH = bars.length * 40 + (tempo ? 40 : 0) + 44;
    let py = H - 136 - 24 - profileH;
    if (py > curY + SEC_GAP) {
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.font = `500 26px "DM Sans", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('SOUND PROFILE (BY PLAYS)', TX, py);
      py += 44;

      for (const { label, value, color } of bars) {
        const v = Math.min(1, Math.max(0, value));
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `400 26px "DM Sans", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(label, TX, py);
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        canvasRoundRect(ctx, TX + 160, py - 18, barMaxW, 20, 10); ctx.fill();
        ctx.fillStyle = color;
        canvasRoundRect(ctx, TX + 160, py - 18, Math.max(8, v * barMaxW), 20, 10); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.50)';
        ctx.font = `400 22px "DM Sans", sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(v * 100)}%`, W - TX, py);
        py += 40;
      }
      if (tempo) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `400 26px "DM Sans", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('Avg BPM', TX, py);
        ctx.fillStyle = 'rgba(255,255,255,0.50)';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(tempo)}`, W - TX, py);
      }
    }
  }

  drawCardFooter(ctx, W, H, logoImg, username);
  return canvas;
}

async function generateStoryCards(session, username) {
  await document.fonts.ready;
  const W = 1080, H = 1920;
  const records = session.records;

  const artCount = Math.min(records.length, 20);
  const artUrls = records.slice(0, artCount).map(r => (_artCache.get(r.id) || '') || r.thumb || null);
  const [imgs, logoImg] = await Promise.all([
    Promise.all(artUrls.map(loadImgForCanvas)),
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/icon-192.png';
    }),
  ]);

  // Genre analysis
  const genreCounts = {};
  records.forEach(r => getGenres(r).slice(0, 2).forEach(g => {
    if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
  }));
  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);

  // Multi-genre gradient: all session genres, top-left → bottom-right
  const gradientColors = sortedGenres.slice(0, 4).flatMap(([g]) => getStoryGradient(g));
  if (gradientColors.length === 0) gradientColors.push('#1b1b2f', '#162447');

  // Decade analysis
  const years = records.map(r => r.year_original || r.year_pressed).filter(Boolean).map(Number);
  const decadeCounts = {};
  years.forEach(y => { const d = Math.floor(y / 10) * 10; decadeCounts[d] = (decadeCounts[d] || 0) + 1; });
  const topDecade = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Session title
  const sd = new Date(session.startTime);
  const hr = sd.getHours();
  const timeOfDay = hr < 5 ? 'Night' : hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : hr < 21 ? 'Evening' : 'Night';
  const sessionTitle = `${sd.toLocaleDateString('en-US', { weekday: 'long' })} ${timeOfDay} Session`;

  function cap(s) { return (s || '').replace(/\b\w/g, c => c.toUpperCase()); }

  function drawBranding(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, H - 136); ctx.lineTo(W - 80, H - 136); ctx.stroke();

    const LOGO = 76;
    const LX = 80, LY = H - 122;

    if (logoImg) {
      ctx.save();
      canvasRoundRect(ctx, LX, LY, LOGO, LOGO, 16);
      ctx.clip();
      ctx.drawImage(logoImg, LX, LY, LOGO, LOGO);
      ctx.restore();
    }

    const textX = LX + LOGO + 20;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    ctx.font = `700 44px "Fraunces", serif`;
    ctx.fillText('CrateMate', textX, LY + 44);
    if (username) {
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.font = `300 28px "DM Sans", sans-serif`;
      ctx.fillText(`@${username}`, textX, LY + 44 + 38);
    }

    // Date — bottom-right, opposite CrateMate
    const dd = String(sd.getDate()).padStart(2, '0');
    const mm = String(sd.getMonth() + 1).padStart(2, '0');
    const yy = String(sd.getFullYear()).slice(-2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.font = `500 26px "DM Sans", sans-serif`;
    ctx.fillText(`${dd}/${mm}/${yy}`, W - 80, LY + 56);

    ctx.restore();
  }

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── 1. Multi-genre gradient background (top-left → bottom-right) ──
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  gradientColors.forEach((color, i) => {
    bgGrad.addColorStop(i / (gradientColors.length - 1), color);
  });
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 2. Header zone — clear space at top for title/decade/pills ──
  const HEADER_H = 270;

  // ── 3. Art wall — up to 6 tiles, "+N more" for overflow, never cropped ──
  const TILE_CAP = 6;
  const hasOverflow = artCount > TILE_CAP;
  const displayTiles = hasOverflow ? TILE_CAP : artCount; // always ≤ 6
  const overflowCount = artCount - (TILE_CAP - 1); // records hidden (shown as "+N")

  const cols = displayTiles <= 1 ? 1 : displayTiles <= 2 ? 2 : 3;
  const GAP = 6;
  const WALL_INSET = 12;
  const rawCell = Math.floor((W - 2 * WALL_INSET - GAP * (cols - 1)) / cols);
  const CELL = cols === 1 ? Math.min(rawCell, 520) : rawCell; // cap single-record art
  const BRANDING_H = 142;
  const isLong = artCount > 4;
  const MIN_TEXT_H = isLong ? 340 : 460;
  const maxWallBottom = H - BRANDING_H - MIN_TEXT_H;

  let tileIdx = 0, wallY = HEADER_H, actualWallBottom = HEADER_H;
  while (tileIdx < displayTiles) {
    if (wallY + CELL > maxWallBottom) break;
    for (let c = 0; c < cols && tileIdx < displayTiles; c++, tileIdx++) {
      const x = WALL_INSET + c * (CELL + GAP);
      const isPlusTile = hasOverflow && tileIdx === displayTiles - 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, wallY, CELL, CELL);
      ctx.clip();
      if (isPlusTile) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, wallY, CELL, CELL);
      } else if (imgs[tileIdx]) {
        ctx.drawImage(imgs[tileIdx], x, wallY, CELL, CELL);
      } else {
        ctx.fillStyle = getGenrePalette(getGenres(records[tileIdx])[0] || '').hex + '20';
        ctx.fillRect(x, wallY, CELL, CELL);
      }
      ctx.restore();
      if (isPlusTile) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = `300 56px "DM Sans", sans-serif`;
        ctx.fillText(`+${overflowCount}`, x + CELL / 2, wallY + CELL / 2 - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = `300 28px "DM Sans", sans-serif`;
        ctx.fillText('more', x + CELL / 2, wallY + CELL / 2 + 40);
      }
    }
    wallY += CELL + GAP;
    actualWallBottom = wallY;
  }

  // ── 4. Text panel fade — genre gradient shows through ──

  // Enable text shadow for all remaining draws — protects against bright genre gradients
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // ── 5. Session title + decade badge + genre pills in header zone ──
  const TX = 80;
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  // Auto-size title to fit — "Wednesday Afternoon Session" is the longest
  let titleFontSize = 78;
  ctx.font = `700 ${titleFontSize}px "Fraunces", serif`;
  while (ctx.measureText(sessionTitle).width > W - TX * 2 && titleFontSize > 48) {
    titleFontSize -= 2;
    ctx.font = `700 ${titleFontSize}px "Fraunces", serif`;
  }
  ctx.fillText(sessionTitle, TX, 112);

  // Decade badge + genre pills on the same row
  const pillH = 44;
  ctx.font = `400 24px "DM Sans", sans-serif`;
  let pillX = TX;
  const pillY = 142;

  if (topDecade) {
    const badgeText = `Mostly ${topDecade}s`;
    const bw = ctx.measureText(badgeText).width + 36;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    canvasRoundRect(ctx, pillX, pillY, bw, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    canvasRoundRect(ctx, pillX, pillY, bw, pillH, pillH / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText(badgeText, pillX + 18, pillY + 30);
    pillX += bw + 10;
  }

  // Genre pills on same row as decade
  for (const [genre] of sortedGenres.slice(0, 3)) {
    const hex = getGenrePalette(genre).hex;
    const tw = ctx.measureText(cap(genre)).width;
    const pillW = tw + 30;
    if (pillX + pillW > W - 80) break;
    ctx.fillStyle = hex + '30';
    canvasRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = hex + '55';
    ctx.lineWidth = 1;
    canvasRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.stroke();
    ctx.fillStyle = hex;
    ctx.textAlign = 'left';
    ctx.fillText(cap(genre), pillX + 15, pillY + 30);
    pillX += pillW + 10;
  }

  // ── 6. Text panel content ──
  const textBottom = H - BRANDING_H - 20;
  let ty = actualWallBottom + 62;
  const isSmall = artCount <= 2;
  const maxArtists = isLong ? 2 : isSmall ? 5 : 3;
  const maxTracksPerArtist = isLong ? 2 : isSmall ? 5 : 3;

  // Build hearted groups with vinyl position format (A2 · Dreams)
  const heartedGroups = records
    .map(r => ({
      artist: r.artist || '',
      tracks: (r.favorite_tracks || [])
        .map(ft => {
          const t = typeof ft === 'object' ? ft : { key: String(ft), title: String(ft) };
          const title = (t.title && t.title !== t.key) ? t.title : null;
          if (!title) return null;
          const pos = t.key && /^[A-Z]\d/i.test(String(t.key)) ? String(t.key).toUpperCase() : null;
          return pos ? `${pos} · ${title}` : title;
        })
        .filter(Boolean),
    }))
    .filter(g => g.tracks.length > 0);

  const mergedHearts = [];
  for (const g of heartedGroups) {
    const last = mergedHearts[mergedHearts.length - 1];
    if (last && last.artist === g.artist) last.tracks.push(...g.tracks);
    else mergedHearts.push({ artist: g.artist, tracks: [...g.tracks] });
  }

  ctx.textAlign = 'left';

  if (mergedHearts.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.font = `300 36px "DM Sans", sans-serif`;
    ctx.fillText('Fave tracks', TX, ty);
    ty += 72;

    for (const group of mergedHearts.slice(0, maxArtists)) {
      if (ty > textBottom - 120) break;
      ctx.fillStyle = '#fef3c7';
      ctx.font = `700 70px "Fraunces", serif`;
      const cleanArtist = group.artist.replace(/\s*\(\d+\)\s*$/, '').trim();
      ctx.fillText(cleanArtist.length > 26 ? cleanArtist.slice(0, 24) + '…' : cleanArtist, TX, ty);
      ty += 78;
      ctx.fillStyle = 'rgba(255,255,255,0.56)';
      ctx.font = `300 38px "DM Sans", sans-serif`;
      for (const track of group.tracks.slice(0, maxTracksPerArtist)) {
        if (ty > textBottom - 60) break;
        ctx.fillText(track.length > 28 ? track.slice(0, 26) + '…' : track, TX + 20, ty);
        ty += 50;
      }
      ty += 18;
    }
  } else {
    // Fallback — artists from the session
    const uniqueArtists = [...new Set(records.map(r => (r.artist || "").replace(/\s*\(\d+\)\s*$/, '').trim()).filter(Boolean))].slice(0, isSmall ? 5 : isLong ? 3 : 5);
    if (uniqueArtists.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.font = `300 36px "DM Sans", sans-serif`;
      ctx.fillText('Artists', TX, ty);
      ty += 72;
      ctx.fillStyle = '#fef3c7';
      ctx.font = `700 70px "Fraunces", serif`;
      for (const artist of uniqueArtists) {
        if (ty > textBottom - 80) break;
        ctx.fillText(artist.length > 26 ? artist.slice(0, 24) + '…' : artist, TX, ty);
        ty += 80;
      }
    }
  }

  // Duration (only if space remains)
  if (session.listeningSecs && ty < textBottom - 60) {
    ty += 14;
    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    ctx.font = `300 34px "DM Sans", sans-serif`;
    ctx.fillText(formatListeningTime(session.listeningSecs), TX, ty);
  }

  drawBranding(ctx);
  return [canvas];
}

// ─── Crate View Snapshot (tiles / honeycomb / grid) ──────────────────────────

async function generateCrateSnapshot(shape, records, username, playCounts) {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  await document.fonts.ready;

  // Background
  ctx.fillStyle = '#0c0b09';
  ctx.fillRect(0, 0, W, H);

  const PADDING = 6;
  const FOOTER_H = 90;
  const drawH = H - FOOTER_H;
  const maxRecords = Math.min(records.length, 80);
  const recs = records.slice(0, maxRecords);

  const artUrls = recs.map(r => (_artCache.get(r.id) || '') || r.thumb || null);
  const imgs = await Promise.all(artUrls.map(loadImgForCanvas));

  function drawRounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.closePath();
  }

  if (shape === 'tiles') {
    // Reproduce tile mosaic algorithm
    const TOTAL_UNITS = 4;
    const GAP = PADDING;
    const maxPlays = Math.max(...recs.map(r => playCounts[r.id] || 0), 1);
    const hasAnyPlays = recs.some(r => (playCounts[r.id] || 0) > 0);
    const tiles = recs.map((r, i) => {
      const plays = playCounts[r.id] || 0;
      let units;
      if (!hasAnyPlays) units = 1;
      else {
        const ratio = plays / maxPlays;
        if (ratio > 0.5) units = 3;
        else if (ratio > 0.15) units = 2;
        else units = 1;
      }
      return { record: r, img: imgs[i], units, plays };
    });
    // Lookahead row packing — eliminates gaps
    const rows = packTileRows(tiles, TOTAL_UNITS);

    const UNIT = (W - GAP * (TOTAL_UNITS - 1)) / TOTAL_UNITS;
    let y = 0;
    for (const row of rows) {
      const rowMaxUnits = Math.max(...row.map(t => t.units));
      const rowH = Math.round(rowMaxUnits * UNIT + (rowMaxUnits - 1) * GAP);
      if (y + rowH > drawH) break;
      let x = 0;
      for (const { record, img, units, plays } of row) {
        const tileSize = Math.round(units * UNIT + (units - 1) * GAP);
        const tileY = y + rowH - tileSize; // align bottom
        drawRounded(x, tileY, tileSize, tileSize, 4);
        ctx.save(); ctx.clip();
        if (img) {
          ctx.drawImage(img, x, tileY, tileSize, tileSize);
        } else {
          const pg = getGenrePalette(getGenres(record)[0] || '');
          ctx.fillStyle = pg.hex + '30';
          ctx.fillRect(x, tileY, tileSize, tileSize);
        }
        // gradient overlay for large tiles
        if (units >= 2) {
          const grd = ctx.createLinearGradient(x, tileY, x, tileY + tileSize);
          grd.addColorStop(0, 'rgba(0,0,0,0)');
          grd.addColorStop(0.5, 'rgba(0,0,0,0)');
          grd.addColorStop(1, 'rgba(0,0,0,0.75)');
          ctx.fillStyle = grd;
          ctx.fillRect(x, tileY, tileSize, tileSize);
          const pad = Math.round(tileSize * 0.06);
          ctx.fillStyle = '#fef3c7';
          ctx.font = `600 ${Math.round(tileSize * 0.09)}px "DM Sans", sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(record.title || '', x + pad, tileY + tileSize - pad - Math.round(tileSize * 0.075) - 4);
          ctx.fillStyle = '#a8a29e';
          ctx.font = `${Math.round(tileSize * 0.075)}px "DM Sans", sans-serif`;
          ctx.fillText(record.artist || '', x + pad, tileY + tileSize - pad);
        }
        // genre bar
        const pg = getGenrePalette(getGenres(record)[0] || '');
        ctx.fillStyle = pg.hex + '88';
        ctx.fillRect(x, tileY, Math.round(tileSize * 0.05), tileSize);
        // play badge
        if (plays > 0) {
          const badgeFs = Math.round(tileSize * 0.1);
          ctx.font = `${badgeFs}px "DM Sans", sans-serif`;
          const badgeTxt = `${plays}×`;
          const bw = ctx.measureText(badgeTxt).width + 12;
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          drawRounded(x + tileSize - bw - 6, tileY + 6, bw, badgeFs + 6, 6);
          ctx.fill();
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'right';
          ctx.fillText(badgeTxt, x + tileSize - 6 - 3, tileY + 6 + badgeFs);
        }
        ctx.restore();
        x += tileSize + GAP;
      }
      y += rowH + GAP;
    }

  } else {
    // Honeycomb or Grid — render as a tight grid of squares
    const cols = shape === 'grid' ? 4 : 5;
    const cellSize = Math.floor((W - GAP * (cols - 1)) / cols);
    const radius = shape === 'grid' ? 8 : 14;
    let idx = 0;
    let y = 0;
    while (idx < recs.length && y + cellSize <= drawH) {
      let x = 0;
      for (let c = 0; c < cols && idx < recs.length; c++, idx++) {
        const record = recs[idx];
        const img = imgs[idx];
        drawRounded(x, y, cellSize, cellSize, radius);
        ctx.save(); ctx.clip();
        if (img) {
          ctx.drawImage(img, x, y, cellSize, cellSize);
        } else {
          const pg = getGenrePalette(getGenres(record)[0] || '');
          ctx.fillStyle = pg.hex + '30';
          ctx.fillRect(x, y, cellSize, cellSize);
        }
        ctx.restore();
        x += cellSize + GAP;
      }
      y += cellSize + GAP;
    }
  }

  // Footer branding
  ctx.fillStyle = 'rgba(12,11,9,0.85)';
  ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.fillStyle = '#fbbf24';
  ctx.font = `700 34px "Fraunces", serif`;
  ctx.textAlign = 'left';
  ctx.fillText('CrateMate', 32, H - FOOTER_H + 42);
  ctx.fillStyle = '#a8a29e';
  ctx.font = `22px "DM Sans", sans-serif`;
  ctx.fillText(username ? `@${username}` : '', 32, H - FOOTER_H + 68);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#57534e';
  ctx.font = `20px "DM Sans", sans-serif`;
  ctx.fillText('cratemate.app', W - 32, H - FOOTER_H + 56);

  return canvas;
}

async function generateCrateStory(session, username) {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const records = session.records;
  const count = Math.min(records.length, 19);
  const isSingle = count === 1;

  // Background
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(0, 0, W, H);

  // Load covers via proxy (handles both Discogs and iTunes URLs)
  const artUrls = records.slice(0, count).map(r =>
    (_artCache.get(r.id) || '') || r.thumb || null
  );
  const imgs = await Promise.all(artUrls.map(loadImgForCanvas));

  // ── Session flow layout (shows play order, serpentine rows) ─────────────────
  const FLOW_COLS = isSingle ? 1 : count <= 2 ? 2 : count <= 6 ? 3 : 4;
  const GAP = isSingle ? 0 : 30;
  const BASE_SIZE = isSingle ? 600
    : count <= 2 ? 440
    : count <= 4 ? 360
    : count <= 6 ? 300
    : count <= 9 ? 260
    : 220;
  const FLOW_ROWS = Math.ceil(count / FLOW_COLS);
  const clusterH = FLOW_ROWS * BASE_SIZE + (FLOW_ROWS - 1) * GAP;

  // Build positions in session order, serpentine rows
  const positions = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / FLOW_COLS);
    const posInRow = i % FLOW_COLS;
    const itemsInRow = (row === FLOW_ROWS - 1) ? (count - row * FLOW_COLS) : FLOW_COLS;
    const col = (row % 2 === 0) ? posInRow : (itemsInRow - 1 - posInRow);
    const px = (col - (itemsInRow - 1) / 2) * (BASE_SIZE + GAP);
    const py = (row - (FLOW_ROWS - 1) / 2) * (BASE_SIZE + GAP);
    positions.push({ px, py });
  }

  const honeyCenterX = W / 2;
  const honeyCenterY = 180 + clusterH / 2;

  // Warm radial glow behind the cluster
  const glowR = Math.max(clusterH, BASE_SIZE * FLOW_COLS) * 0.85;
  const glow = ctx.createRadialGradient(honeyCenterX, honeyCenterY, 0, honeyCenterX, honeyCenterY, glowR);
  glow.addColorStop(0, 'rgba(50,32,10,0.65)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Draw connectors between consecutive covers (under covers)
  if (count > 1) {
    ctx.save();
    ctx.setLineDash([6, 16]);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 3;
    for (let i = 0; i < count - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.round(honeyCenterX + positions[i].px), Math.round(honeyCenterY + positions[i].py));
      ctx.lineTo(Math.round(honeyCenterX + positions[i + 1].px), Math.round(honeyCenterY + positions[i + 1].py));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw covers in session order
  for (let i = 0; i < count; i++) {
    const pos = positions[i];
    const drawSize = BASE_SIZE;
    const x = Math.round(honeyCenterX + pos.px - drawSize / 2);
    const y = Math.round(honeyCenterY + pos.py - drawSize / 2);
    const radius = Math.round(drawSize * 0.09);
    const img = imgs[i];
    const genre = getGenres(records[i])[0] || '';
    const genreHex = getGenrePalette(genre).hex;
    const rgb = hexToRgb(genreHex);

    // Genre-color glow ring
    ctx.save();
    ctx.shadowColor = `rgba(${rgb},0.55)`;
    ctx.shadowBlur = Math.round(drawSize * 0.12);
    canvasRoundRect(ctx, x, y, drawSize, drawSize, radius);
    ctx.strokeStyle = `rgba(${rgb},0.32)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Cover image or dark placeholder
    ctx.save();
    canvasRoundRect(ctx, x, y, drawSize, drawSize, radius);
    if (img) {
      ctx.clip();
      ctx.drawImage(img, x, y, drawSize, drawSize);
    } else {
      ctx.fillStyle = '#1c1814';
      ctx.fill();
    }
    ctx.restore();

    // Order badge (top-left corner) — multi-record only
    if (count > 1) {
      const br = Math.round(drawSize * 0.095);
      const bx = x + br + 8;
      const by = y + br + 8;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3e0';
      ctx.font = `bold ${Math.round(br * 1.05)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), bx, by + 1);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    // Single record: gradient overlay
    if (isSingle) {
      const overlayGrad = ctx.createLinearGradient(0, y + drawSize * 0.45, 0, y + drawSize);
      overlayGrad.addColorStop(0, 'rgba(0,0,0,0)');
      overlayGrad.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.save();
      canvasRoundRect(ctx, x, y, drawSize, drawSize, radius);
      ctx.clip();
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(x, y, drawSize, drawSize);
      ctx.restore();
    }
  }

  // Text starts below the cluster
  const clusterBottom = honeyCenterY + clusterH / 2;
  let textStartY;
  if (isSingle) {
    textStartY = Math.round(clusterBottom) + 56;
    ctx.fillStyle = '#fef9f0';
    ctx.textAlign = 'center';
    ctx.font = `bold 58px Georgia, serif`;
    const title = records[0].title || '';
    ctx.fillText(title.length > 30 ? title.slice(0, 28) + '…' : title, W / 2, textStartY);
    ctx.fillStyle = '#78716c';
    ctx.font = `40px Georgia, serif`;
    ctx.fillText((records[0].artist || '').replace(/\s*\(\d+\)\s*$/, '').slice(0, 36), W / 2, textStartY + 60);
    textStartY += 130;
  } else {
    textStartY = Math.round(clusterBottom) + 56;
  }

  // ── Stats line ──────────────────────────────────────────────────────────────
  const genres = [...new Set(records.flatMap(r => getGenres(r)))].slice(0, 3);
  const durationStr = session.listeningSecs != null ? formatListeningTime(session.listeningSecs) : null;
  const statsParts = [];
  if (!isSingle) statsParts.push(`${records.length} records`);
  if (genres.length > 0) statsParts.push(genres.join(' · '));
  if (durationStr) statsParts.push(durationStr);

  ctx.fillStyle = '#a8a29e';
  ctx.font = `38px Georgia, serif`;
  ctx.textAlign = 'center';
  // Wrap stats if too long
  const statsLine = statsParts.join('  ·  ');
  ctx.fillText(statsLine.length > 48 ? statsLine.slice(0, 46) + '…' : statsLine, W / 2, textStartY + 40);
  let nextY = textStartY + 110;

  // ── Hearted tracks — grouped by album ───────────────────────────────────────
  const heartedGroups = records
    .map(r => ({
      artist: r.artist || r.title || '',
      tracks: (r.favorite_tracks || [])
        .map(ft => {
          const t = typeof ft === 'object' ? ft : { key: ft, title: ft };
          // Only show if title is a real track name, not just a position key like "A1"
          return (t.title && t.title !== t.key) ? t.title : null;
        })
        .filter(Boolean),
    }))
    .filter(g => g.tracks.length > 0);

  // Deduplicate consecutive same-artist groups
  const mergedGroups = [];
  for (const g of heartedGroups) {
    const last = mergedGroups[mergedGroups.length - 1];
    if (last && last.artist === g.artist) last.tracks.push(...g.tracks);
    else mergedGroups.push({ artist: g.artist, tracks: [...g.tracks] });
  }

  if (mergedGroups.length > 0 && nextY < H - 280) {
    const pillX = 60;
    const pillW = W - 120;
    const totalLines = mergedGroups.reduce((s, g) => s + 1 + g.tracks.length, 0);
    const pillH = Math.min(54 + totalLines * 46 + 30, H - nextY - 120);
    ctx.save();
    ctx.fillStyle = 'rgba(136, 19, 55, 0.18)';
    canvasRoundRect(ctx, pillX, nextY - 20, pillW, pillH, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.25)';
    ctx.lineWidth = 1.5;
    canvasRoundRect(ctx, pillX, nextY - 20, pillW, pillH, 28);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fb7185';
    ctx.font = `bold 36px Georgia, serif`;
    ctx.fillText('♥  Favorites', W / 2, nextY);
    nextY += 52;

    for (const group of mergedGroups) {
      if (nextY > H - 200) break;
      // Artist header (left-aligned, inside pill)
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fda4af';
      ctx.font = `bold 33px Georgia, serif`;
      const artistDisplay = group.artist.length > 30 ? group.artist.slice(0, 28) + '…' : group.artist;
      ctx.fillText(artistDisplay, pillX + 32, nextY);
      nextY += 44;
      // Indented track titles
      ctx.fillStyle = '#a8a29e';
      ctx.font = `30px Georgia, serif`;
      for (const track of group.tracks.slice(0, 4)) {
        if (nextY > H - 200) break;
        const td = track.length > 38 ? track.slice(0, 36) + '…' : track;
        ctx.fillText(td, pillX + 64, nextY);
        nextY += 42;
      }
    }
    ctx.textAlign = 'center';
  }

  // ── Branding ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#262220';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, H - 130);
  ctx.lineTo(W - 80, H - 130);
  ctx.stroke();

  ctx.textAlign = 'center';
  if (username) {
    ctx.fillStyle = '#57534e';
    ctx.font = `30px Georgia, serif`;
    ctx.fillText(`cratemate.com/crate/${username}`, W / 2, H - 86);
  }
  ctx.fillStyle = '#44403c';
  ctx.font = `bold 28px Georgia, serif`;
  ctx.fillText('CrateMate', W / 2, H - 46);

  return canvas;
}

export default function CrateMate() {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const [collection, setCollection] = useState(null);
  const [collectionError, setCollectionError] = useState("");
  const TAB_ORDER = ["crate", "history", "reco", "wants", "stats", "hearts", "discover"];
  const [tab, setTabRaw] = useState("crate");
  const [tabSlide, setTabSlide] = useState(null); // "left" | "right" | null
  const tabSlideTimer = useRef(null);
  function setTab(nextTab) {
    if (nextTab === tab) return;
    const idx = TAB_ORDER.indexOf(tab);
    const nextIdx = TAB_ORDER.indexOf(nextTab);
    const dir = nextIdx > idx ? "left" : "right";
    setTabSlide(dir);
    setTabRaw(nextTab);
    if (tabSlideTimer.current) clearTimeout(tabSlideTimer.current);
    tabSlideTimer.current = setTimeout(() => setTabSlide(null), 250);
  }
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("az");
  const [sortDir, setSortDir] = useState("asc");
  const [hideForSale, setHideForSale] = useState(
    () => { try { return localStorage.getItem("cratemate_hide_for_sale") === "1"; } catch { return false; } }
  );
  const [showSettings, setShowSettings] = useState(false);
  const [devSimulateFree, setDevSimulateFree] = useState(() => {
    try { return localStorage.getItem("cratemate_dev_simulate_free") === "1"; } catch { return false; }
  });
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [compareBase, setCompareBase] = useState(null);   // record A
  const [compareTarget, setCompareTarget] = useState(null); // record B (null = picker mode)
  const [userLocation, setUserLocation] = useState(null); // { city_name, latitude, longitude } — loaded from DB on mount
  const [todayWeather, setTodayWeather] = useState(null); // { condition, label, mood, temperature_c, city_name }
  const [citySearch, setCitySearch] = useState({ query: "", results: [], open: false, loading: false });
  const [selected, setSelected] = useState(null);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [reco, setReco] = useState(null);
  const [recoLoading, setRecoLoading] = useState(false);
  const [autoTriggerReco, setAutoTriggerReco] = useState(false);
  const [recoError, setRecoError] = useState("");
  const [dailyPickToast, setDailyPickToast] = useState(null); // { record, reason } — shown once on app open
  const [dailyPickToastMinimized, setDailyPickToastMinimized] = useState(false);
  const dailyPickToastShown = useRef(false);
  const [mood, setMood] = useState("");
  const [activeGenres, setActiveGenres] = useState(new Set());
  const toggleGenre = (g) =>
    setActiveGenres((prev) => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });
  const [activeStyles, setActiveStyles] = useState(new Set());
  const toggleStyle = (s) =>
    setActiveStyles((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const [bubbleView, setBubbleView] = useState("genres");
  const [statsSubTab, setStatsSubTab] = useState("collection");
  const [recoFilterGenres, setRecoFilterGenres] = useState(new Set());
  const [recoFilterDecades, setRecoFilterDecades] = useState(new Set());
  const [spotifyLinked, setSpotifyLinked] = useState(null); // null=unknown, true/false

  const [spotifyRecs, setSpotifyRecs] = useState(null);
  const [spotifyRecsLoading, setSpotifyRecsLoading] = useState(false);
  const [spotifyExpanded, setSpotifyExpanded] = useState(false);
  const [wantsSubTab, setWantsSubTab] = useState("wantlist");
  const [lastfmRecs, setLastfmRecs] = useState(null);
  const [lastfmRecsLoading, setLastfmRecsLoading] = useState(false);
  const [lastfmExpanded, setLastfmExpanded] = useState(false);
  const [recoFiltersExpanded, setRecoFiltersExpanded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [seenHints, setSeenHints] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cratemate_hints") || "{}"); } catch { return {}; }
  });
  function dismissHint(key) {
    const next = { ...seenHints, [key]: true };
    setSeenHints(next);
    try { localStorage.setItem("cratemate_hints", JSON.stringify(next)); } catch {}
  }
  const [screensaverEnabled, setScreensaverEnabled] = useState(
    () => typeof window === "undefined" || localStorage.getItem("cratemate_screensaver") !== "0"
  );

  const [playCounts, setPlayCounts] = useState({});
  const [lastPlayedDates, setLastPlayedDates] = useState({});
  const [playSessions, setPlaySessions] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [honeycombSort, setHoneycombSort] = useState("az");
  const [honeycombSortDir, setHoneycombSortDir] = useState("asc");
  const [honeycombZoom, setHoneycombZoom] = useState(1.0);
  const [honeycombShape, setHoneycombShape] = useState(() => {
    try { return localStorage.getItem("cratemate_hc_shape") || "honeycomb"; } catch { return "honeycomb"; }
  });
  useEffect(() => { try { localStorage.setItem("cratemate_hc_shape", honeycombShape); } catch {} }, [honeycombShape]);
  useEffect(() => { try { localStorage.setItem("cratemate_hide_for_sale", hideForSale ? "1" : "0"); } catch {} }, [hideForSale]);

  // Escape key closes detail sheet
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && selected) setSelected(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);

  // Service worker update banner
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e) => { if (e.data?.type === "SW_UPDATED") setShowUpdateBanner(true); };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // Resume interrupted enrichment — on mount AND every time app comes back to foreground
  useEffect(() => {
    function tryResumeEnrich() {
      // Don't double-start if already polling
      if (enrichRunningRef.current) return;
      const saved = loadEnrichJobs();
      if (!saved) return;
      const { metaJobId, artistJobId } = saved;

      Promise.all([
        fetch(`/api/discogs/enrich/job/${encodeURIComponent(metaJobId)}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/discogs/enrich/job/${encodeURIComponent(artistJobId)}`).then(r => r.ok ? r.json() : null),
      ]).then(([metaJob, artistJob]) => {
        if (!metaJob) { clearEnrichJobs(); return; }
        if (metaJob.status === "completed" || metaJob.status === "failed") { clearEnrichJobs(); return; }

        setEnrichLoading(true);
        setImportResult(prev => ({ ...prev, stage: "enriching" }));
        pollEnrichJobs(metaJobId, artistJobId, metaJob, artistJob, (progress) => {
          setImportResult(prev => ({ ...prev, enrichProgress: { ...progress, total: myRecords.length } }));
        }).then((meta) => {
          setImportResult(prev => ({ ...prev, meta, stage: "done" }));
          refreshRecords();
        }).catch(() => {
          setImportResult(prev => ({ ...prev, stage: "done" }));
        }).finally(() => setEnrichLoading(false));
      }).catch(() => clearEnrichJobs());
    }

    // Run on mount (handles full page reload)
    tryResumeEnrich();

    // Run every time the app comes back to foreground (handles backgrounding)
    function onVisibility() { if (document.visibilityState === "visible") tryResumeEnrich(); }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load stored location + today's weather on mount
  useEffect(() => {
    fetch("/api/user/location")
      .then(r => r.ok ? r.json() : null)
      .then(loc => {
        if (!loc?.city_name) return;
        setUserLocation(loc);
        return fetch("/api/weather").then(r => r.ok ? r.json() : null);
      })
      .then(w => { if (w && !w.error) setTodayWeather(w); })
      .catch(() => {});
  }, []);

  const [activeDecade, setActiveDecade] = useState(new Set());
  const [activeFormat, setActiveFormat] = useState(null);
  const [activeLabel, setActiveLabel] = useState(null);
  const [statFilterLabel, setStatFilterLabel] = useState(null);
  const [previousTab, setPreviousTab] = useState(null);

  const [shareCopied, setShareCopied] = useState(false);
  const [crateShareLoading, setCrateShareLoading] = useState(false);
  const [favTitles, setFavTitles] = useState({});
  const [page, setPage] = useState(1);
  const [infiniteScroll, setInfiniteScroll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(25);
  const PAGE_SIZE = 25;
  const sentinelRef = useRef(null);

  // Now Playing — derived from playSessions (DB-backed, cross-browser)
  // Dismissed session ID + timestamp stored locally — auto-restores after 6 hours
  const BANNER_RESTORE_MS = 6 * 60 * 60 * 1000; // 6 hours
  const [dismissedSessionId, setDismissedSessionId] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("cratemate_np_dismissed");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.ts && Date.now() - parsed.ts > 6 * 60 * 60 * 1000) {
        try { localStorage.removeItem("cratemate_np_dismissed"); } catch {}
        return null;
      }
      return parsed.id || null;
    } catch {
      try { localStorage.removeItem("cratemate_np_dismissed"); } catch {}
      return null;
    }
  });
  const [, setNowPlayingTick] = useState(0); // force re-render every minute for relative time
  const nowPlaying = useMemo(() => {
    const last = playSessions[0];
    if (!last || last.id === dismissedSessionId) return null;
    const record = (collection || []).find(r => String(r.id) === String(last.record_id));
    return record ? { record, loggedAt: last.played_at } : null;
  }, [playSessions, collection, dismissedSessionId]);
  useEffect(() => {
    if (!nowPlaying) return;
    const id = setInterval(() => setNowPlayingTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, [nowPlaying]);
  // Auto-restore dismissed banner after 6 hours
  useEffect(() => {
    if (!dismissedSessionId) return;
    try {
      const raw = localStorage.getItem("cratemate_np_dismissed");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed.ts) return;
      const remaining = BANNER_RESTORE_MS - (Date.now() - parsed.ts);
      if (remaining <= 0) {
        setDismissedSessionId(null);
        localStorage.removeItem("cratemate_np_dismissed");
        return;
      }
      const id = setTimeout(() => {
        setDismissedSessionId(null);
        localStorage.removeItem("cratemate_np_dismissed");
      }, remaining);
      return () => clearTimeout(id);
    } catch {}
  }, [dismissedSessionId]);

  // Undo pending
  const [undoPending, setUndoPending] = useState(null); // { record, sessionId }
  const undoTimerRef = useRef(null);
  const enrichRunningRef = useRef(false); // true while pollEnrichJobs is active

  // Play Trail
  const [trailActive, setTrailActive] = useState(false);
  const [trailCenter, setTrailCenter] = useState(null);
  const [trailHistory, setTrailHistory] = useState([]);
  const [trailSuggestions, setTrailSuggestions] = useState(null); // { windDown, liftUp, sideways } each { record, score }
  const sessionRestoredRef = useRef(false);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState("");
  const [trailSearchOpen, setTrailSearchOpen] = useState(false);
  const [trailSearch, setTrailSearch] = useState("");
  const [spotifyFeatures, setSpotifyFeatures] = useState({}); // { [record_id]: features }
  const initialFeaturesLoaded = useRef(false);
  const [spotifyAnalyzing, setSpotifyAnalyzing] = useState(false);
  const fetchingFeaturesRef = useRef(new Set()); // record IDs currently in-flight

  // Fire-and-forget Discogs + MusicBrainz enrichment for a single record.
  // Checks missing fields server-side — safe to call on every interaction.
  const enrichingRef = useRef(new Set()); // deduplicate in-flight calls
  function silentEnrich(recordId) {
    const key = String(recordId);
    if (enrichingRef.current.has(key)) return;
    // Skip if record is already fully enriched (avoid unnecessary network call)
    const rec = (collection || []).find(r => String(r.id) === key);
    if (rec && rec.discogs_id && rec.year_original != null && rec.release_month != null && rec.artist_birth_month != null) return;
    enrichingRef.current.add(key);
    fetch("/api/discogs/enrich/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId }),
    })
      .then(r => r.json()).then(d => console.log("[enrich] result", key, JSON.stringify(d)))
      .catch(e => console.log("[enrich] error", key, e))
      .finally(() => enrichingRef.current.delete(key));
  }

  // Shared fetch helper — deduplicates, normalises, writes to state.
  // Returns true if features were successfully stored.
  async function fetchOneFeature(record, { force = false } = {}) {
    const id = String(record.id);
    if (fetchingFeaturesRef.current.has(id)) return false;
    fetchingFeaturesRef.current.add(id);
    try {
      const res = await fetch("/api/spotify/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: record.id, artist: record.artist, title: record.title, ...(force && { force: true }) }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.energy == null) return false;
      const normalized = data.loudness != null
        ? { ...data, loudness: Math.min(1, Math.max(0, (data.loudness + 30) / 27)) }
        : data;
      setSpotifyFeatures(prev => ({ ...prev, [record.id]: normalized }));
      return true;
    } catch {
      return false;
    } finally {
      fetchingFeaturesRef.current.delete(id);
    }
  }
  const [storyGenerating, setStoryGenerating] = useState(false);
  const [storyCanvases, setStoryCanvases] = useState(null);
  const [showStoryPreview, setShowStoryPreview] = useState(false);
  const [tileExporting, setTileExporting] = useState(null); // "square" | "full" | null
  const [dnaGenerating, setDnaGenerating] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [driftFilterExpanded, setDriftFilterExpanded] = useState(false);
  const driftFadeTimerRef = useRef(null);
  const driftRestoreTimerRef = useRef(null);
  const driftFullscreenRef = useRef(false); // true = user explicitly chose fullscreen
  const driftHiddenByDragRef = useRef(false); // true = hidden by drag, should restore on stop
  const inDrift = viewMode === "drift" && tab === "crate";

  const DRIFT_FADE_MS = 8000;
  const DRIFT_RESTORE_MS = 1000; // show controls after stopping drag/scroll

  // Auto-fade drift controls — only when actually in drift view
  useEffect(() => {
    if (!inDrift || controlsHidden) {
      if (driftFadeTimerRef.current) clearTimeout(driftFadeTimerRef.current);
      return;
    }
    driftFadeTimerRef.current = setTimeout(() => {
      if (!driftFullscreenRef.current) setControlsHidden(true);
    }, DRIFT_FADE_MS);
    return () => { if (driftFadeTimerRef.current) clearTimeout(driftFadeTimerRef.current); };
  }, [inDrift, controlsHidden]);

  function driftResetFade() {
    if (driftFadeTimerRef.current) clearTimeout(driftFadeTimerRef.current);
    if (!inDrift) return;
    driftFadeTimerRef.current = setTimeout(() => {
      if (!driftFullscreenRef.current) setControlsHidden(true);
    }, DRIFT_FADE_MS);
  }

  // Hide controls when user starts dragging/scrolling — restore when they stop
  function driftHideOnInteract() {
    if (!inDrift || driftFullscreenRef.current) return;
    if (driftRestoreTimerRef.current) clearTimeout(driftRestoreTimerRef.current);
    if (!controlsHidden) {
      // Currently visible — hide on drag
      if (driftFadeTimerRef.current) clearTimeout(driftFadeTimerRef.current);
      driftHiddenByDragRef.current = true;
      setControlsHidden(true);
    } else {
      // Currently hidden (idle fade or drag) — mark for restore on stop
      driftHiddenByDragRef.current = true;
    }
    // Reset the restore timer — fires when interaction stops
    driftRestoreTimerRef.current = setTimeout(() => {
      if (driftHiddenByDragRef.current) {
        driftHiddenByDragRef.current = false;
        setControlsHidden(false);
        driftResetFade();
      }
    }, DRIFT_RESTORE_MS);
  }
  const tabRowRef = useRef(null);
  const forSaleRef = useRef(null);
  const [forSaleForced, setForSaleForced] = useState(false);
  useEffect(() => {
    if (!forSaleForced || !forSaleRef.current) return;
    let hasBeenVisible = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { hasBeenVisible = true; }
        else if (hasBeenVisible) { setForSaleForced(false); }
      },
      { threshold: 0 }
    );
    observer.observe(forSaleRef.current);
    return () => observer.disconnect();
  }, [forSaleForced]);
  const [contentTop, setContentTop] = useState(null);

  useEffect(() => {
    function measure() {
      if (tabRowRef.current) {
        setContentTop(tabRowRef.current.getBoundingClientRect().bottom);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selected, viewMode]); // re-measure when header shows/hides (it shifts the tab row)
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [trailSavePrompt, setTrailSavePrompt] = useState(false);
  const [trailSaving, setTrailSaving] = useState(false);
  const [trailAlreadyLoggedIds, setTrailAlreadyLoggedIds] = useState(new Set());
  const [lastfmNextSuggestion, setLastfmNextSuggestion] = useState(null); // { record } for non-Spotify users
  const [bannerPreviewDirection, setBannerPreviewDirection] = useState(null);
  const [bannerSuggestions, setBannerSuggestions] = useState(null); // precomputed trail suggestions for now playing
  const [sessionToast, setSessionToast] = useState(null); // { recordId, record }
  const sessionToastTimerRef = useRef(null);


  const [expandedHearts, setExpandedHearts] = useState(new Set());
  const [heartsPage, setHeartsPage] = useState(1);
  const [heartsInfiniteScroll, setHeartsInfiniteScroll] = useState(false);
  const [heartsVisible, setHeartsVisible] = useState(20);
  const HEARTS_PAGE_SIZE = 20;
  const heartsSentinelRef = useRef(null);
  const [heartsGenreFilter, setHeartsGenreFilter] = useState([]);
  const [heartsYearFilter, setHeartsYearFilter] = useState([]);
  const [heartsSort, setHeartsSort] = useState("artist");
  const [heartsSortDir, setHeartsSortDir] = useState("asc");
  const [heartsChecked, setHeartsChecked] = useState(null); // null = all checked; Set<"recordId-trackKey"> = explicit
  const [exportingPlaylist, setExportingPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [showPlaylistNameModal, setShowPlaylistNameModal] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [playlistIsPublic, setPlaylistIsPublic] = useState(true);
  const [spotifyConnectedForPlaylists, setSpotifyConnectedForPlaylists] = useState(null);
  const [showNotFoundList, setShowNotFoundList] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyInfiniteScroll, setHistoryInfiniteScroll] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(20);
  const [historySearch, setHistorySearch] = useState("");
  const HISTORY_PAGE_SIZE = 20;
  const historySentinelRef = useRef(null);

  const [searchFocused, setSearchFocused] = useState(false);

  // Swipe between tabs
  const swipeStartRef = useRef(null);
  function onSwipeStart(e) {
    if (viewMode === "drift") return;
    const t = e.touches?.[0];
    if (t) swipeStartRef.current = { x: t.clientX, y: t.clientY };
  }
  function onSwipeEnd(e) {
    if (!swipeStartRef.current || viewMode === "drift") return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    // Only trigger if horizontal > 80px and more horizontal than vertical
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = TAB_ORDER.indexOf(tab);
    if (idx === -1) return;
    const nextIdx = dx < 0 ? Math.min(idx + 1, TAB_ORDER.length - 1) : Math.max(idx - 1, 0);
    if (nextIdx !== idx) { setTab(TAB_ORDER[nextIdx]); setSelected(null); }
  }

  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [discoverResults, setDiscoverResults] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const discoverFetchedRef = useRef(false);
  const [selectedDiscoverUser, setSelectedDiscoverUser] = useState(null);
  const [overlapData, setOverlapData] = useState(null);
  const [overlapLoading, setOverlapLoading] = useState(false);
  const [showAllSharedArtists, setShowAllSharedArtists] = useState(false);
  const [showAllUniqueRecords, setShowAllUniqueRecords] = useState(false);
  // Auto-fetch discover results when tab opens
  useEffect(() => {
    if (tab !== "discover" || !isDiscoverable || discoverFetchedRef.current || discoverLoading) return;
    discoverFetchedRef.current = true;
    setDiscoverLoading(true);
    fetch("/api/discover")
      .then(r => r.json())
      .then(data => setDiscoverResults(Array.isArray(data) ? data : []))
      .catch(() => setDiscoverResults([]))
      .finally(() => setDiscoverLoading(false));
  }, [tab, isDiscoverable]); // eslint-disable-line react-hooks/exhaustive-deps

  const [enrichmentProgress, setEnrichmentProgress] = useState(null); // null | { done, total, type }
  const enrichmentAbort = useRef(false);
  const spotifyFeaturesRef = useRef({});
  const enrichmentStarted = useRef(false);

  const [discogsConnected, setDiscogsConnected] = useState(false);
  const [discogsUsername, setDiscogsUsername] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    try { return localStorage.getItem("cratemate_last_synced") || null; } catch { return null; }
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [showDiscogsMenu, setShowDiscogsMenu] = useState(false);

  // Feature 1 — Wantlist
  const [wantlist, setWantlist] = useState(null);
  const [wantlistImportJob, setWantlistImportJob] = useState(null);
  const [expandedMasters, setExpandedMasters] = useState(new Set());

  // Push notifications
  const [pushPermission, setPushPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [priceThresholds, setPriceThresholds] = useState(new Map()); // release_id → row

  async function subscribeToPush() {
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setPushSubscribed(true); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setPushSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    }
  }

  async function savePriceThreshold(releaseId, pct) {
    const res = await fetch("/api/push/threshold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release_id: releaseId, threshold_deal_pct: pct }),
    });
    if (res.ok) {
      const row = await res.json();
      setPriceThresholds(prev => { const m = new Map(prev); m.set(releaseId, row); return m; });
    }
  }

  async function removePriceThreshold(releaseId) {
    await fetch("/api/push/threshold", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release_id: releaseId }),
    });
    setPriceThresholds(prev => { const m = new Map(prev); m.delete(releaseId); return m; });
  }

  // Load push sub status + thresholds when wantlist tab opens
  useEffect(() => {
    if (tab !== "wants") return;
    if (typeof Notification !== "undefined") setPushPermission(Notification.permission);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
        .then(sub => { if (sub) setPushSubscribed(true); })
        .catch(() => {});
    }
    fetch("/api/push/threshold")
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const m = new Map();
        for (const row of rows) m.set(row.release_id, row);
        setPriceThresholds(m);
      })
      .catch(() => {});
  }, [tab]);

  // Feature 4 — Offline
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingPlays, setPendingPlays] = useState(0);

  const refreshRecords = useCallback(async () => {
    setCollectionError("");
    try {
      const res = await fetch("/api/records");
      const data = await res.json();
      const records = Array.isArray(data) ? data : [];
      setCollection(records);
      // Auto-open a record if ?record=[id] is in the URL (e.g. navigating from artist page)
      const openId = new URLSearchParams(window.location.search).get("record");
      if (openId) {
        const match = records.find((r) => String(r.id) === openId);
        if (match) { setSelected(match); window.history.replaceState({}, "", "/"); }
      }
    } catch {
      setCollectionError("Couldn't load your records.");
      setCollection([]);
    }
  }, []);

  useEffect(() => {
    fetch("/api/spotify/features").then(r => r.ok ? r.json() : {}).then(raw => {
      if (!raw) return;
      // Normalize loudness from dB to 0–1, same as fetchAndCacheFeatures
      const normalized = Object.fromEntries(
        Object.entries(raw).map(([id, f]) => [
          id,
          f.loudness != null ? { ...f, loudness: Math.min(1, Math.max(0, (f.loudness + 30) / 27)) } : f,
        ])
      );
      setSpotifyFeatures(normalized);
      initialFeaturesLoaded.current = true;
    }).catch(() => { initialFeaturesLoaded.current = true; });

    fetch("/api/discogs/status")
      .then((r) => r.json())
      .then((d) => {
        setDiscogsConnected(d.connected);
        setDiscogsUsername(d.username);
        setIsDiscoverable(d.is_discoverable ?? true);
        // Auto-enable discoverability for new users (no profile row yet → null)
        if (d.is_discoverable == null) {
          fetch("/api/discogs/toggle-discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ discoverable: true }) }).catch(() => {});
        }
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("discogs") === "connected") {
      window.history.replaceState({}, "", "/");
      fetch("/api/discogs/status")
        .then((r) => r.json())
        .then((d) => {
          setDiscogsConnected(d.connected);
          setDiscogsUsername(d.username);
          setIsDiscoverable(d.is_discoverable ?? true);
        })
        .catch(() => {});
    }
    if (params.get("spotify") === "connected") {
      window.history.replaceState({}, "", "/");
      setSpotifyLinked(true);
      setTab("reco");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPlays() {
    try {
      const res = await fetch("/api/plays");
      if (res.ok) {
        const data = await res.json();
        setPlayCounts(data.counts || data);
        setLastPlayedDates(data.lastPlayed || {});
        setPlaySessions(data.sessions || []);
      }
    } catch {}
  }

  function relativePlayTime(loggedAt) {
    const mins = Math.floor((Date.now() - new Date(loggedAt).getTime()) / 60000);
    if (mins < 90) return "Now Playing";
    if (mins < 60 * 24) return `Last played · ${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`} ago`;
    if (mins < 1440) return `Last played · ${Math.floor(mins / 60)}h ago`;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const logged = new Date(loggedAt); logged.setHours(0, 0, 0, 0);
    const days = Math.round((today - logged) / 86400000);
    if (days === 1) return "Last played · yesterday";
    if (days < 7) return `Last played · ${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `Last played · ${weeks} week${weeks > 1 ? "s" : ""} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Last played · ${months} month${months > 1 ? "s" : ""} ago`;
    const years = Math.floor(days / 365);
    return `Last played · ${years} year${years > 1 ? "s" : ""} ago`;
  }

  async function handleDoubleTap(record) {
    try {
      const sessionId = await logPlay(record.id);
      clearTimeout(undoTimerRef.current);
      setUndoPending({ record, sessionId });
      undoTimerRef.current = setTimeout(() => setUndoPending(null), 4000);
    } catch {}
  }

  // City search — debounced geocoding via Open-Meteo (no API key needed)
  const citySearchTimer = useRef(null);
  function handleCitySearchInput(query) {
    setCitySearch(s => ({ ...s, query, open: true }));
    clearTimeout(citySearchTimer.current);
    if (!query.trim()) { setCitySearch(s => ({ ...s, results: [], loading: false })); return; }
    setCitySearch(s => ({ ...s, loading: true }));
    citySearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
        const data = await res.json();
        setCitySearch(s => ({ ...s, results: data.results || [], loading: false }));
      } catch { setCitySearch(s => ({ ...s, results: [], loading: false })); }
    }, 350);
  }

  async function handleCitySelect(result) {
    const loc = { city_name: `${result.name}, ${result.country}`, latitude: result.latitude, longitude: result.longitude };
    setCitySearch({ query: "", results: [], open: false, loading: false });
    setUserLocation(loc);
    try {
      await fetch("/api/user/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(loc) });
      const w = await fetch("/api/weather").then(r => r.ok ? r.json() : null);
      if (w && !w.error) setTodayWeather(w);
    } catch {}
  }

  async function handleUndo() {
    if (!undoPending) return;
    clearTimeout(undoTimerRef.current);
    const { record, sessionId } = undoPending;
    setUndoPending(null);
    try {
      await fetch(`/api/plays/${sessionId}`, { method: "DELETE" });
    } catch {}
    setPlayCounts(prev => ({ ...prev, [record.id]: Math.max((prev[record.id] || 0) - 1, 0) }));
    setPlaySessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      const nextForRecord = next.find(s => s.record_id === record.id);
      setLastPlayedDates(d => {
        const nd = { ...d };
        if (nextForRecord) nd[record.id] = nextForRecord.played_at;
        else delete nd[record.id];
        return nd;
      });
      return next;
    });
  }

  async function handleShareStory(session) {
    if (storyGenerating) return;
    setStoryGenerating(true);
    try {
      const canvases = await generateStoryCards(session, discogsUsername);
      setStoryCanvases(canvases);
      setShowStoryPreview(true);
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Story export failed:', err);
    } finally {
      setStoryGenerating(false);
    }
  }

  useEffect(() => {
    refreshRecords();
    loadPlays();
  }, [refreshRecords]);

  useEffect(() => {
    if (tab !== "hearts") return;
    const favRecords = myRecords.filter(r => (r.favorite_tracks || []).length > 0 && r.discogs_id);
    for (const r of favRecords) {
      if (favTitles[r.id]) continue;
      const needsResolve = (r.favorite_tracks || []).some(f => {
        if (typeof f !== "object") return true;
        return !f.title || f.title === f.key; // stored as object but title missing or just the position key
      });
      if (!needsResolve) continue;
      fetch(`/api/discogs/release/${r.discogs_id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data?.tracklist) return;
          const map = {};
          data.tracklist.forEach((t, i) => { map[t.position || String(i)] = t.title; });
          setFavTitles(prev => ({ ...prev, [r.id]: map }));
        })
        .catch(() => {});
    }
  }, [tab]); // intentionally omit myRecords/favTitles from deps to avoid refetching

  useEffect(() => { setPage(1); setVisibleCount(PAGE_SIZE); }, [search, sortBy, sortDir, activeGenres, activeDecade, activeFormat, activeLabel]);

  // If returning from Spotify OAuth, reset state so the status re-checks on next tab visit
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("spotify") === "connected") {
      setSpotifyLinked(null);
      setSpotifyConnectedForPlaylists(null);
      setSpotifyRecs(null);
      setSpotifyExpanded(true);
      const returnTab = params.get("tab");
      if (returnTab === "reco" || returnTab === "hearts") setTab(returnTab);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Load Spotify status + recs when Reco tab first opens
  useEffect(() => {
    if (tab !== "reco" && tab !== "wants" && tab !== "hearts") return;
    if (spotifyLinked !== null) return;
    (async () => {
      try {
        const statusRes = await fetch("/api/spotify/status");
        const status = statusRes.ok ? await statusRes.json() : null;
        const connected = !!status?.connected;
        setSpotifyLinked(connected);
        setSpotifyConnectedForPlaylists(connected && status?.hasPlaylistScope !== false);
        if (!connected) setSpotifyExpanded(true);
        if (connected) {
          setSpotifyRecsLoading(true);
          const recsRes = await fetch("/api/spotify/listening");
          const recsData = recsRes.ok ? await recsRes.json() : null;
          setSpotifyRecs(recsData?.recs || []);
          setSpotifyRecsLoading(false);
        }
      } catch {
        setSpotifyLinked(false);
        setSpotifyConnectedForPlaylists(false);
        setSpotifyRecsLoading(false);
      }
    })();
  }, [tab, spotifyLinked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check Spotify scope when Hearts tab shows the reconnect prompt —
  // catches the case where user reconnected but the initial status check already ran
  useEffect(() => {
    if (tab !== "hearts" || spotifyConnectedForPlaylists !== false) return;
    fetch("/api/spotify/status")
      .then((r) => r.ok ? r.json() : null)
      .then((s) => {
        if (s?.connected && s?.hasPlaylistScope) {
          setSpotifyConnectedForPlaylists(true);
        }
      })
      .catch(() => {});
  }, [tab, spotifyConnectedForPlaylists]);

  // Feature 1 — Load wantlist when Wants tab is first opened
  useEffect(() => {
    if (tab !== "wants" || wantlist !== null) return;
    fetch("/api/discogs/wantlist")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setWantlist(Array.isArray(data) ? data : []))
      .catch(() => setWantlist([]));
  }, [tab, wantlist]);

  // Last.fm — fetch similar artists when Discover subtab first opens
  useEffect(() => {
    if (tab !== "wants" || wantsSubTab !== "discover" || lastfmRecs !== null) return;
    if (myRecords.length === 0) return;
    // Top 5 artists by total play count
    const artistCounts = {};
    for (const r of myRecords) {
      if (r.is_compilation || !r.artist) continue;
      const name = stripArtistNum(r.artist);
      artistCounts[name] = (artistCounts[name] || 0) + (playCounts[r.id] || 0);
    }
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => stripArtistNum(name));
    if (topArtists.length === 0) { setLastfmRecs([]); return; }
    const ownedArtists = new Set(myRecords.map((r) => stripArtistNum(r.artist).toLowerCase()).filter(Boolean));
    setLastfmRecsLoading(true);
    fetch(`/api/lastfm/similar?artists=${encodeURIComponent(topArtists.join(","))}`)
      .then((r) => r.ok ? r.json() : { similar: [] })
      .then((data) => {
        const filtered = (data.similar || []).filter((a) => !ownedArtists.has(stripArtistNum(a.name).toLowerCase()));
        setLastfmRecs(filtered.slice(0, 15));
      })
      .catch(() => setLastfmRecs([]))
      .finally(() => setLastfmRecsLoading(false));
  }, [tab, wantsSubTab, lastfmRecs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!infiniteScroll) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(c => c + PAGE_SIZE);
    }, { threshold: 0.1 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [infiniteScroll, visibleCount]);

  useEffect(() => {
    if (!heartsInfiniteScroll) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setHeartsVisible(c => c + HEARTS_PAGE_SIZE);
    }, { threshold: 0.1 });
    if (heartsSentinelRef.current) observer.observe(heartsSentinelRef.current);
    return () => observer.disconnect();
  }, [heartsInfiniteScroll, heartsVisible]);

  useEffect(() => {
    if (!historyInfiniteScroll) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setHistoryVisible(c => c + HISTORY_PAGE_SIZE);
    }, { threshold: 0.1 });
    if (historySentinelRef.current) observer.observe(historySentinelRef.current);
    return () => observer.disconnect();
  }, [historyInfiniteScroll, historyVisible]);

  // Keep ref in sync for background loops that need fresh feature data without stale closures
  useEffect(() => { spotifyFeaturesRef.current = spotifyFeatures; }, [spotifyFeatures]);

  // Today's Pick — auto-generate on first load of the day (after 6 AM)
  const getRecoRef = useRef(null);
  const dailyPickAutoTriggered = useRef(false);
  useEffect(() => {
    if (dailyPickAutoTriggered.current || !Array.isArray(collection) || collection.length === 0) return;
    if (new Date().getHours() < 6) return; // before 6 AM = still "yesterday"
    const todayStr = new Date().toISOString().slice(0, 10);
    try {
      const dismissed = localStorage.getItem("cratemate_daily_toast_dismissed");
      if (dismissed === todayStr) return; // user already clicked toast or visited Picks today
    } catch {}
    dailyPickAutoTriggered.current = true;

    // Check if we already have a cached pick for today
    try {
      const raw = localStorage.getItem("cratemate_daily_picks");
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.date === todayStr && Array.isArray(cached.picks) && cached.picks.length > 0) {
          const pick = cached.picks[0];
          const record = collection.find(r => String(r.id) === String(pick.recordId));
          if (record) {
            setReco({ record, reason: pick.reason, label: "Today's Pick" });
            setDailyPickToast({ record, reason: pick.reason });
            return;
          }
        }
      }
    } catch {}

    // No cached pick — auto-generate in background (getRecoRef set after getReco defined)
    setTimeout(() => { if (getRecoRef.current) getRecoRef.current("daily"); }, 0);
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background audio-features enrichment: runs once after collection + initial features load
  useEffect(() => {
    if (!Array.isArray(collection) || collection.length === 0) return;
    if (enrichmentStarted.current) return;
    enrichmentStarted.current = true;
    enrichmentAbort.current = false;

    async function runFeaturesQueue() {
      // Wait for initial features GET to complete (polls every 200ms, max 6s)
      for (let i = 0; i < 30 && !initialFeaturesLoaded.current; i++) {
        await new Promise(res => setTimeout(res, 200));
      }
      const uncached = collection.filter(r => r.artist && r.title && !spotifyFeaturesRef.current[r.id]);
      if (uncached.length === 0) return;
      setEnrichmentProgress({ done: 0, total: uncached.length, type: "audio" });
      let done = 0;
      const CONCURRENCY = 2;
      for (let i = 0; i < uncached.length; i += CONCURRENCY) {
        if (enrichmentAbort.current) break;
        const batch = uncached.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(r => fetchAndCacheFeatures(r)));
        done += batch.length;
        setEnrichmentProgress({ done: Math.min(done, uncached.length), total: uncached.length, type: "audio" });
        if (i + CONCURRENCY < uncached.length) await new Promise(res => setTimeout(res, 800));
      }
      setEnrichmentProgress(null);
    }

    runFeaturesQueue().then(async () => {
      // Second pass: backfill track_features for records that have album features but missing per-track data
      if (enrichmentAbort.current) return;
      const needsTrackFeatures = collection.filter(r => {
        const f = spotifyFeaturesRef.current[r.id];
        return f && f.energy != null && !f.track_features;
      });
      if (needsTrackFeatures.length === 0) return;
      for (const record of needsTrackFeatures) {
        if (enrichmentAbort.current) break;
        await fetchOneFeature(record, { force: true });
        await new Promise(res => setTimeout(res, 1200));
      }
    });
    return () => { enrichmentAbort.current = true; };
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background Discogs ID resolution: quietly resolve records missing discogs_id
  useEffect(() => {
    if (!Array.isArray(collection) || collection.length === 0) return;

    async function runDiscogsQueue() {
      // Wait for initial features load before starting (avoids competing API calls)
      for (let i = 0; i < 30 && !initialFeaturesLoaded.current; i++) {
        await new Promise(res => setTimeout(res, 200));
      }
      await new Promise(res => setTimeout(res, 500)); // brief pause after features settle
      const unresolved = collection.filter(r => r.artist && r.title && !r.discogs_id);
      if (unresolved.length === 0) return;
      setEnrichmentProgress(p => p ?? { done: 0, total: unresolved.length, type: "discogs" });
      let done = 0;
      for (const record of unresolved) {
        if (enrichmentAbort.current) break;
        try {
          const res = await fetch(
            `/api/discogs/resolve?artist=${encodeURIComponent(record.artist || "")}&title=${encodeURIComponent(record.title || "")}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.release_id) {
              const patch = { discogs_id: data.release_id, ...(data.cover_image ? { thumb: data.cover_image } : {}) };
              await fetch(`/api/records/${record.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
              });
              setCollection(prev => Array.isArray(prev) ? prev.map(r => r.id === record.id ? { ...r, ...patch } : r) : prev);
            }
          }
        } catch {}
        done++;
        setEnrichmentProgress({ done, total: unresolved.length, type: "discogs" });
        await new Promise(res => setTimeout(res, 1200));
      }
      setEnrichmentProgress(null);
    }

    runDiscogsQueue();
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-time backfill: write master_id from cache to records (for existing enriched records)
  const masterBackfillRef = useRef(false);
  useEffect(() => {
    if (!Array.isArray(collection) || collection.length === 0) return;
    if (masterBackfillRef.current) return;
    const needsBackfill = collection.some(r => r.discogs_id && (r.master_id == null || r.master_id === 0));
    if (!needsBackfill) return;
    masterBackfillRef.current = true;
    fetch("/api/discogs/enrich/backfill-master", { method: "POST" })
      .then(r => r.json())
      .then(d => { if (d.updated > 0) refreshRecords(); })
      .catch(() => {});
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background cover upgrade: upgrade low-res thumbs to full-res Discogs covers
  const coverUpgradeRef = useRef(false);
  useEffect(() => {
    if (!Array.isArray(collection) || collection.length === 0) return;
    if (coverUpgradeRef.current) return;
    const isLowRes = (url) => {
      if (!url || typeof url !== "string") return false;
      const s = url.toLowerCase();
      if (/-150\.(jpe?g|png|webp)(\?.*)?$/.test(s)) return true;
      if (s.includes("i.discogs.com") && (/\/h:150\//.test(s) || /\/w:150\//.test(s) || /\/q:40\//.test(s))) return true;
      if (s.includes("/userimages/") || s.includes("/user-image/")) return true;
      return false;
    };
    const needsUpgrade = collection.filter(r => !r.for_sale && r.discogs_id && (!r.thumb || isLowRes(r.thumb)));
    if (needsUpgrade.length === 0) return;
    coverUpgradeRef.current = true;

    (async () => {
      // Wait for other enrichment passes to settle
      await new Promise(res => setTimeout(res, 3000));
      try {
        const res = await fetch("/api/discogs/enrich/job?mode=thumb", { method: "POST" });
        if (!res.ok) return;
        const { job_id } = await res.json();
        if (!job_id) return;
        for (let i = 0; i < 300; i++) {
          await new Promise(r => setTimeout(r, 1500));
          const pollRes = await fetch(`/api/discogs/enrich/job/${encodeURIComponent(job_id)}`);
          if (!pollRes.ok) break;
          const data = await pollRes.json();
          if (i % 8 === 7) refreshRecords();
          if (data.status === "completed" || data.status === "failed") break;
        }
        refreshRecords();
      } catch {}
    })();
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background duration enrichment: fetch tracklist from Discogs cache and compute album duration
  const durationRunningRef = useRef(false);
  const durationAbortRef = useRef(false);
  useEffect(() => {
    if (!Array.isArray(collection) || collection.length === 0) return;
    if (durationRunningRef.current) return;
    const needsDuration = collection.filter(r => r.discogs_id && !r.duration_secs);
    if (needsDuration.length === 0) return;
    durationRunningRef.current = true;
    durationAbortRef.current = false;

    (async () => {
      await new Promise(res => setTimeout(res, 10000));
      for (const record of needsDuration) {
        if (durationAbortRef.current) break;
        try {
          const res = await fetch(`/api/discogs/release/${record.discogs_id}`);
          if (res.status === 429) {
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          if (res.ok) {
            const data = await res.json();
            const secs = parseDurationSecs(data.tracklist);
            if (secs) {
              await fetch(`/api/records/${record.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ duration_secs: secs }),
              });
              setCollection(prev => Array.isArray(prev) ? prev.map(r => r.id === record.id ? { ...r, duration_secs: secs } : r) : prev);
            }
          }
        } catch (err) {
          console.error(`[duration] Failed for ${record.title}:`, err);
        }
        await new Promise(res => setTimeout(res, 800));
      }
      durationRunningRef.current = false;
    })();
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feature 4 — Online/offline detection
  useEffect(() => {
    async function flushOfflinePlays() {
      try {
        const { getOfflinePlays, clearOfflinePlays } = await import("@/lib/offlineQueue");
        const plays = await getOfflinePlays();
        if (!plays || plays.length === 0) return;
        const results = await Promise.allSettled(
          plays.map((p) =>
            fetch("/api/plays", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ record_id: p.record_id, played_at: p.played_at }),
            })
          )
        );
        const allOk = results.every((r) => r.status === "fulfilled" && r.value.ok);
        if (allOk) await clearOfflinePlays();
      } catch { /* ignore */ }
    }

    async function goOnline() {
      setIsOnline(true);
      setPendingPlays(0);
      try {
        const reg = await navigator.serviceWorker?.ready;
        if (reg?.sync) {
          await reg.sync.register("sync-plays");
        } else {
          await flushOfflinePlays();
        }
      } catch { await flushOfflinePlays(); }
    }

    function goOffline() { setIsOnline(false); }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Feature 1 — Poll wantlist import job and refresh display while running
  useEffect(() => {
    const jobId = wantlistImportJob?.job_id;
    if (!jobId) return;
    if (wantlistImportJob.status === "completed" || wantlistImportJob.status === "failed") return;

    let active = true;

    async function poll() {
      while (active) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!active) break;
        try {
          const res = await fetch(`/api/discogs/wantlist/import/${encodeURIComponent(jobId)}`);
          if (!res.ok) continue;
          const data = await res.json();
          setWantlistImportJob((prev) => ({ ...prev, ...data }));

          // Always refresh the wantlist list from DB — no-store bypasses any browser cache
          const wRes = await fetch("/api/discogs/wantlist", { cache: "no-store" });
          if (wRes.ok) {
            const wData = await wRes.json();
            if (Array.isArray(wData)) setWantlist(wData);
          }

          if (data.status === "completed" || data.status === "failed") break;
        } catch { /* ignore */ }
      }
    }

    poll();
    return () => { active = false; };
  }, [wantlistImportJob?.job_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const myRecords = Array.isArray(collection) ? collection.filter((r) => !r.for_sale) : [];
  const forSaleRecords = Array.isArray(collection) ? collection.filter((r) => r.for_sale) : [];
  const pool = myRecords;

  const personalTheme = useMemo(() => {
    if (theme !== "personal" || !myRecords.length) return null;
    const genreCounts = {};
    myRecords.forEach(r => getGenres(r).forEach(g => {
      genreCounts[g.toLowerCase()] = (genreCounts[g.toLowerCase()] || 0) + 1;
    }));
    const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
    const primaryHex  = getGenrePalette(sorted[0]?.[0] ?? "").hex;
    const secondaryHex = getGenrePalette(sorted[1]?.[0] ?? "").hex;
    const decadeCounts = {};
    myRecords.forEach(r => {
      const yr = Number(r.year_original || r.year_pressed);
      if (yr) { const d = Math.floor(yr / 10) * 10; decadeCounts[d] = (decadeCounts[d] || 0) + 1; }
    });
    const dominantDecade = Number(Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1980);
    const played = myRecords.filter(r => (playCounts[r.id] || 0) > 0);
    const avgPlays = played.length ? played.reduce((s, r) => s + (playCounts[r.id] || 0), 0) / played.length : 0;
    return { primaryHex, secondaryHex, dominantDecade, engaged: avgPlays > 3, sorted };
  }, [theme, myRecords, playCounts]);

  useEffect(() => {
    if (theme !== "personal" || !personalTheme) return;
    const root = document.documentElement;

    // Build proportional genre gradient — same logic as collection card (top 4 genres)
    const genreSlice = personalTheme.sorted.slice(0, 4);
    const total = genreSlice.reduce((s, [, c]) => s + c, 0);
    const stops = [];
    let pos = 0;
    genreSlice.forEach(([genre, count], i) => {
      const [c0, c1] = getStoryGradient(genre);
      stops.push(`${c0} ${(pos * 100).toFixed(1)}%`);
      pos += count / total;
      if (i === genreSlice.length - 1) stops.push(`${c1} 100%`);
    });
    const vivid = `linear-gradient(135deg, ${stops.join(", ")})`;
    // Dark overlay (~55%) on top — lets the colors breathe through
    const withOverlay = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), ${vivid}`;
    root.style.setProperty("--bg-app", withOverlay);

    return () => {
      root.style.removeProperty("--bg-app");
    };
  }, [theme, personalTheme]);

  const sorted = useMemo(() => [...pool].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "year") cmp = (a.year_original || a.year_pressed || 9999) - (b.year_original || b.year_pressed || 9999);
    else if (sortBy === "genre") cmp = (a.genres || a.genre || "").localeCompare(b.genres || b.genre || "");
    else if (sortBy === "hearts") cmp = (a.favorite_tracks || []).length - (b.favorite_tracks || []).length;
    else if (sortBy === "energy") cmp = (spotifyFeatures[a.id]?.energy || 0) - (spotifyFeatures[b.id]?.energy || 0);
    else /* az */ cmp = (a.artist || "").localeCompare(b.artist || "");
    return sortDir === "asc" ? cmp : -cmp;
  }), [pool, sortBy, sortDir]);

  const filtered = useMemo(() => sorted.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (r.title || "").toLowerCase().includes(q) ||
      (r.artist || "").toLowerCase().includes(q) ||
      (r.genre || "").toLowerCase().includes(q) ||
      (r.styles || "").toLowerCase().includes(q) ||
      (r.tracks || []).some((t) => (t.title || "").toLowerCase().includes(q));
    const matchesGenre = !activeGenres.size || getGenres(r).some((g) => activeGenres.has(g));
    const matchesStyle = !activeStyles.size || getStyles(r).some((s) => activeStyles.has(s));
    const matchesDecade = !activeDecade.size || activeDecade.has(getDecade(r));
    const matchesFormat = !activeFormat || getFormat(r) === activeFormat;
    const matchesLabel = !activeLabel || (r.label || "").toLowerCase().includes(activeLabel.toLowerCase());
    return matchesSearch && matchesGenre && matchesStyle && matchesDecade && matchesFormat && matchesLabel;
  }), [sorted, search, activeGenres, activeStyles, activeDecade, activeFormat, activeLabel]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRecords = infiniteScroll
    ? filtered.slice(0, visibleCount)
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasMore = infiniteScroll && visibleCount < filtered.length;

  // Lazy-load audio features when a detail card opens:
  // 1. The opened record itself (immediate priority)
  // 2. ±2 neighbors in the current sorted view (visible context)
  // 3. Up to 3 most-played records still missing features (background value)
  useEffect(() => {
    if (!selected || !myRecords.length) return;
    const queue = [];
    // The opened record
    if (!spotifyFeatures[selected.id]) queue.push(selected);
    // Neighbors in current sorted view
    const idx = sorted.findIndex(r => r.id === selected.id);
    if (idx !== -1) {
      const neighbors = sorted.slice(Math.max(0, idx - 2), Math.min(sorted.length, idx + 3));
      for (const r of neighbors) {
        if (!spotifyFeatures[r.id] && !queue.find(q => q.id === r.id)) queue.push(r);
      }
    }
    // Top-played uncached (up to 3) to fill in high-value records passively
    const topPlayed = [...myRecords]
      .filter(r => !spotifyFeatures[r.id] && !queue.find(q => q.id === r.id))
      .sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0))
      .slice(0, 3);
    queue.push(...topPlayed);

    if (queue.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const record of queue) {
        if (cancelled) break;
        await fetchOneFeature(record);
      }
    })();
    return () => { cancelled = true; };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy Discogs + MusicBrainz enrichment triggered by detail card open.
  // Fires for the opened record + ±2 neighbors in the current sorted view,
  // plus up to 3 most-played records still missing basic metadata.
  // All calls are fire-and-forget — server checks what's actually missing.
  useEffect(() => {
    console.log("[enrich] effect fired — selected:", selected?.id, "myRecords:", myRecords.length);
    if (!selected || !myRecords.length) return;
    const queue = [selected];
    const idx = sorted.findIndex(r => r.id === selected.id);
    if (idx !== -1) {
      const neighbors = sorted.slice(Math.max(0, idx - 2), Math.min(sorted.length, idx + 3));
      for (const r of neighbors) {
        if (!queue.find(q => q.id === r.id)) queue.push(r);
      }
    }
    // Passive fill: top-played records still missing year_original or thumb
    const topPlayed = [...myRecords]
      .filter(r => !queue.find(q => q.id === r.id) && (r.year_original == null || !r.thumb))
      .sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0))
      .slice(0, 3);
    queue.push(...topPlayed);
    // Stagger calls: immediate for focused record, then 2s apart to stay within rate limits
    queue.forEach((r, i) => setTimeout(() => silentEnrich(r.id), i * 2000));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const honeycombRecords = (() => {
    const dir = honeycombSortDir === "asc" ? 1 : -1;
    if (honeycombSort === "year") {
      return [...filtered].sort((a, b) =>
        dir * ((a.year_original || a.year_pressed || 9999) - (b.year_original || b.year_pressed || 9999))
      );
    }
    if (honeycombSort === "az") {
      return [...filtered].sort((a, b) => dir * (a.artist || "").localeCompare(b.artist || ""));
    }
    if (honeycombSort === "energy") {
      return [...filtered].sort((a, b) => dir * ((spotifyFeatures[a.id]?.energy || 0) - (spotifyFeatures[b.id]?.energy || 0)));
    }
    if (honeycombSort === "hearts") {
      return [...filtered].sort((a, b) => dir * ((a.favorite_tracks || []).length - (b.favorite_tracks || []).length));
    }
    // Genre mode: biggest genre cluster first, most-played within genre first
    const primaryGenre = (r) => getGenres(r)[0] || "zzz";
    const genreCounts = {};
    filtered.forEach((r) => { genreCounts[primaryGenre(r)] = (genreCounts[primaryGenre(r)] || 0) + 1; });
    return [...filtered].sort((a, b) => {
      const ga = primaryGenre(a);
      const gb = primaryGenre(b);
      if (ga !== gb) {
        const countDiff = (genreCounts[gb] || 0) - (genreCounts[ga] || 0);
        return countDiff !== 0 ? countDiff : ga.localeCompare(gb);
      }
      const playDiff = (playCounts[b.id] || 0) - (playCounts[a.id] || 0);
      return playDiff !== 0 ? playDiff : (a.year_original || a.year_pressed || 9999) - (b.year_original || b.year_pressed || 9999);
    });
  })();

  const decades = useMemo(() => {
    const ds = new Set(pool.map(r => getDecade(r)).filter(Boolean));
    return [...ds].sort();
  }, [pool]);

  function scoreRecord(candidate, context) {
    let score = 0;
    const cGenres = getGenres(candidate);
    const refGenres = context.refGenres || [];
    score += cGenres.filter(g => refGenres.includes(g)).length * 2;
    const cDecade = Math.floor((candidate.year_original || candidate.year_pressed || 0) / 10);
    const refDecade = context.refDecade || 0;
    if (cDecade && refDecade) {
      if (cDecade === refDecade) score += 1;
      else if (Math.abs(cDecade - refDecade) === 1) score += 0.5;
    }
    const cf = context.allFeatures?.[candidate.id];
    const rf = context.refFeatures;
    if (cf && rf) {
      const energyDiff = Math.abs(cf.energy - rf.energy);
      const tempoBucket = Math.abs((cf.tempo || 120) - (rf.tempo || 120)) / 60;
      score += Math.max(0, 1 - energyDiff) * 1.5;
      score += Math.max(0, 1 - tempoBucket) * 1.0;
    }
    if (context.recentlyPlayedIds?.has(candidate.id)) score *= 0.3;
    return score;
  }

  /** Build a rich one-liner about a record for Claude context. */
  function describeRecord(r) {
    const year = r.year_original || r.year_pressed || "?";
    const genres = (r.styles || r.genres || r.genre || "").replace(/,/g, ", ");
    const plays = playCounts[r.id] || 0;
    const f = spotifyFeatures[r.id];
    let profile = "";
    if (f) {
      const tags = [];
      if (f.energy > 0.7) tags.push("high-energy");
      else if (f.energy < 0.35) tags.push("low-energy");
      if (f.valence > 0.7) tags.push("upbeat mood");
      else if (f.valence < 0.3) tags.push("melancholic");
      if (f.danceability > 0.7) tags.push("danceable");
      if (f.acousticness > 0.7) tags.push("acoustic");
      if (tags.length) profile = ` [${tags.join(", ")}]`;
    }
    return `"${r.title}" by ${r.artist} (${year}, ${genres || "unknown genre"})${profile}${plays > 0 ? ` — played ${plays}×` : ""}`;
  }

  const getReco = useCallback(
    async (type) => {
      setRecoLoading(true);
      setRecoError("");
      setReco(null);
      try {
        const recoFilteredRecords = myRecords.filter(r => {
          if (recoFilterGenres.size > 0 && !getGenres(r).some(g => recoFilterGenres.has(g))) return false;
          if (recoFilterDecades.size > 0) {
            const decade = String(Math.floor((r.year_original || r.year_pressed || 0) / 10) * 10);
            if (!recoFilterDecades.has(decade)) return false;
          }
          return true;
        });
        const activePool = recoFilteredRecords.length > 0 ? recoFilteredRecords : myRecords;
        if (type === "daily") {
          const DAILY_CACHE_KEY = "cratemate_daily_picks";
          const todayStr = new Date().toISOString().slice(0, 10);

          // ── Check localStorage cache first ──
          try {
            const raw = localStorage.getItem(DAILY_CACHE_KEY);
            if (raw) {
              const cached = JSON.parse(raw);
              if (cached.date === todayStr && Array.isArray(cached.picks)) {
                const valid = cached.picks
                  .map((p) => ({ ...p, record: myRecords.find((r) => String(r.id) === String(p.recordId)) }))
                  .filter((p) => p.record);
                if (valid.length > 0) {
                  const pick = valid[Math.floor(Math.random() * valid.length)];
                  setReco({ record: pick.record, reason: pick.reason, label: "Today's Pick" });
                  return;
                }
              }
            }
          } catch {}

          // ── No cache — run full pipeline ──
          const SYSTEM = "You are a passionate music obsessive recommending records from a friend's personal collection. Be warm and specific — speak to the music, not the calendar. Avoid filler slang like dude, man, or bro. Return valid JSON only — no markdown, no prose outside the JSON.";

          async function generateHookReason(hook) {
            try {
              const text = await callClaude(
                [{ role: "user", content: `Here's a fun fact about a record in my collection:\n\n${hook.fact}\n\nThe record: ${describeRecord(hook.record)}.\n\nWrite 1-2 casual conversational sentences that surface this fact and make me want to pull it out right now.\n\nRespond ONLY with JSON: {"reason":"..."}` }],
                80, SYSTEM
              );
              const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
              let parsed;
              try { parsed = JSON.parse(stripped); } catch { const m = stripped.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
              if (Array.isArray(parsed)) parsed = parsed[0];
              return parsed?.reason || hook.fact;
            } catch {
              return hook.fact;
            }
          }

          let artistMembers = {};
          try {
            const uniqueArtists = [...new Set(myRecords.filter(r => !r.is_compilation).map(r => r.artist).filter(Boolean))];
            const res = await fetch("/api/artist/members", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ artists: uniqueArtists }),
            });
            if (res.ok) artistMembers = await res.json();
          } catch {}

          let lastfmVibeData = null;
          try {
            const recentArtists = [...new Set(
              [...playSessions]
                .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
                .map((s) => myRecords.find((r) => String(r.id) === String(s.record_id)))
                .filter((r) => r && !r.is_compilation)
                .map((r) => stripArtistNum(r.artist || "").trim())
                .filter(Boolean)
            )].slice(0, 5);
            if (recentArtists.length > 0) {
              const lfmRes = await fetch(`/api/lastfm/similar?artists=${encodeURIComponent(recentArtists.join(","))}`);
              if (lfmRes.ok) {
                const lfmData = await lfmRes.json();
                const map = new Map((lfmData.similar || []).map((s) => [s.name.toLowerCase().trim(), s.score]));
                if (map.size > 0) lastfmVibeData = { map, seeds: recentArtists };
              }
            }
          } catch {}

          const hooks = buildTodayHook(myRecords, lastPlayedDates, playCounts, spotifyFeatures, artistMembers, todayWeather, playSessions, lastfmVibeData);

          if (hooks.length > 0) {
            // Pick one hook, generate one reason — cache it. On re-tap, pick a different one.
            let cached = [];
            try { cached = JSON.parse(localStorage.getItem(DAILY_CACHE_KEY) || "{}").picks || []; } catch {}
            const cachedIds = new Set(cached.map(p => p.recordId));
            // Prefer a hook we haven't cached yet
            let hook = hooks.find(h => !cachedIds.has(h.record.id)) || hooks[Math.floor(Math.random() * hooks.length)];
            const reason = await generateHookReason(hook);
            const newPick = { recordId: hook.record.id, reason, hookType: hook.type };
            cached.push(newPick);
            try { localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ date: todayStr, picks: cached })); } catch {}
            setReco({ record: hook.record, reason, label: "Today's Pick" });
            return;
          }

          // No hooks — heuristic fallback (cache single result)
          const recentIds = new Set(
            Object.entries(lastPlayedDates)
              .filter(([, d]) => (Date.now() - new Date(d).getTime()) < 7 * 86400000)
              .map(([id]) => parseInt(id))
          );
          const pool = dedupeByAlbum(activePool, playCounts).filter(r => !recentIds.has(r.id));
          const refRecord = lastPlayed;
          const context = {
            refGenres: refRecord ? getGenres(refRecord) : [],
            refDecade: refRecord ? Math.floor((refRecord.year_original || refRecord.year_pressed || 0) / 10) : 0,
            refFeatures: refRecord ? spotifyFeatures[refRecord.id] : null,
            allFeatures: spotifyFeatures,
            recentlyPlayedIds: recentIds,
          };
          const deduped = dedupeByAlbum(activePool, playCounts);
          const scored = (pool.length ? pool : deduped).map(r => ({ r, s: scoreRecord(r, context) })).sort((a, b) => b.s - a.s);
          const picked = scored[0]?.r || myRecords[Math.floor(Math.random() * myRecords.length)];
          let reason;
          try {
            const text = await callClaude([{ role: "user", content: `The record: ${describeRecord(picked)}.\n\nIt was chosen because it hasn't been played recently and fits the collection's sound. Write 1-2 warm casual sentences about why to put it on now — mention the genre or era if it helps.\n\nRespond ONLY with JSON: {"reason":"..."}` }], 100, SYSTEM);
            const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
            let parsed; try { parsed = JSON.parse(stripped); } catch { const m = stripped.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
            if (Array.isArray(parsed)) parsed = parsed[0];
            if (parsed?.reason) reason = parsed.reason;
          } catch {}
          if (!reason) {
            const genres = (picked.styles || picked.genres || picked.genre || "").split(",").map(g => g.trim()).filter(Boolean);
            const year = picked.year_original || picked.year_pressed;
            reason = genres.length && year
              ? `A ${genres[0].toLowerCase()} gem from ${year} that deserves another spin.`
              : `Haven't played this one in a while — time to revisit.`;
          }
          try { localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ date: todayStr, picks: [{ recordId: picked.id, reason, hookType: "heuristic" }] })); } catch {}
          setReco({ record: picked, reason, label: "Today's Pick" });

        } else if (type === "random") {
          // Weighted random: less-played records get higher weight.
          const randomPool = dedupeByAlbum(activePool, playCounts);
          const weights = randomPool.map(r => 1 / ((playCounts[r.id] || 0) + 1));
          const total = weights.reduce((a, b) => a + b, 0);
          let picked = randomPool[randomPool.length - 1];
          let rand = Math.random() * total;
          for (let i = 0; i < randomPool.length; i++) {
            rand -= weights[i];
            if (rand <= 0) { picked = randomPool[i]; break; }
          }
          // Check cache — serve existing reason if we've already generated one for this record
          const RANDOM_CACHE_KEY = "cratemate_random_picks";
          let reason;
          try {
            const cached = JSON.parse(localStorage.getItem(RANDOM_CACHE_KEY) || "[]");
            const hit = cached.find(c => c.recordId === picked.id);
            if (hit) { reason = hit.reason; }
          } catch {}
          if (!reason) {
            const plays = playCounts[picked.id] || 0;
            const SYSTEM = "You are a passionate music obsessive. Write exactly ONE casual sentence (under 20 words) about why to spin this record right now. Be specific to the artist, era, or sound — not generic. Return plain text only, no quotes.";
            const prompt = `The wheel landed on: ${describeRecord(picked)}.${plays === 0 ? " Never played." : ` Played ${plays} time${plays > 1 ? "s" : ""}.`}`;
            reason = (await callClaude([{ role: "user", content: prompt }], 80, SYSTEM)).trim();
            try {
              const cached = JSON.parse(localStorage.getItem(RANDOM_CACHE_KEY) || "[]");
              cached.unshift({ recordId: picked.id, reason });
              localStorage.setItem(RANDOM_CACHE_KEY, JSON.stringify(cached.slice(0, 10)));
            } catch {}
          }
          setReco({ record: picked, reason, label: "Random Pick" });

        } else if (type === "next") {
          if (!lastPlayed) { setRecoError("Log a play first to get a Next pick."); return; }
          const context = {
            refGenres: getGenres(lastPlayed),
            refDecade: Math.floor((lastPlayed.year_original || lastPlayed.year_pressed || 0) / 10),
            refFeatures: spotifyFeatures[lastPlayed.id],
            allFeatures: spotifyFeatures,
            recentlyPlayedIds: new Set(Object.entries(lastPlayedDates).filter(([,d]) => (Date.now() - new Date(d).getTime()) < 7 * 86400000).map(([id]) => parseInt(id))),
          };
          const candidates = dedupeByAlbum(activePool, playCounts).filter(r => r.id !== lastPlayed.id);
          const scored = candidates.map(r => ({ r, s: scoreRecord(r, context) })).sort((a, b) => b.s - a.s);
          const picked = scored[0]?.r || candidates[0];
          if (!picked) { setRecoError("Not enough records to suggest a next pick."); return; }
          const SYSTEM = "You are a passionate music obsessive recommending records from a friend's personal collection. Be warm and specific — speak to the music, not the calendar. Avoid filler slang like dude, man, or bro. Return valid JSON only — no markdown, no prose outside the JSON.";
          const text = await callClaude([{ role: "user", content: `I just played: ${describeRecord(lastPlayed)}.\n\nFrom my collection, the best follow-up is: ${describeRecord(picked)}.\n\nIt was chosen because it matches the genre, era, and energy of what I just played. Write 1-2 warm casual sentences about the sonic connection between these two records and why to put it on next.\n\nRespond ONLY with JSON: {"reason":"..."}` }], 120, SYSTEM);
          const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
          let parsed; try { parsed = JSON.parse(stripped); } catch { const m = stripped.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
          if (Array.isArray(parsed)) parsed = parsed[0];
          if (!parsed?.reason) throw new Error("bad-schema");
          setReco({ record: picked, reason: parsed.reason, label: "Play Next" });

        } else { // mood
          // Build a diverse shortlist of ~15 candidates for Claude to choose from
          const moodPool = dedupeByAlbum(activePool, playCounts);
          // Shuffle and pick a diverse sample (mix of genres/decades)
          const shuffled = [...moodPool].sort(() => Math.random() - 0.5);
          const shortlist = shuffled.slice(0, Math.min(15, shuffled.length));
          const numbered = shortlist.map((r, i) => `${i + 1}. ${describeRecord(r)}`).join("\n");

          const SYSTEM = "You are a passionate music obsessive recommending records from a friend's personal collection. Be warm and specific — speak to the music, not the calendar. Avoid filler slang like dude, man, or bro. Return valid JSON only — no markdown, no prose outside the JSON.";
          const text = await callClaude([{ role: "user", content: `My mood right now: "${mood}"\n\nHere are some records from my collection:\n${numbered}\n\nPick the ONE record (by number) that best matches this mood. Consider genre, energy, era, and feel. Write 1-2 warm sentences about why this record fits the mood perfectly.\n\nRespond ONLY with JSON: {"pick": <number>, "reason":"..."}` }], 150, SYSTEM);
          const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
          let parsed; try { parsed = JSON.parse(stripped); } catch { const m = stripped.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
          if (Array.isArray(parsed)) parsed = parsed[0];
          const pickIdx = (parsed?.pick ?? 1) - 1;
          const picked = shortlist[Math.max(0, Math.min(pickIdx, shortlist.length - 1))] || shortlist[0];
          if (!parsed?.reason) throw new Error("bad-schema");
          setReco({ record: picked, reason: parsed.reason, label: "Mood Match" });
        }
      } catch (err) {
        if (err.message === "bad-schema" || err.message === "no-json") setRecoError("Got an unexpected response — try again.");
        else setRecoError("Couldn't reach the AI — check your connection and try again.");
      } finally {
        setRecoLoading(false);
      }
    },
    [myRecords, mood, lastPlayed, lastPlayedDates, playCounts, spotifyFeatures, recoFilterGenres, recoFilterDecades]
  );

  // Keep getRecoRef current (declared before getReco, assigned here after)
  useEffect(() => { getRecoRef.current = getReco; }, [getReco]);

  // Show toast when daily pick auto-generates (no cached pick existed)
  useEffect(() => {
    if (!reco || reco.label !== "Today's Pick" || dailyPickToast) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const dismissed = localStorage.getItem("cratemate_daily_toast_dismissed");
      if (dismissed === todayStr) return;
    } catch {}
    setDailyPickToast({ record: reco.record, reason: reco.reason });
    setDailyPickToastMinimized(false);
  }, [reco]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-minimize full toast into header after 9 seconds
  useEffect(() => {
    if (!dailyPickToast || dailyPickToastMinimized) return;
    const id = setTimeout(() => setDailyPickToastMinimized(true), 9000);
    return () => clearTimeout(id);
  }, [dailyPickToast, dailyPickToastMinimized]);

  // Dismiss daily toast when user visits Picks tab
  useEffect(() => {
    if (tab === "reco" && (dailyPickToast || dailyPickToastMinimized)) {
      setDailyPickToast(null);
      setDailyPickToastMinimized(false);
      try { localStorage.setItem("cratemate_daily_toast_dismissed", new Date().toISOString().slice(0, 10)); } catch {}
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run "Play Next" when navigating to Picks tab via "▶︎ Picks" from a record detail
  useEffect(() => {
    if (autoTriggerReco && tab === "reco" && lastPlayed && !recoLoading) {
      setAutoTriggerReco(false);
      getReco("next");
    }
  }, [autoTriggerReco, tab, lastPlayed, recoLoading]);

  async function handleDiscogsImport() {
    setImportLoading(true);
    setImportResult(null);
    try {
      // Step 1 — Start the import job (fetches page 1 synchronously, returns job state)
      const startRes = await fetch("/api/discogs/import/job", { method: "POST" });
      const startData = await readJsonOrText(startRes);
      if (!startRes.ok) throw new Error(startData?.error || `Import failed (${startRes.status})`);

      const jobId = startData.id;
      if (!jobId) throw new Error("No import job ID returned");

      // Show first page of records immediately
      await refreshRecords();
      setImportLoading(false);
      setImportResult({ stage: "importing", importJobId: jobId, ...startData });

      // If the first page already completed the import (single-page collections), skip polling.
      if (startData.status !== "completed") {
        // Poll: each GET fetches the next Discogs collection page (100 records at a time)
        const MAX_POLLS = 600; // 10 minutes max (600 × 1s)
        let polls = 0;
        while (polls < MAX_POLLS) {
          await new Promise((r) => setTimeout(r, 1000));
          polls++;
          const pollRes = await fetch(`/api/discogs/import/job/${jobId}`);
          const pollData = await readJsonOrText(pollRes);
          if (!pollRes.ok) break;

          setImportResult((prev) => ({ ...prev, ...pollData }));

          // Refresh records every 3 pages so user sees them appearing
          if (polls % 3 === 0) refreshRecords();

          if (pollData.status === "completed" || pollData.status === "failed") break;
        }
      }

      // Show final count
      await refreshRecords();
      setImportResult((prev) => ({ ...prev, stage: "enriching" }));
      setEnrichLoading(true);

      // Step 2a — Thumb-only pass: get covers in front of users fast before full enrichment.
      // Each poll processes 2 records; we refresh the collection every 10 polls so art
      // appears progressively. Full enrichment (step 2b) skips records that already have
      // a good thumb, so no API calls are duplicated.
      try {
        const thumbRes = await fetch("/api/discogs/enrich/job?mode=thumb", { method: "POST" });
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          const thumbJobId = thumbData.job_id;
          if (thumbJobId) {
            for (let i = 0; i < 600; i++) {
              await new Promise((r) => setTimeout(r, 600));
              const pollRes = await fetch(`/api/discogs/enrich/job/${encodeURIComponent(thumbJobId)}`);
              if (!pollRes.ok) break;
              const data = await pollRes.json();
              if (i % 10 === 9) refreshRecords(); // show covers as they arrive
              if (data.status === "completed" || data.status === "failed") break;
            }
            refreshRecords(); // final refresh after thumb pass
          }
        }
      } catch { /* non-blocking — full pass will still handle covers */ }

      // Step 2b — Full enrichment (metadata + artist dates + release dates)
      runEnrichAll("full", (progress) => {
        setImportResult((prev) => ({ ...prev, enrichProgress: { ...progress, total: myRecords.length } }));
      })
        .then((meta) => {
          setImportResult((prev) => ({ ...prev, meta, stage: "done" }));
          const syncedAt = new Date().toISOString();
          try { localStorage.setItem("cratemate_last_synced", syncedAt); } catch {}
          setLastSyncedAt(syncedAt);
          refreshRecords();
          // Re-trigger background audio features enrichment for newly imported records
          enrichmentStarted.current = false;
        })
        .catch((enrichErr) => {
          console.error("Post-import enrich failed:", enrichErr);
          setImportResult((prev) => ({ ...prev, stage: "done" }));
        })
        .finally(() => setEnrichLoading(false));
    } catch (e) {
      setImportResult({ error: e instanceof Error ? e.message : "Discogs import failed." });
      setImportLoading(false);
      setEnrichLoading(false);
    }
  }

  const ENRICH_JOB_KEY = "cratemate_enrich_jobs";
  const ENRICH_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  function saveEnrichJobs(metaJobId, artistJobId, releaseDatesJobId) {
    try { localStorage.setItem(ENRICH_JOB_KEY, JSON.stringify({ metaJobId, artistJobId, releaseDatesJobId, startedAt: Date.now() })); } catch {}
  }
  function clearEnrichJobs() {
    try { localStorage.removeItem(ENRICH_JOB_KEY); } catch {}
  }
  function loadEnrichJobs() {
    try {
      const raw = localStorage.getItem(ENRICH_JOB_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.metaJobId) return null;
      if (Date.now() - (parsed.startedAt || 0) > ENRICH_JOB_MAX_AGE_MS) { clearEnrichJobs(); return null; }
      return parsed;
    } catch { return null; }
  }

  async function pollEnrichJobs(metaJobId, artistJobId, releaseDatesJobId, metaInitial, artistInitial, onProgress) {
    enrichRunningRef.current = true;
    // Poll metadata job until done
    let metaLatest = metaInitial || { status: "running" };
    while (metaLatest.status !== "completed" && metaLatest.status !== "failed") {
      await new Promise((r) => setTimeout(r, 600));
      const res = await fetch(`/api/discogs/enrich/job/${encodeURIComponent(metaJobId)}`);
      const data = await readJsonOrText(res);
      if (res.ok) {
        metaLatest = data;
        if (onProgress) {
          onProgress({
            processed: data.processed || 0,
            considered: data.considered || 0,
            offset: data.batch_offset ?? null,
          });
        }
      }
    }

    // Artist + release-dates jobs run in background — poll but don't block
    async function pollBackgroundJob(jobId) {
      if (!jobId) return;
      for (let i = 0; i < 300; i++) {
        const res = await fetch(`/api/discogs/enrich/job/${encodeURIComponent(jobId)}`);
        const data = await readJsonOrText(res);
        if (!res.ok) break;
        if (data.status === "completed" || data.status === "failed") break;
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    await Promise.all([
      pollBackgroundJob(artistJobId),
      pollBackgroundJob(releaseDatesJobId),
    ]);

    enrichRunningRef.current = false;
    clearEnrichJobs();
    if (metaLatest.status === "failed") throw new Error(metaLatest.error || "Metadata job failed");

    return {
      updated: metaLatest.updated || 0,
      considered: metaLatest.considered || 0,
      warning: metaLatest.warning || "",
    };
  }

  async function runEnrichAll(mode, onProgress) {
    // Start all three jobs simultaneously — all independent
    const [metaRes, artistRes, releaseDatesRes] = await Promise.all([
      fetch(`/api/discogs/enrich/job?mode=${encodeURIComponent(mode)}`, { method: "POST" }),
      fetch("/api/discogs/enrich/artist/job", { method: "POST" }),
      fetch("/api/discogs/enrich/release-dates/job", { method: "POST" }),
    ]);
    const metaData = await readJsonOrText(metaRes);
    const artistData = await readJsonOrText(artistRes);
    const releaseDatesData = await readJsonOrText(releaseDatesRes);
    if (!metaRes.ok) throw new Error(metaData?.error || `Metadata sync failed (${metaRes.status})`);
    if (!artistRes.ok) throw new Error(artistData?.error || `Artist sync failed (${artistRes.status})`);
    // release-dates failure is non-blocking — log but don't abort

    const metaJobId = metaData.job_id;
    const artistJobId = artistData.job_id;
    const releaseDatesJobId = releaseDatesData?.job_id || null;
    if (!metaJobId) throw new Error("Missing metadata job id");
    if (!artistJobId) throw new Error("Missing artist job id");

    saveEnrichJobs(metaJobId, artistJobId, releaseDatesJobId);

    return pollEnrichJobs(metaJobId, artistJobId, releaseDatesJobId, metaData, artistData, onProgress);
  }

  async function handleCleanupSeeded() {
    if (!window.confirm("Remove all unlinked records (discogs_id is empty) from your crate?")) return;
    setCleanupLoading(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/records/cleanup", { method: "POST" });
      const data = await readJsonOrText(res);
      if (!res.ok) throw new Error(data?.error || `Cleanup failed (${res.status})`);
      setImportResult({ imported: 0, total: 0, cleanup: true, deleted: data.deleted || 0 });
      await refreshRecords();
    } catch (e) {
      setImportResult({ error: e instanceof Error ? e.message : "Cleanup failed." });
    } finally {
      setCleanupLoading(false);
    }
  }

  function drillByDecade(decade) {
    setPreviousTab(tab);
    setActiveDecade(new Set([decade])); setActiveFormat(null); setActiveGenres(new Set());
    setStatFilterLabel(decade); setViewMode("drift"); setTab("crate");
  }
  function drillByGenre(genre) {
    setPreviousTab(tab);
    setActiveGenres(new Set([genre])); setActiveStyles(new Set()); setActiveDecade(new Set()); setActiveFormat(null);
    setStatFilterLabel(genre); setViewMode("drift"); setTab("crate");
  }
  function drillByStyle(style) {
    setPreviousTab(tab);
    setActiveStyles(new Set([style])); setActiveGenres(new Set()); setActiveDecade(new Set()); setActiveFormat(null);
    setStatFilterLabel(style); setViewMode("drift"); setTab("crate");
  }
  function drillByGenreAndStyle(genre, style) {
    setPreviousTab(tab);
    setActiveGenres(new Set([genre])); setActiveStyles(new Set([style])); setActiveDecade(new Set()); setActiveFormat(null);
    setStatFilterLabel(`${genre} · ${style}`); setViewMode("drift"); setTab("crate");
  }
  function drillByFormat(fmt) {
    setPreviousTab(tab);
    setActiveFormat(fmt); setActiveDecade(new Set()); setActiveGenres(new Set());
    setStatFilterLabel(fmt); setViewMode("drift"); setTab("crate");
  }
  function drillByLabel(label) {
    setPreviousTab(tab);
    setActiveLabel(label); setActiveDecade(new Set()); setActiveGenres(new Set()); setActiveFormat(null);
    setStatFilterLabel(label); setViewMode("drift"); setTab("crate");
  }
  function clearStatFilter() {
    setActiveDecade(new Set()); setActiveFormat(null); setActiveGenres(new Set()); setActiveStyles(new Set()); setActiveLabel(null); setStatFilterLabel(null);
    setPreviousTab(null);
  }

  // ── Play Trail ──────────────────────────────────────────────────────────────

  async function loadSpotifyFeatures() {
    try {
      const res = await fetch("/api/spotify/features");
      if (!res.ok) return;
      const raw = await res.json();
      const normalized = Object.fromEntries(
        Object.entries(raw).map(([id, f]) => [
          id,
          f.loudness != null ? { ...f, loudness: Math.min(1, Math.max(0, (f.loudness + 30) / 27)) } : f,
        ])
      );
      setSpotifyFeatures(normalized);
    } catch {}
  }

  async function fetchAndCacheFeatures(record) {
    if (spotifyFeatures[record.id]) return spotifyFeatures[record.id];
    try {
      const res = await fetch("/api/spotify/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: record.id, artist: record.artist, title: record.title }),
      });
      if (!res.ok) return null;
      const raw = await res.json();
      if (!raw) return null;
      // Normalize loudness from dB (typically -30..−3) to 0–1
      const f = raw.loudness != null
        ? { ...raw, loudness: Math.min(1, Math.max(0, (raw.loudness + 30) / 27)) }
        : raw;
      setSpotifyFeatures(prev => ({ ...prev, [record.id]: f }));
      return f;
    } catch { return null; }
  }

  function computeTrailSuggestions(centerRecord, features, seenKeys = new Set()) {
    const centerKey = getCanonicalKey(centerRecord);
    seenKeys.add(centerKey);
    const candidates = dedupeByAlbum(myRecords, playCounts)
      .filter(r => !seenKeys.has(getCanonicalKey(r)));

    // Resolve features: real Spotify data first, then genre-based estimate
    function resolveFeatures(r) {
      return features[r.id] || estimateFeaturesFromRecord(r);
    }
    function hasRealFeatures(r) {
      return !!features[r.id];
    }

    // Build micro-explanation pills for a suggestion
    function buildExplanation(r, direction) {
      const rf = resolveFeatures(r);
      const eDiff = rf.energy - cf.energy;
      const pills = [];
      if (direction === "windDown") pills.push(`↓ energy`);
      else if (direction === "liftUp") pills.push(`↑ energy`);
      else pills.push(`↔ same energy`);
      const topGenre = getGenres(r)[0];
      if (topGenre) pills.push(topGenre);
      const year = r.year_original;
      if (year) pills.push(`${Math.floor(year / 10) * 10}s`);
      return pills.slice(0, 3);
    }

    const cf = resolveFeatures(centerRecord);

    function score(r, direction) {
      const rf = resolveFeatures(r);
      const eDiff = rf.energy - cf.energy;

      // --- 5D proximity scoring ---
      // Weighted Euclidean distance across all sound dimensions.
      // Smaller distance = more similar sound = higher score.
      // Energy direction (lower/higher) is a hard gate, not a score component.
      const normTempo = (v) => (v ?? 120) / 200; // normalise BPM to ~0-1 range
      const dist5D = Math.sqrt(
        0.35 * Math.pow(rf.energy - cf.energy, 2) +
        0.25 * Math.pow((rf.valence ?? 0.5) - (cf.valence ?? 0.5), 2) +
        0.15 * Math.pow((rf.acousticness ?? 0.5) - (cf.acousticness ?? 0.5), 2) +
        0.15 * Math.pow((rf.danceability ?? 0.5) - (cf.danceability ?? 0.5), 2) +
        0.10 * Math.pow(normTempo(rf.tempo) - normTempo(cf.tempo), 2)
      );
      // Convert distance to a 0-1 proximity score — closer = higher
      const proximity = 1 - Math.min(dist5D / 0.8, 1);

      // Soft era / genre affinity bonus (secondary — keeps suggestions feeling connected)
      const eraBonus   = Math.abs((r.year_original || 1980) - (centerRecord.year_original || 1980)) <= 20 ? 0.15 : 0;
      const genreBonus = getGenres(r).some(g => getGenres(centerRecord).includes(g)) ? 0.10 : 0;

      let s;
      if (direction === "windDown") {
        if (eDiff > -0.04) return -1; // below 0.04 = noise, hide slot
        // Prefer ideal shift (≥0.08); acceptable shift (0.04–0.08) gets a small penalty
        const idealBonus = eDiff <= -0.08 ? 0.15 : 0;
        s = proximity + eraBonus + genreBonus + idealBonus;
      } else if (direction === "liftUp") {
        if (eDiff < 0.04) return -1; // below 0.04 = noise, hide slot
        // Prefer ideal shift (≥0.08); acceptable shift (0.04–0.08) gets a small penalty
        const idealBonus = eDiff >= 0.08 ? 0.15 : 0;
        s = proximity + eraBonus + genreBonus + idealBonus;
      } else {
        // Detour: same energy orbit (gate ±0.08), different mood/vibe.
        // Reward valence CONTRAST (invert), proximity in other dims, genre divergence.
        if (Math.abs(eDiff) > 0.08) return -1; // outside energy orbit → not a detour
        const energyClose    = 1 - (Math.abs(eDiff) / 0.08); // 1.0 at 0 diff, 0 at 0.08
        const valenceContrast = Math.abs((rf.valence ?? 0.5) - (cf.valence ?? 0.5)); // higher = better
        const danceDiff      = Math.abs((rf.danceability ?? 0.5) - (cf.danceability ?? 0.5));
        const acousticDiff   = Math.abs((rf.acousticness ?? 0.5) - (cf.acousticness ?? 0.5));
        const diffGenreBonus = !getGenres(r).some(g => getGenres(centerRecord).includes(g)) ? 0.30 : 0;
        const sameEra        = Math.abs((r.year_original || 1980) - (centerRecord.year_original || 1980)) <= 15 ? 0.15 : 0;
        // Energy closeness keeps us in the same intensity zone;
        // valence + dance contrast makes it feel like a real tangent.
        s = energyClose * 0.35 + valenceContrast * 0.30 + danceDiff * 0.10 + acousticDiff * 0.05 + diffGenreBonus + sameEra;
      }

      // Recency penalty: played in last 7 days → 30% score
      const lastPlayed = lastPlayedDates[r.id];
      if (lastPlayed) {
        const daysSince = (Date.now() - new Date(lastPlayed).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) s *= 0.3;
      }
      return s;
    }

    const sorted = (dir) => [...candidates].sort((a, b) => score(b, dir) - score(a, dir));
    const pickedKeys = new Set(seenKeys);

    function pick(dir) {
      // Take top 4 valid candidates and pick with weighted randomness —
      // 50% chance of #1, otherwise random among #2-#4.
      // Prevents the same record winning every session while keeping quality high.
      const pool = sorted(dir)
        .filter(r => !pickedKeys.has(getCanonicalKey(r)) && score(r, dir) > 0)
        .slice(0, 4);
      if (!pool.length) return null;
      const idx = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * Math.min(pool.length, 3));
      const chosen = pool[idx];
      pickedKeys.add(getCanonicalKey(chosen));
      return {
        record: chosen,
        explanation: buildExplanation(chosen, dir),
        estimated: !hasRealFeatures(chosen),
      };
    }

    return {
      windDown: pick("windDown"),
      liftUp:   pick("liftUp"),
      sideways: pick("sideways"),
    };
  }

  // For non-Spotify users: use Last.fm artist similarity to rank collection records
  async function fetchLastfmNextSuggestion(centerRecord, seenKeys) {
    if (!devSimulateFree && Object.keys(spotifyFeatures).length > 0) return; // Spotify users use audio features instead
    try {
      const artistName = stripArtistNum(centerRecord.artist || "").trim();
      if (!artistName) return;
      const res = await fetch(`/api/lastfm/artist-similar?artist=${encodeURIComponent(artistName)}`);
      if (!res.ok) return;
      const data = await res.json();
      const similarMap = new Map(
        (data.similar || []).map((s) => [s.name.toLowerCase().trim(), s.match])
      );
      const candidates = dedupeByAlbum(myRecords, playCounts)
        .filter((r) => !seenKeys.has(getCanonicalKey(r)))
        .map((r) => {
          const cleanArtist = stripArtistNum(r.artist || "").toLowerCase().trim();
          const match = similarMap.get(cleanArtist) || 0;
          return { record: r, match };
        })
        .filter((c) => c.match > 0)
        .sort((a, b) => {
          const penalty = (r) =>
            lastPlayedDates[r.id] &&
            Date.now() - new Date(lastPlayedDates[r.id]).getTime() < 7 * 86400000
              ? 0.3 : 1;
          return b.match * penalty(b.record) - a.match * penalty(a.record);
        });
      setLastfmNextSuggestion(candidates.length > 0 ? { record: candidates[0].record } : null);
    } catch {
      setLastfmNextSuggestion(null);
    }
  }

  // Precompute trail suggestions for the now-playing banner (no session needed)
  const bannerSuggestionsRecordRef = useRef(null);
  useEffect(() => {
    if (!nowPlaying?.record?.id) { setBannerSuggestions(null); return; }
    if (trailCenter) return; // active session — use trailSuggestions instead
    if (bannerSuggestionsRecordRef.current === nowPlaying.record.id) return; // already computed
    bannerSuggestionsRecordRef.current = nowPlaying.record.id;
    const hasSpotify = !devSimulateFree && Object.keys(spotifyFeatures).length > 0;
    if (!hasSpotify) { setBannerSuggestions(null); return; }
    // Async: fetch features then compute
    (async () => {
      try {
        const f = spotifyFeatures[nowPlaying.record.id] || await fetchAndCacheFeatures(nowPlaying.record);
        const allFeatures = { ...spotifyFeatures, ...(f ? { [nowPlaying.record.id]: f } : {}) };
        const sug = computeTrailSuggestions(nowPlaying.record, allFeatures);
        setBannerSuggestions(sug);
        // Cache for refresh persistence
        try {
          const toCache = {};
          for (const k of ["windDown", "liftUp", "sideways"]) {
            if (sug?.[k]?.record) toCache[k] = { recordId: sug[k].record.id, explanation: sug[k].explanation, estimated: sug[k].estimated };
          }
          localStorage.setItem("cratemate_banner_sug", JSON.stringify({ recordId: nowPlaying.record.id, suggestions: toCache, ts: Date.now() }));
        } catch {}
      } catch { setBannerSuggestions(null); }
    })();
  }, [nowPlaying?.record?.id, trailCenter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore cached banner suggestions on mount (survives refresh)
  useEffect(() => {
    if (bannerSuggestions || !nowPlaying?.record?.id || !collection?.length) return;
    try {
      const raw = localStorage.getItem("cratemate_banner_sug");
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached.recordId !== nowPlaying.record.id) return;
      if (Date.now() - cached.ts > SESSION_GAP_MS) { localStorage.removeItem("cratemate_banner_sug"); return; }
      const restored = {};
      for (const k of ["windDown", "liftUp", "sideways"]) {
        if (cached.suggestions[k]) {
          const rec = collection.find(r => r.id === cached.suggestions[k].recordId);
          if (rec) restored[k] = { record: rec, explanation: cached.suggestions[k].explanation, estimated: cached.suggestions[k].estimated };
        }
      }
      if (Object.keys(restored).length > 0) {
        setBannerSuggestions(restored);
        bannerSuggestionsRecordRef.current = nowPlaying.record.id;
      }
    } catch {}
  }, [nowPlaying?.record?.id, collection?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist active trail session to localStorage
  useEffect(() => {
    if (!trailCenter) {
      try { localStorage.removeItem("cratemate_trail_session"); } catch {}
      return;
    }
    try {
      localStorage.setItem("cratemate_trail_session", JSON.stringify({
        centerId: trailCenter.id,
        historyIds: trailHistory.map(r => r.id),
        loggedIds: [...trailAlreadyLoggedIds],
        ts: Date.now(),
      }));
    } catch {}
  }, [trailCenter, trailHistory, trailAlreadyLoggedIds]);

  // Restore trail session on mount (within SESSION_GAP_MS)
  useEffect(() => {
    if (sessionRestoredRef.current || !collection?.length || trailCenter) return;
    sessionRestoredRef.current = true;
    try {
      const raw = localStorage.getItem("cratemate_trail_session");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Date.now() - saved.ts > SESSION_GAP_MS) { localStorage.removeItem("cratemate_trail_session"); return; }
      const center = collection.find(r => r.id === saved.centerId);
      if (!center) return;
      const history = saved.historyIds.map(id => collection.find(r => r.id === id)).filter(Boolean);
      if (history.length === 0) return;
      setTrailCenter(center);
      setTrailHistory(history);
      setTrailAlreadyLoggedIds(new Set(saved.loggedIds || []));
      // Recompute suggestions for the current center
      (async () => {
        setTrailLoading(true);
        try {
          const seenKeys = new Set(history.map(r => getCanonicalKey(r)));
          const centerFeatures = await fetchAndCacheFeatures(center);
          const allFeatures = { ...spotifyFeatures, ...(centerFeatures ? { [center.id]: centerFeatures } : {}) };
          setTrailSuggestions(computeTrailSuggestions(center, allFeatures, seenKeys));
        } catch {} finally { setTrailLoading(false); }
      })();
    } catch {}
  }, [collection?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enterTrail(record, seedAlreadyLogged = false) {
    setTrailCenter(record);
    setTrailHistory([record]);
    setTrailSuggestions(null);
    setTrailSearch("");
    setTrailSearchOpen(false);
    setTrailError("");
    setTrailAlreadyLoggedIds(seedAlreadyLogged ? new Set([String(record.id)]) : new Set());
    setBannerPreviewDirection(null);
    setLastfmNextSuggestion(null);
    setTrailActive(true);
    setTrailLoading(true);
    const seedKeys = new Set([getCanonicalKey(record)]);
    try {
      const [, centerFeatures] = await Promise.all([
        loadSpotifyFeatures(),
        fetchAndCacheFeatures(record),
      ]);
      const allFeatures = { ...spotifyFeatures, ...(centerFeatures ? { [record.id]: centerFeatures } : {}) };
      setTrailSuggestions(computeTrailSuggestions(record, allFeatures, seedKeys));
      fetchLastfmNextSuggestion(record, seedKeys); // fire-and-forget — updates banner when ready
    } catch {
      setTrailError("Couldn't load suggestions — try again.");
    } finally {
      setTrailLoading(false);
    }
  }

  function minimizeTrail() {
    setTrailActive(false);
  }

  async function refreshTrailSuggestions() {
    if (!trailCenter) return;
    setTrailSuggestions(null);
    setTrailLoading(true);
    try {
      const seenKeys = new Set(trailHistory.map(r => getCanonicalKey(r)));
      const centerFeatures = await fetchAndCacheFeatures(trailCenter);
      const allFeatures = { ...spotifyFeatures, ...(centerFeatures ? { [trailCenter.id]: centerFeatures } : {}) };
      setTrailSuggestions(computeTrailSuggestions(trailCenter, allFeatures, seenKeys));
      fetchLastfmNextSuggestion(trailCenter, seenKeys);
    } catch {
      setTrailError("Couldn't refresh suggestions — try again.");
    } finally {
      setTrailLoading(false);
    }
  }

  async function navigateTrail(record) {
    setTrailCenter(record);
    const nextSeenKeys = new Set([...trailHistory.map(r => getCanonicalKey(r)), getCanonicalKey(record)]);
    setTrailHistory(prev => [...prev, record]);
    setTrailSuggestions(null);
    setLastfmNextSuggestion(null);
    setTrailSearch("");
    setTrailSearchOpen(false);
    setTrailError("");
    setTrailLoading(true);
    try {
      const centerFeatures = await fetchAndCacheFeatures(record);
      const allFeatures = { ...spotifyFeatures, ...(centerFeatures ? { [record.id]: centerFeatures } : {}) };
      setTrailSuggestions(computeTrailSuggestions(record, allFeatures, nextSeenKeys));
      fetchLastfmNextSuggestion(record, nextSeenKeys); // fire-and-forget
    } catch {
      setTrailError("Couldn't load suggestions — try again.");
    } finally {
      setTrailLoading(false);
    }
  }

  function handleTrailClose() {
    if (trailHistory.length > 1) {
      setTrailSavePrompt(true);
    } else {
      setTrailActive(false);
      setTrailSearchOpen(false);
    }
  }

  function handleTrailDiscard() {
    setTrailSavePrompt(false);
    setTrailActive(false);
    setTrailSearchOpen(false);
    setTrailAlreadyLoggedIds(new Set());
    setTrailCenter(null);
    setTrailHistory([]);
    setTrailSuggestions(null);
    setLastfmNextSuggestion(null);
  }

  async function saveTrailSession() {
    setTrailSaving(true);
    try {
      for (const record of trailHistory) {
        if (!trailAlreadyLoggedIds.has(String(record.id))) {
          await logPlay(record.id);
        }
      }
    } finally {
      setTrailSaving(false);
      setTrailSavePrompt(false);
      setTrailActive(false);
      setTrailSearchOpen(false);
      setTrailAlreadyLoggedIds(new Set());
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  async function handleDelete(record) {
    try {
      const res = await fetch(`/api/records/${record.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await readJsonOrText(res); throw new Error(d?.error || "Delete failed"); }
      setCollection((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== record.id) : prev));
      setSelected(null);
    } catch (e) {
      setImportResult({ error: e instanceof Error ? e.message : "Couldn't delete record." });
    }
  }

  async function toggleForSale(record) {
    const next = !record.for_sale;
    try {
      const res = await fetch(`/api/records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ for_sale: next }),
      });
      const updated = await readJsonOrText(res);
      if (!res.ok) throw new Error(updated?.error || `Update failed (${res.status})`);
      setCollection((prev) => (Array.isArray(prev) ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
    } catch (e) {
      setImportResult({ error: e instanceof Error ? e.message : "Couldn't update record. Try again." });
    }
  }

  async function logPlay(recordId) {
    // Offline path: queue in IndexedDB and update local state optimistically
    if (!isOnline) {
      try {
        const { queueOfflinePlay } = await import("@/lib/offlineQueue");
        await queueOfflinePlay(user?.id || "unknown", recordId);
      } catch { /* ignore */ }
      const playedAt = new Date().toISOString();
      const sessionId = crypto.randomUUID();
      setPlayCounts((prev) => ({ ...prev, [recordId]: (prev[recordId] || 0) + 1 }));
      setLastPlayedDates((prev) => ({ ...prev, [recordId]: playedAt }));
      setPlaySessions((prev) => [{ id: sessionId, record_id: recordId, played_at: playedAt }, ...prev]);
      setPendingPlays((c) => c + 1);
      return sessionId;
    }

    const res = await fetch("/api/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: recordId }),
    });
    const data = await res.json();
    const playedAt = data.played_at || new Date().toISOString();
    const sessionId = data.id || crypto.randomUUID();
    setPlayCounts((prev) => ({ ...prev, [recordId]: (prev[recordId] || 0) + 1 }));
    setLastPlayedDates((prev) => ({ ...prev, [recordId]: playedAt }));
    setPlaySessions((prev) => [{ id: sessionId, record_id: recordId, played_at: playedAt }, ...prev]);
    // Silently enrich the played record — user interest signal
    silentEnrich(recordId);
    return sessionId;
  }

  async function handleLogPlay(recordId) {
    await logPlay(recordId);
    if (!trailCenter) return;
    const msSinceLast = nowPlaying ? Date.now() - new Date(nowPlaying.loggedAt).getTime() : Infinity;
    if (msSinceLast > SESSION_GAP_MS) {
      // Stale session — clear trail silently
      setTrailActive(false);
      setTrailCenter(null);
      setTrailHistory([]);
      setTrailSuggestions(null);
      setTrailAlreadyLoggedIds(new Set());
    } else {
      // Live session — show toast
      const record = (collection || []).find(r => String(r.id) === String(recordId));
      if (sessionToastTimerRef.current) clearTimeout(sessionToastTimerRef.current);
      setSessionToast({ recordId, record });
      sessionToastTimerRef.current = setTimeout(() => setSessionToast(null), 5000);
    }
  }

  async function undoLogPlay(recordId) {
    await fetch("/api/plays", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: recordId }),
    });
    setPlayCounts((prev) => ({ ...prev, [recordId]: Math.max((prev[recordId] || 0) - 1, 0) }));
    // Remove most recent session for this record, update lastPlayedDates
    setPlaySessions((prev) => {
      const idx = prev.findIndex((s) => s.record_id === recordId);
      if (idx === -1) return prev;
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      const nextForRecord = next.find((s) => s.record_id === recordId);
      setLastPlayedDates((d) => {
        const nd = { ...d };
        if (nextForRecord) nd[recordId] = nextForRecord.played_at;
        else delete nd[recordId];
        return nd;
      });
      return next;
    });
  }

  if (!Array.isArray(collection)) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
        style={{ background: "linear-gradient(160deg,#1c1610 0%,#0c0b09 100%)", fontFamily: "'DM Sans',sans-serif" }}
      >
        <img src="/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: "50%", marginBottom: 20, animation: "spin 3s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 24 }} className="text-amber-100 mb-2">
          Loading your crate...
        </div>
        {collectionError && (
          <div className="text-center mt-2">
            <div className="text-red-500/70 text-sm">{collectionError}</div>
            <button
              onClick={() => { setCollectionError(""); setCollection(null); refreshRecords(); }}
              className="mt-3 px-4 py-2 rounded-xl text-xs border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  function dismissOnboarding() {
    setShowOnboarding(false);
  }

  if (collection.length === 0 && showOnboarding) {
    return (
      <div
        className="h-dvh flex flex-col items-center justify-center px-8 text-center max-w-md mx-auto"
        style={{ background: "linear-gradient(160deg,#1c1610 0%,#0c0b09 100%)", fontFamily: "'DM Sans',sans-serif" }}
      >
        <img src="/icon-192.png" alt="CrateMate" style={{ width: 64, height: 64, borderRadius: "50%", marginBottom: 24 }} />
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 36, lineHeight: 1 }} className="text-amber-50 mb-1">
          CrateMate
        </div>
        <div className="text-stone-500 text-sm mb-10">
          Your vinyl. Your story.
        </div>

        <div className="w-full flex flex-col gap-3 mb-6">
          {discogsConnected ? (
            <button
              onClick={() => { handleDiscogsImport(); dismissOnboarding(); }}
              disabled={importLoading}
              className="w-full px-5 py-4 rounded-xl bg-amber-950/60 border border-amber-800/40 text-left flex items-center gap-4 hover:bg-amber-950/80 transition-colors disabled:opacity-40"
            >
              <span className="text-xl shrink-0">🔗</span>
              <div className="flex-1">
                <div className="text-amber-100 text-sm font-medium">I use Discogs</div>
                <div className="text-stone-400 text-xs mt-0.5">{importLoading ? "Importing…" : "Sync your whole collection in seconds"}</div>
              </div>
              <span className="text-stone-500 text-sm">→</span>
            </button>
          ) : (
            <a
              href="/api/discogs/auth"
              className="w-full px-5 py-4 rounded-xl bg-amber-950/60 border border-amber-800/40 text-left flex items-center gap-4 hover:bg-amber-950/80 transition-colors"
            >
              <span className="text-xl shrink-0">🔗</span>
              <div className="flex-1">
                <div className="text-amber-100 text-sm font-medium">I use Discogs</div>
                <div className="text-stone-400 text-xs mt-0.5">Sync your whole collection in seconds</div>
              </div>
              <span className="text-stone-500 text-sm">→</span>
            </a>
          )}

          <button
            onClick={() => { dismissOnboarding(); setShowAddModal(true); }}
            className="w-full px-5 py-4 rounded-xl border border-stone-700 text-left flex items-center gap-4 hover:border-stone-500 transition-colors"
          >
            <span className="text-xl shrink-0">＋</span>
            <div className="flex-1">
              <div className="text-stone-200 text-sm font-medium">I&apos;m starting fresh</div>
              <div className="text-stone-500 text-xs mt-0.5">Search &amp; add any record from the Discogs database. No account needed.</div>
            </div>
            <span className="text-stone-600 text-sm">→</span>
          </button>
        </div>

        <button
          onClick={dismissOnboarding}
          className="text-stone-600 text-xs hover:text-stone-400 transition-colors"
        >
          explore first →
        </button>
      </div>
    );
  }

  const hasUnlinked = collection.some((r) => r.discogs_id == null);
  const hasDiscogsLinked = collection.some((r) => r.discogs_id != null);

  return (
    <div
      className="h-dvh flex flex-col max-w-md mx-auto"
      style={{ fontFamily: "'DM Sans',sans-serif" }}
      onTouchStart={onSwipeStart}
      onTouchEnd={onSwipeEnd}
    >
      {/* ── Compact header ── */}
      {(!selected || tab !== "crate") && viewMode !== "drift" && (
        <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icon-192.png" alt="CrateMate" width={34} height={34} className="rounded-lg shrink-0" />
            <div>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, lineHeight: 1.1 }} className="text-amber-50">
                {user?.firstName ? `${user.firstName}'s CrateMate` : "CrateMate"}
              </h1>
              <div className="text-stone-600 text-[10px] leading-tight mt-0.5">
                {myRecords.length} records
                {forSaleRecords.length > 0 && (
                  <button
                    className="text-stone-500 hover:text-amber-400 transition-colors ml-1.5"
                    onClick={() => {
                      setTab("crate");
                      setForSaleForced(true);
                      setTimeout(() => forSaleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
                    }}
                  >
                    · {forSaleRecords.length} for sale
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dailyPickToastMinimized && dailyPickToast && (
              <button
                onClick={() => { setReco({ record: dailyPickToast.record, reason: dailyPickToast.reason, label: "Today's Pick" }); setDailyPickToast(null); setDailyPickToastMinimized(false); setTab("reco"); try { localStorage.setItem("cratemate_daily_toast_dismissed", new Date().toISOString().slice(0, 10)); } catch {} }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-800/40 hover:bg-amber-900/50 transition-colors"
                title="Today's Pick"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-amber-400 animate-pulse"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <span className="text-amber-400 text-[10px] font-medium">Pick</span>
              </button>
            )}
            {!isOnline && (
              <div className="text-[10px] text-amber-700/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-700 animate-pulse inline-block" />
                {pendingPlays > 0 ? `${pendingPlays} queued` : "offline"}
              </div>
            )}
            <button
              onClick={() => {
                const next = theme === "dark" ? "light" : theme === "light" ? "system" : theme === "system" ? "personal" : "dark";
                setTheme(next);
              }}
              title={`Theme: ${theme}`}
              className="text-stone-600 hover:text-stone-400 text-sm transition-colors leading-none"
            >
              {theme === "dark" ? "🌑" : theme === "light" ? "☀" : theme === "system" ? "⊙" : "🎵"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-stone-600 hover:text-stone-400 text-sm transition-colors leading-none"
              title="Settings"
            >⚙</button>
            <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
          </div>
        </div>
      )}

      {/* Tab slide animation + toast animation */}
      <style>{`
        @keyframes cm-slide-left { from { transform: translateX(40px); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
        @keyframes cm-slide-right { from { transform: translateX(-40px); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
        @keyframes cm-toast-in { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {tab === "crate" && (
        <div className="flex-1 flex flex-col overflow-hidden relative"
          style={tabSlide ? { animation: `cm-slide-${tabSlide} 200ms ease-out` } : undefined}>
          {!seenHints["crate_play"] && collection.length > 0 && collection.length <= 10 && (
            <HintBanner onDismiss={() => dismissHint("crate_play")}>
              Long-press any record or tap the play button in list view to log a play and start your streak.
            </HintBanner>
          )}
          {viewMode !== "drift" && (!selected || tab !== "crate") && <div className="px-4 space-y-2 mb-1">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search artist, title, genre, song..."
                className="w-full border border-stone-800/80 rounded-xl px-4 py-2.5 pr-9 text-sm text-amber-50 placeholder-stone-700 focus:outline-none focus:border-amber-900/60" style={{ backgroundColor: "var(--bg-input)" }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-300 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            {/* Row 1: sort pill · ∞/pages · view toggles · Discogs icon · Add */}
            <div className="flex items-center gap-2">
              {/* Cycling sort pill — left side cycles type, right side flips direction */}
              <div className="flex items-center rounded-full bg-stone-800/60 border border-stone-700/50 text-xs text-stone-300 select-none overflow-hidden">
                <button
                  onClick={() => {
                    const ORDER = ["az", "year", "genre", "hearts", "energy"];
                    const next = ORDER[(ORDER.indexOf(sortBy) + 1) % ORDER.length];
                    setSortBy(next); setSortDir("asc");
                  }}
                  className="flex items-center gap-1 pl-2.5 pr-2 py-1 hover:text-amber-300 transition-colors"
                  title="Cycle sort"
                >
                  <span>⇅</span>
                  <span>{{ az: "A–Z", year: "Year", genre: "Genre", hearts: "♥", energy: "Energy" }[sortBy] || "A–Z"}</span>
                </button>
                <button
                  onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                  className="pl-1 pr-2.5 py-1 text-[10px] opacity-60 hover:opacity-100 hover:text-amber-300 transition-all border-l border-stone-700/50"
                  title="Flip direction"
                >
                  {sortDir === "asc" ? "↑" : "↓"}
                </button>
              </div>

              {/* ∞ / pages toggle */}
              <button
                onClick={() => { setInfiniteScroll(s => !s); setPage(1); setVisibleCount(PAGE_SIZE); }}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${infiniteScroll ? "bg-amber-900/30 border-amber-800/40 text-amber-400" : "border-stone-700/50 text-stone-500 hover:text-stone-300"}`}
                title={infiniteScroll ? "Switch to pages" : "Switch to infinite scroll"}
              >
                {infiniteScroll ? "∞" : "p."}
              </button>

              {/* View toggles */}
              <div className="flex gap-0.5">
                <button onClick={() => setViewMode("list")} className={`px-2 py-1 rounded-lg text-xs transition-all ${viewMode === "list" ? "bg-stone-700 text-amber-300" : "text-stone-600 hover:text-stone-300"}`} title="List view">≡</button>
                <button onClick={() => setViewMode("drift")} className={`px-2 py-1 rounded-lg text-xs transition-all ${viewMode === "drift" ? "bg-stone-700 text-amber-300" : "text-stone-600 hover:text-stone-300"}`} title="Honeycomb view">⬡</button>
              </div>

              <div className="flex-1" />

              {/* Discogs — icon only (inline SVG mark) */}
              <div className="relative">
                <button
                  onClick={() => setShowDiscogsMenu(s => !s)}
                  className="w-7 h-7 rounded-full border border-stone-700 flex items-center justify-center text-stone-400 hover:text-amber-300 hover:border-amber-900/50 transition-all"
                  title="Discogs"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a6 6 0 1 1 0 12A6 6 0 0 1 12 6zm0 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
                  </svg>
                </button>
                {showDiscogsMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 z-[70] rounded-xl border border-stone-700 bg-stone-900 shadow-lg overflow-hidden"
                    style={{ minWidth: 140 }}
                  >
                    {discogsConnected ? (
                      <>
                        <button
                          onClick={() => { setShowDiscogsMenu(false); handleDiscogsImport(); }}
                          disabled={importLoading}
                          className="w-full text-left text-xs px-3 py-2 text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition-colors disabled:opacity-40"
                        >
                          {importLoading ? "Importing..." : `↓ Sync${discogsUsername ? ` @${discogsUsername}` : ""}`}
                        </button>
                        {lastSyncedAt && !importLoading && (
                          <div className="px-3 pb-1.5 text-[10px] text-stone-600">
                            {(() => {
                              const mins = Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000);
                              if (mins < 2) return "Synced just now";
                              if (mins < 60) return `Synced ${mins}m ago`;
                              const hrs = Math.round(mins / 60);
                              if (hrs < 24) return `Synced ${hrs}h ago`;
                              return `Synced ${Math.round(hrs / 24)}d ago`;
                            })()}
                          </div>
                        )}
                        <button
                          onClick={async () => {
                            setShowDiscogsMenu(false);
                            await fetch("/api/discogs/disconnect", { method: "POST" });
                            setDiscogsConnected(false);
                            setDiscogsUsername(null);
                            window.location.href = "/api/discogs/auth";
                          }}
                          className="w-full text-left text-xs px-3 py-2 text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition-colors"
                        >
                          ↺ Re-link
                        </button>
                        {hasUnlinked && (
                          <button
                            onClick={() => { setShowDiscogsMenu(false); handleCleanupSeeded(); }}
                            disabled={cleanupLoading}
                            className="w-full text-left text-xs px-3 py-2 text-stone-500 hover:text-amber-300 hover:bg-stone-800 transition-colors disabled:opacity-40"
                          >
                            {cleanupLoading ? "Cleaning..." : "Cleanup"}
                          </button>
                        )}
                      </>
                    ) : (
                      <a
                        href="/api/discogs/auth"
                        onClick={() => setShowDiscogsMenu(false)}
                        className="block text-xs px-3 py-2 text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition-colors"
                      >
                        Link Discogs
                      </a>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-300 hover:border-amber-900/50 transition-all"
              >
                + Add
              </button>
            </div>

            {/* Row 2: filters / active state / record count */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs text-stone-700">
                {filtered.length} records{!infiniteScroll && totalPages > 1 ? ` · p${page}/${totalPages}` : ""}
              </div>
              {activeGenres.size > 0 && (
                <button
                  onClick={clearStatFilter}
                  className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-800/40 text-amber-400"
                >
                  {activeGenres.size === 1 ? [...activeGenres][0] : `${activeGenres.size} genres`} ×
                </button>
              )}
              {(activeGenres.size > 0 || activeStyles.size > 0 || activeDecade.size > 0 || activeFormat !== null) && (
                <button
                  onClick={clearStatFilter}
                  className="text-xs px-2 py-0.5 rounded-full border border-stone-700 text-stone-500 hover:text-rose-400 hover:border-rose-900/50 transition-colors"
                >
                  Clear all ×
                </button>
              )}
            </div>

            {importResult && (
              <div
                className={`text-xs px-3 py-1.5 rounded-lg ${
                  importResult.error ? "text-red-400 bg-red-900/20" : "text-emerald-400/80 bg-emerald-900/10"
                }`}
              >
                {importResult.error ? (
                  typeof importResult.error === "string" ? importResult.error : "Action failed — try again"
                ) : importResult.cleanup ? (
                  `Removed ${importResult.deleted} unlinked records`
                ) : (
                  <ImportProgressBar importResult={importResult} enrichLoading={enrichLoading} />
                )}
                {!importResult.error && importResult.meta?.warning ? (
                  <span className="block text-stone-500 mt-1">{importResult.meta.warning}</span>
                ) : null}
              </div>
            )}
          </div>}

          {collection.length === 0 ? (
            <div className="flex-1 px-6 flex flex-col items-center justify-center text-center">
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 26 }} className="text-amber-100 mb-2">
                Your crate is empty
              </div>
              <div className="text-stone-600 text-sm mb-6 max-w-xs">
                Link Discogs to import your collection, or add a record manually.
              </div>
              <div className="flex gap-2">
                {discogsConnected ? (
                  <button
                    onClick={handleDiscogsImport}
                    disabled={importLoading}
                    className="px-4 py-2 rounded-xl bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm font-medium disabled:opacity-40 hover:bg-amber-900/50 transition-colors"
                  >
                    {importLoading ? "Importing..." : "Import from Discogs"}
                  </button>
                ) : (
                  <a
                    href="/api/discogs/auth"
                    className="px-4 py-2 rounded-xl bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm font-medium hover:bg-amber-900/50 transition-colors"
                  >
                    Link Discogs
                  </a>
                )}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm font-medium hover:border-amber-900/50 hover:text-amber-200 transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>
          ) : viewMode === "drift" ? (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {honeycombShape === "tiles" ? (
                <TileView
                  key="tiles"
                  records={honeycombRecords}
                  playCounts={playCounts}
                  onSelect={(rec) => { setSelected(rec); if (!rec.for_sale) setLastPlayed(rec); }}
                  onDoubleTap={handleDoubleTap}
                  screensaverEnabled={screensaverEnabled}
                  onInteract={driftHideOnInteract}
                />
              ) : (
              <HoneycombView
                key={honeycombSort + honeycombSortDir + honeycombShape}
                records={honeycombRecords}
                playCounts={playCounts}
                zoom={honeycombZoom}
                shape={honeycombShape}
                onSelect={(rec) => {
                  setSelected(rec);
                  if (!rec.for_sale) setLastPlayed(rec);
                }}
                onLogPlay={handleLogPlay}
                onInteract={driftHideOnInteract}
                onDoubleTap={handleDoubleTap}
                screensaverEnabled={screensaverEnabled}
                onToggleScreensaver={() => {
                  const next = !screensaverEnabled;
                  localStorage.setItem("cratemate_screensaver", next ? "1" : "0");
                  setScreensaverEnabled(next);
                }}
              />
              )}
              {/* ── Drift controls — auto-fade after 3s, tap to show ── */}
              {(() => {
                const driftVisible = !controlsHidden;
                const hasFilter = statFilterLabel || activeGenres.size > 0 || activeStyles.size > 0 || activeDecade.size > 0 || activeFormat !== null;
                return (
                  <>
                    {/* Persistent restore button — always visible in drift when controls are hidden */}
                    {controlsHidden && (
                      <button
                        onClick={() => {
                          driftFullscreenRef.current = false;
                          driftHiddenByDragRef.current = false;
                          setControlsHidden(false);
                          driftResetFade();
                        }}
                        className="absolute bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center text-stone-500 hover:text-stone-300 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
                      </button>
                    )}

                    {/* Top-left: back + share + downloads */}
                    <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-2"
                      style={{ opacity: driftVisible ? 1 : 0, pointerEvents: driftVisible ? "auto" : "none", transition: "opacity 0.4s ease" }}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setViewMode("list");
                            if (previousTab) { setTab(previousTab); setPreviousTab(null); }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-stone-400 text-xs hover:text-amber-300 transition-colors"
                        >
                          {previousTab === "stats" ? "← Stats" : "≡ List"}
                        </button>
                        {discogsConnected && (
                          <button
                            onClick={() => {
                              if (!discogsUsername) return;
                              const view = honeycombShape === "grid" ? "grid" : honeycombShape === "tiles" ? "tiles" : "honeycomb";
                              navigator.clipboard.writeText(`${window.location.origin}/crate/${discogsUsername}?view=${view}`);
                              setShareCopied(true);
                              setTimeout(() => setShareCopied(false), 2000);
                            }}
                            disabled={!discogsUsername}
                            className={`px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border text-xs transition-colors ${
                              discogsUsername ? "border-white/10 text-stone-400 hover:text-amber-300" : "border-white/5 text-stone-700 cursor-not-allowed"
                            }`}
                          >
                            {shareCopied ? "Copied!" : "↗ Share"}
                          </button>
                        )}
                      </div>
                      {honeycombShape === "tiles" && (
                        <div className="flex rounded-full bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden">
                          {[["square", "⬇ 1:1"], ["full", "⬇ Full"]].map(([mode, label]) => (
                            <button
                              key={mode}
                              disabled={!!tileExporting}
                              onClick={async () => {
                                if (tileExporting) return;
                                setTileExporting(mode);
                                try {
                                  const canvas = await generateTileExport(honeycombRecords, playCounts, mode);
                                  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
                                  const filename = mode === "square" ? "my-crate-square.png" : "my-crate-full.png";
                                  const file = new File([blob], filename, { type: "image/png" });
                                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                    await navigator.share({ files: [file] });
                                  } else {
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url; a.download = filename; a.click();
                                    URL.revokeObjectURL(url);
                                  }
                                } catch {}
                                setTileExporting(null);
                              }}
                              className={`px-3 py-1.5 text-xs transition-colors disabled:text-stone-700 ${mode === "full" ? "border-l border-white/10" : ""} ${tileExporting === mode ? "text-amber-300" : "text-stone-400 hover:text-amber-300"}`}
                            >
                              {tileExporting === mode ? "Saving…" : label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Top-right: merged control bar (sort + shapes + zoom + fullscreen) */}
                    <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2"
                      style={{ opacity: driftVisible ? 1 : 0, pointerEvents: driftVisible ? "auto" : "none", transition: "opacity 0.4s ease" }}>
                      <div className="flex rounded-full bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden text-xs text-stone-400">
                        {/* Sort */}
                        <button
                          onClick={() => {
                            const order = ["az", "year", "genre", "hearts", "energy"];
                            setHoneycombSort(order[(order.indexOf(honeycombSort) + 1) % order.length]);
                            setHoneycombSortDir("asc");
                          }}
                          className="flex items-center gap-1 pl-3 pr-1 py-1.5 hover:text-amber-300 transition-colors"
                        >
                          <span>⇅</span>
                          <span>{{ az: "A–Z", year: "Year", genre: "Genre", hearts: "♥", energy: "Energy" }[honeycombSort] || "A–Z"}</span>
                        </button>
                        <button
                          onClick={() => setHoneycombSortDir(d => d === "asc" ? "desc" : "asc")}
                          className="pr-2 py-1.5 text-[10px] opacity-60 hover:opacity-100 hover:text-amber-300 transition-all"
                        >
                          {honeycombSortDir === "asc" ? "↑" : "↓"}
                        </button>
                        <div className="w-px self-stretch bg-white/10" />
                        {/* Shape — single cycle button */}
                        <button
                          onClick={() => {
                            const order = ["honeycomb", "grid", "tiles"];
                            setHoneycombShape(order[(order.indexOf(honeycombShape) + 1) % order.length]);
                          }}
                          className="px-2.5 py-1.5 text-amber-300 transition-colors"
                          title={honeycombShape === "honeycomb" ? "Honeycomb" : honeycombShape === "grid" ? "Grid" : "Tiles"}
                        >{{ honeycomb: "⬡", grid: "⊞", tiles: "▦" }[honeycombShape]}</button>
                        <div className="w-px self-stretch bg-white/10" />
                        {/* Zoom */}
                        <button
                          onClick={() => setHoneycombZoom((z) => Math.max(0.4, parseFloat((z - 0.25).toFixed(2))))}
                          className="px-2 py-1.5 hover:text-amber-300 transition-colors"
                        >−</button>
                        <button
                          onClick={() => setHoneycombZoom((z) => Math.min(1.8, parseFloat((z + 0.25).toFixed(2))))}
                          className="px-2 py-1.5 hover:text-amber-300 transition-colors"
                        >+</button>
                        {/* Auto-pan */}
                        <div className="w-px self-stretch bg-white/10" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = !screensaverEnabled;
                            localStorage.setItem("cratemate_screensaver", next ? "1" : "0");
                            setScreensaverEnabled(next);
                          }}
                          className={`px-3.5 py-1.5 text-sm transition-colors relative ${screensaverEnabled ? "text-stone-200" : "text-stone-600 hover:text-stone-400"}`}
                          title={screensaverEnabled ? "Auto-pan ON" : "Auto-pan OFF"}
                        >
                          ⟳
                          {screensaverEnabled && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      </div>
                    </div>

                    {/* Stat filter badge — always visible when active */}
                    {hasFilter && (
                      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
                        {statFilterLabel && (
                          <button
                            onClick={clearStatFilter}
                            className="px-3 py-1.5 rounded-full bg-amber-900/70 backdrop-blur-sm border border-amber-700/50 text-amber-200 text-xs flex items-center gap-2"
                          >
                            <span>Filtered: {statFilterLabel}</span>
                            <span className="text-amber-400 font-bold">×</span>
                          </button>
                        )}
                        {(activeGenres.size > 0 || activeStyles.size > 0 || activeDecade.size > 0 || activeFormat !== null) && (
                          <button
                            onClick={clearStatFilter}
                            className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-stone-400 hover:text-rose-400 hover:border-rose-900/40 text-xs transition-colors"
                          >
                            Clear all ×
                          </button>
                        )}
                      </div>
                    )}

                    {/* Genre/decade filter strip — visible when controls are shown */}
                    {driftVisible && (() => {
                      const allGenres = [...new Set(pool.flatMap((r) => getGenres(r)))].sort();
                      // Sort by frequency, show top 8 by default
                      const genreFreq = {};
                      pool.forEach(r => getGenres(r).forEach(g => { genreFreq[g] = (genreFreq[g] || 0) + 1; }));
                      const genresByFreq = allGenres.sort((a, b) => (genreFreq[b] || 0) - (genreFreq[a] || 0));
                      const GENRE_LIMIT = 8;
                      const hasMore = genresByFreq.length > GENRE_LIMIT;
                      const genres = driftFilterExpanded ? genresByFreq : genresByFreq.slice(0, GENRE_LIMIT);
                      const hasGenres = genres.length > 0;
                      const hasDecades = decades.length > 0;
                      if (!hasGenres && !hasDecades) return null;
                      return (
                        <div className="absolute left-0 right-0 z-50 flex justify-center pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}>
                          <div
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 pointer-events-auto"
                            style={{ overflowX: "auto", maxWidth: "calc(100% - 32px)", scrollbarWidth: "none", msOverflowStyle: "none" }}
                          >
                            {hasGenres && genres.map((g) => (
                              <GenreTag
                                key={g}
                                genre={g}
                                onClick={() => {
                                  setStatFilterLabel(null);
                                  setActiveStyles(new Set());
                                  toggleGenre(g);
                                }}
                                active={activeGenres.has(g)}
                              />
                            ))}
                            {hasMore && !driftFilterExpanded && (
                              <button
                                onClick={() => setDriftFilterExpanded(true)}
                                className="px-2.5 py-1 rounded-full text-xs shrink-0 border border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
                              >+{genresByFreq.length - GENRE_LIMIT}</button>
                            )}
                            {hasGenres && hasDecades && (
                              <span className="text-stone-700 text-xs shrink-0 px-1">|</span>
                            )}
                            {hasDecades && (
                              <>
                                <button
                                  onClick={() => setActiveDecade(new Set())}
                                  className={`px-3 py-1 rounded-full text-xs shrink-0 border transition-colors ${!activeDecade.size ? "bg-amber-900/50 border-amber-700/60 text-amber-200" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                                >All</button>
                                {decades.map(d => (
                                  <button key={d} onClick={() => setActiveDecade(prev => {
                                    const s = new Set(prev);
                                    s.has(d) ? s.delete(d) : s.add(d);
                                    return s;
                                  })}
                                    className={`px-3 py-1 rounded-full text-xs shrink-0 border transition-colors ${activeDecade.has(d) ? "bg-amber-900/50 border-amber-700/60 text-amber-200" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                                  >{d}</button>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 space-y-0.5" style={{ paddingBottom: 16 }}>
              {pagedRecords.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  onClick={(rec) => {
                    setSelected(rec);
                    if (!rec.for_sale) setLastPlayed(rec);
                  }}
                  onGenreClick={toggleGenre}
                  activeGenres={activeGenres}
                  playCount={playCounts[r.id] || 0}
                  bpm={spotifyFeatures?.[r.id]?.tempo ?? null}
                  onLogPlay={handleLogPlay}
                  onDoubleTap={handleDoubleTap}
                />
              ))}
              {filtered.length === 0 && <div className="text-center text-stone-700 py-16">No records found</div>}
              {infiniteScroll ? (
                hasMore && <div ref={sentinelRef} className="py-4 text-center text-stone-700 text-xs">Loading more…</div>
              ) : (
                totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                      ← Prev
                    </button>
                    <span className="text-stone-600 text-xs">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                      Next →
                    </button>
                  </div>
                )
              )}
              {(!hideForSale || forSaleForced) && forSaleRecords.length > 0 && (
                <>
                  <div ref={forSaleRef} className="flex items-center gap-3 px-2 pt-5 pb-1">
                    <div className="flex-1 h-px bg-stone-800/60" />
                    <span className="text-stone-600 text-xs shrink-0">📋 For Sale · {forSaleRecords.length}</span>
                    <div className="flex-1 h-px bg-stone-800/60" />
                  </div>
                  {forSaleRecords.map(r => (
                    <RecordRow
                      key={r.id}
                      record={r}
                      onClick={rec => setSelected(rec)}
                      onGenreClick={toggleGenre}
                      activeGenres={activeGenres}
                      playCount={playCounts[r.id] || 0}
                      bpm={spotifyFeatures?.[r.id]?.tempo ?? null}
                      onLogPlay={handleLogPlay}
                      onDoubleTap={handleDoubleTap}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "hearts" && (() => {
        // Derived data
        const heartedRecords = myRecords
          .filter(r => (r.favorite_tracks || []).length > 0)
          .map(r => ({
            ...r,
            decade: getDecade(r),
            primaryGenre: getGenres(r)[0] || "Unknown",
            energy: spotifyFeatures?.[r.id]?.energy ?? null,
          }));

        const heartsGenreOptions = [...new Set(heartedRecords.flatMap(r => getGenres(r)))].sort();
        const heartsDecadeOptions = [...new Set(heartedRecords.map(r => r.decade).filter(Boolean))].sort();

        const dir = heartsSortDir === "asc" ? 1 : -1;
        const heartsFiltered = heartedRecords
          .filter(r => heartsGenreFilter.length === 0 || getGenres(r).some(g => heartsGenreFilter.includes(g)))
          .filter(r => heartsYearFilter.length === 0 || heartsYearFilter.includes(r.decade))
          .sort((a, b) => {
            if (heartsSort === "genre") return dir * a.primaryGenre.localeCompare(b.primaryGenre);
            if (heartsSort === "year") return dir * ((a.year_original || a.year_pressed || 0) - (b.year_original || b.year_pressed || 0));
            if (heartsSort === "energy") return dir * ((a.energy ?? -1) - (b.energy ?? -1));
            return dir * (a.artist || "").localeCompare(b.artist || "");
          });

        const isTrackChecked = (recordId, trackKey) =>
          heartsChecked === null || heartsChecked.has(`${recordId}-${trackKey}`);

        // Only count checked tracks from currently visible (filtered) records
        const totalChecked = heartsFiltered.reduce((sum, r) =>
          sum + (r.favorite_tracks || []).filter(f => isTrackChecked(r.id, normFav(f).key)).length, 0);

        const allExpanded = expandedHearts.size >= heartsFiltered.length && heartsFiltered.length > 0;

        // Month/year default playlist name
        const now = new Date();
        const defaultPlaylistName = `CrateMate — ${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()}`;

        const handleExportClick = () => {
          setPlaylistName(defaultPlaylistName);
          setShowPlaylistNameModal(true);
          setExportResult(null);
          setShowNotFoundList(false);
        };

        const handleDownloadCSV = () => {
          const rows = [["Track name", "Artist name"]];
          for (const r of heartsFiltered) {
            for (const f of (r.favorite_tracks || [])) {
              const { key, title } = normFav(f);
              if (isTrackChecked(r.id, key)) {
                const trackTitle = (title && title !== key) ? title : (favTitles[r.id]?.[key] || key);
                rows.push([trackTitle, r.artist]);
              }
            }
          }
          const csv = rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${defaultPlaylistName.replace(/[^a-zA-Z0-9 —-]/g, "")}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        const handleCreatePlaylist = async () => {
          setExportingPlaylist(true);
          setShowPlaylistNameModal(false);
          const tracks = [];
          for (const r of heartsFiltered) {
            for (const f of (r.favorite_tracks || [])) {
              const { key, title } = normFav(f);
              if (isTrackChecked(r.id, key)) {
                const trackTitle = (title && title !== key) ? title : (favTitles[r.id]?.[key] || key);
                tracks.push({ artist: r.artist, trackTitle });
              }
            }
          }
          try {
            const res = await fetch("/api/spotify/playlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: playlistName, tracks, isPublic: playlistIsPublic }),
            });
            let data;
            try { data = await res.json(); } catch { data = { error: "parse_error" }; }
            if (data.error === "no_access_token" || data.error === "insufficient_scope") {
              setSpotifyConnectedForPlaylists(false);
              setExportResult(null);
            } else if (data.error === "rate_limited") {
              const seconds = data.retryAfter || 15;
              setExportResult({ exportError: `Spotify is rate limited — try again in ${seconds}s`, retryAfter: seconds });
              let t = seconds;
              const interval = setInterval(() => {
                t--;
                if (t <= 0) {
                  clearInterval(interval);
                  setExportResult(null);
                } else {
                  setExportResult(prev => prev?.retryAfter != null ? { ...prev, exportError: `Spotify is rate limited — try again in ${t}s` } : prev);
                }
              }, 1000);
            } else if (data.error === "no_tracks_found") {
              setExportResult({ exportError: "No tracks found on Spotify. Check the list below to see what was searched.", notFound: data.notFound, total: data.total });
            } else if (data.error === "add_tracks_failed") {
              const spotifyMsg = data.spotify_error?.error?.message || "";
              setExportResult({ exportError: `Spotify rejected adding tracks (${data.spotify_status}${spotifyMsg ? `: ${spotifyMsg}` : ""}). The playlist was not created.`, notFound: data.notFound, total: data.total });
            } else if (data.error === "create_failed") {
              const spotifyMsg = data.spotify_error?.error?.message || "";
              setExportResult({ exportError: `Spotify rejected playlist creation (${data.spotify_status}${spotifyMsg ? `: ${spotifyMsg}` : ""}).` });
            } else if (data.error && !data.playlistUrl) {
              setExportResult({ exportError: `Export failed (${data.error}${data.detail ? `: ${data.detail}` : ""})` });
            } else {
              setExportResult(data);
            }
          } catch {
            setExportResult({ exportError: "network_error" });
          } finally {
            setExportingPlaylist(false);
          }
        };

        return (
          <div className="flex-1 flex flex-col min-h-0" style={tabSlide ? { animation: `cm-slide-${tabSlide} 200ms ease-out` } : undefined}>
            <div className="flex-1 overflow-y-auto">
            {!seenHints["hearts"] && (
              <HintBanner onDismiss={() => dismissHint("hearts")}>
                Open a record, expand its tracklist, and tap ♥ next to any track to save it here.
              </HintBanner>
            )}

            {heartedRecords.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="text-3xl mb-3 text-stone-700">♥</div>
                <div className="text-stone-600 text-sm">No favorite tracks yet.</div>
                <div className="text-stone-700 text-xs mt-1">Tap ♥ on a track in any record&apos;s tracklist.</div>
              </div>
            ) : (
              <>
                {/* Controls bar */}
                <div className="px-4 pt-3 pb-1 space-y-2 border-b border-stone-800/40">
                  {/* Genre pills */}
                  {heartsGenreOptions.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {heartsGenreOptions.map(g => (
                        <button
                          key={g}
                          onClick={() => setHeartsGenreFilter(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                          className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${heartsGenreFilter.includes(g) ? "bg-amber-900/40 border-amber-700/50 text-amber-300" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Year pills */}
                  {heartsDecadeOptions.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {heartsDecadeOptions.map(d => (
                        <button
                          key={d}
                          onClick={() => setHeartsYearFilter(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                          className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${heartsYearFilter.includes(d) ? "bg-amber-900/40 border-amber-700/50 text-amber-300" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Sort + select controls */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-stone-600 text-xs shrink-0">Sort:</span>
                    {["artist", "genre", "year", "energy"].map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          if (heartsSort === s) {
                            setHeartsSortDir(d => d === "asc" ? "desc" : "asc");
                          } else {
                            setHeartsSort(s);
                            setHeartsSortDir("asc");
                          }
                        }}
                        className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${heartsSort === s ? "bg-amber-900/40 border-amber-700/50 text-amber-300" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                      >
                        {s}{heartsSort === s ? (heartsSortDir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button
                      onClick={() => {
                        // Materialize all visible track keys as checked
                        const visibleKeys = new Set(
                          heartsFiltered.flatMap(r =>
                            (r.favorite_tracks || []).map(f => `${r.id}-${normFav(f).key}`)
                          )
                        );
                        if (heartsChecked === null) {
                          // Start from all checked, add visible
                          setHeartsChecked(visibleKeys);
                        } else {
                          const next = new Set(heartsChecked);
                          for (const k of visibleKeys) next.add(k);
                          setHeartsChecked(next);
                        }
                      }}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
                    >
                      ✓ all
                    </button>
                    <button
                      onClick={() => {
                        const visibleKeys = new Set(
                          heartsFiltered.flatMap(r =>
                            (r.favorite_tracks || []).map(f => `${r.id}-${normFav(f).key}`)
                          )
                        );
                        if (heartsChecked === null) {
                          // Materialize with all checked, then remove visible
                          const allKeys = new Set(
                            heartedRecords.flatMap(r =>
                              (r.favorite_tracks || []).map(f => `${r.id}-${normFav(f).key}`)
                            )
                          );
                          for (const k of visibleKeys) allKeys.delete(k);
                          setHeartsChecked(allKeys);
                        } else {
                          const next = new Set(heartsChecked);
                          for (const k of visibleKeys) next.delete(k);
                          setHeartsChecked(next);
                        }
                      }}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
                    >
                      ✗ all
                    </button>
                    <button
                      onClick={() => {
                        if (allExpanded) setExpandedHearts(new Set());
                        else setExpandedHearts(new Set(heartsFiltered.map(r => r.id)));
                      }}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
                    >
                      {allExpanded ? "− all" : "+ all"}
                    </button>
                  </div>
                </div>

                {/* Record list */}
                <div className="px-4 space-y-0.5 pt-2 flex-1">
                  {heartsFiltered.length === 0 && (
                    <div className="text-center py-8 text-stone-600 text-sm">No records match these filters.</div>
                  )}
                  {heartsFiltered.map((r) => {
                    const isExpanded = expandedHearts.has(r.id);
                    const heartCount = (r.favorite_tracks || []).length;
                    return (
                      <div key={r.id} className="rounded-xl overflow-hidden">
                        <div
                          onClick={() => setExpandedHearts(prev => {
                            const next = new Set(prev);
                            next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                            return next;
                          })}
                          className="flex items-center gap-3 w-full px-2.5 py-2 text-left hover:bg-white/[0.04] transition-colors rounded-xl cursor-pointer"
                          style={{ minHeight: 44 }}
                        >
                          <div onClick={(e) => { e.stopPropagation(); setSelected(r); }} className="shrink-0">
                            <CoverArt record={r} size={36} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-amber-50 text-sm truncate block" style={{ fontFamily: "'Fraunces',serif" }}>
                              {stripArtistNum(r.artist)} — {r.title}
                            </span>
                          </div>
                          <span className="text-rose-400 text-xs shrink-0 mr-1">♥ {heartCount}</span>
                          <span className={`text-stone-600 text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}>›</span>
                        </div>
                        {isExpanded && (
                          <div className="space-y-0.5 pl-3 pr-2 pb-2">
                            {[...(r.favorite_tracks || [])].sort((a, b) => {
                              const ka = (typeof a === "object" ? a.key : a) || "";
                              const kb = (typeof b === "object" ? b.key : b) || "";
                              return ka.localeCompare(kb, undefined, { numeric: true, sensitivity: "base" });
                            }).map((f) => {
                              const { key, title } = normFav(f);
                              const displayTitle = (title && title !== key) ? title : (favTitles[r.id]?.[key] || key);
                              const checked = isTrackChecked(r.id, key);
                              return (
                                <div key={key} className="flex items-center gap-2 py-0.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const trackId = `${r.id}-${key}`;
                                      if (heartsChecked === null) {
                                        // Materialize all tracks, then toggle this one
                                        const allKeys = new Set(
                                          heartedRecords.flatMap(rec =>
                                            (rec.favorite_tracks || []).map(ff => `${rec.id}-${normFav(ff).key}`)
                                          )
                                        );
                                        allKeys.delete(trackId);
                                        setHeartsChecked(allKeys);
                                      } else {
                                        const next = new Set(heartsChecked);
                                        next.has(trackId) ? next.delete(trackId) : next.add(trackId);
                                        setHeartsChecked(next);
                                      }
                                    }}
                                    className="shrink-0 w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className="text-stone-600 text-xs w-8 shrink-0">{key}</span>
                                  <span className="text-stone-300 text-sm flex-1 truncate">{displayTitle}</span>
                                  <button
                                    onClick={() => {
                                      const next = (r.favorite_tracks || []).filter((ff) => (typeof ff === "object" ? ff.key : ff) !== key);
                                      setCollection((prev) => Array.isArray(prev) ? prev.map((rec) => rec.id === r.id ? { ...rec, favorite_tracks: next } : rec) : prev);
                                      fetch(`/api/records/${r.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ favorite_tracks: next }),
                                      }).catch(() => {});
                                    }}
                                    className="text-rose-400 hover:text-rose-300 transition-colors text-sm shrink-0"
                                  >♥</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </>
            )}
            </div>
            {heartedRecords.length > 0 && <>
                {/* Export bar / result / reconnect prompt */}
                <div className="shrink-0 px-4 pt-2 pb-1 border-t border-stone-800/40">
                  {spotifyConnectedForPlaylists === false ? (
                    <div className="text-center py-2">
                      <div className="text-stone-500 text-xs mb-2">Playlist export requires updated Spotify permissions.</div>
                      <button
                        onClick={() => { window.location.href = "/api/spotify/auth?from=hearts"; }}
                        className="text-xs px-4 py-1.5 rounded-full border border-[#1DB954]/40 bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 transition-colors"
                      >
                        Reconnect Spotify →
                      </button>
                    </div>
                  ) : exportResult ? (
                    <div className="py-2 space-y-1.5">
                      {exportResult.exportError ? (
                        <div className="space-y-1.5">
                          <div className="text-sm text-rose-400">
                            {exportResult.exportError}{exportResult.detail ? ` (${exportResult.detail})` : ""}{" "}
                            <button onClick={() => setExportResult(null)} className="underline text-stone-500">Dismiss</button>
                          </div>
                          {exportResult.notFound?.length > 0 && (
                            <div className="text-xs text-stone-600 space-y-0.5 pl-1">
                              {exportResult.notFound.map((t, i) => <div key={i}>{t}</div>)}
                            </div>
                          )}
                        </div>
                      ) : <>
                      <div className="text-sm text-stone-300">✓ Playlist created — {exportResult.matched} of {exportResult.total} tracks added</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={exportResult.playlistUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-full border border-[#1DB954]/40 bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 transition-colors"
                        >
                          Open in Spotify
                        </a>
                        {exportResult.notFound?.length > 0 && (
                          <button
                            onClick={() => setShowNotFoundList(s => !s)}
                            className="text-xs px-3 py-1.5 rounded-full border border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
                          >
                            {exportResult.notFound.length} not found {showNotFoundList ? "▲" : "▾"}
                          </button>
                        )}
                        <button
                          onClick={() => { setExportResult(null); setShowNotFoundList(false); }}
                          className="text-xs px-3 py-1.5 rounded-full border border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
                        >
                          Done
                        </button>
                      </div>
                      {showNotFoundList && exportResult.notFound?.length > 0 && (
                        <div className="text-xs text-stone-600 space-y-0.5 pl-1 pt-1">
                          {exportResult.notFound.map((t, i) => <div key={i}>{t}</div>)}
                        </div>
                      )}
                      </>}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {totalChecked > 80 && !exportingPlaylist && (
                        <div className="text-xs text-amber-600/80 text-center">
                          Large export ({totalChecked} tracks) — this may take a moment.{totalChecked > 150 ? " Consider filtering to fewer tracks." : ""}
                        </div>
                      )}
                      <button
                        disabled={totalChecked === 0 || exportingPlaylist}
                        onClick={handleExportClick}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${totalChecked === 0 || exportingPlaylist ? "bg-stone-800/40 text-stone-600 cursor-not-allowed" : "bg-[#1DB954]/15 border border-[#1DB954]/30 text-[#1DB954] hover:bg-[#1DB954]/25"}`}
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                        {exportingPlaylist ? "Creating playlist…" : `Export ${totalChecked} track${totalChecked !== 1 ? "s" : ""} to Spotify →`}
                      </button>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          disabled={totalChecked === 0}
                          onClick={handleDownloadCSV}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${totalChecked === 0 ? "border-stone-800 text-stone-700 cursor-not-allowed" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                        >
                          Download CSV
                        </button>
                        <a
                          href="https://www.tunemymusic.com/transfer/csv-to-spotify"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-stone-700 hover:text-stone-500 transition-colors"
                        >
                          Import via TuneMyMusic ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Playlist name modal */}
                {showPlaylistNameModal && (
                  <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setShowPlaylistNameModal(false)}>
                    <div
                      className="w-full bg-stone-950 border-t border-stone-800 rounded-t-2xl px-6 pt-5 pb-8 space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-stone-300 text-base font-medium">Name your playlist</div>
                      <input
                        type="text"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder={defaultPlaylistName}
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-700/60"
                        autoFocus
                      />
                      <div className="flex items-center gap-3">
                        <span className="text-stone-500 text-xs">Visibility:</span>
                        <button
                          onClick={() => setPlaylistIsPublic(true)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${playlistIsPublic ? "bg-amber-900/40 border-amber-700/50 text-amber-300" : "border-stone-700 text-stone-500"}`}
                        >
                          Public · shareable
                        </button>
                        <button
                          onClick={() => setPlaylistIsPublic(false)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!playlistIsPublic ? "bg-amber-900/40 border-amber-700/50 text-amber-300" : "border-stone-700 text-stone-500"}`}
                        >
                          Private
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowPlaylistNameModal(false)}
                          className="flex-1 py-2.5 rounded-xl border border-stone-700 text-stone-500 text-sm hover:text-stone-300 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={!playlistName.trim()}
                          onClick={handleCreatePlaylist}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${playlistName.trim() ? "bg-[#1DB954]/15 border border-[#1DB954]/30 text-[#1DB954] hover:bg-[#1DB954]/25" : "bg-stone-800/40 text-stone-600 cursor-not-allowed border border-transparent"}`}
                        >
                          Create Playlist
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>}
          </div>
        );
      })()}

      {tab === "reco" && (
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 16, ...(tabSlide ? { animation: `cm-slide-${tabSlide} 200ms ease-out` } : {}) }}>
          <div className="px-4 space-y-3 pt-0">

          {/* Genre + Decade filters */}
          {myRecords.length > 0 && (() => {
            const availableGenres = [...new Set(myRecords.flatMap(r => getGenres(r)))].sort();
            const availableDecades = [...new Set(myRecords.map(r => {
              const y = r.year_original || r.year_pressed || 0;
              return y > 0 ? String(Math.floor(y / 10) * 10) : null;
            }).filter(Boolean))].sort();
            const matchCount = myRecords.filter(r => {
              if (recoFilterGenres.size > 0 && !getGenres(r).some(g => recoFilterGenres.has(g))) return false;
              if (recoFilterDecades.size > 0) {
                const decade = String(Math.floor((r.year_original || r.year_pressed || 0) / 10) * 10);
                if (!recoFilterDecades.has(decade)) return false;
              }
              return true;
            }).length;
            const hasFilters = recoFilterGenres.size > 0 || recoFilterDecades.size > 0;
            return (
              <div className="rounded-xl border border-stone-800/60 overflow-hidden">
                {/* Header — always visible */}
                <button
                  onClick={() => setRecoFiltersExpanded(e => !e)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <span className="text-xs text-stone-400 uppercase tracking-widest font-medium flex-1">Narrow it down</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-stone-600">
                    {hasFilters && <span className="text-amber-600">{matchCount} records</span>}
                    {!recoFiltersExpanded && !hasFilters && <span className="text-stone-700">genre · decade</span>}
                    <span>{recoFiltersExpanded ? "▲" : "▼"}</span>
                  </span>
                </button>

                {recoFiltersExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-stone-800/40 pt-3">
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Filter your crate by genre or decade — recommendations will only pick from matching records.
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableGenres.map(g => (
                        <button
                          key={g}
                          onClick={() => setRecoFilterGenres(prev => {
                            const next = new Set(prev);
                            next.has(g) ? next.delete(g) : next.add(g);
                            return next;
                          })}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            recoFilterGenres.has(g)
                              ? "bg-amber-900/30 border-amber-800/50 text-amber-400"
                              : "border-stone-800 text-stone-600 hover:text-stone-400"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {availableDecades.length > 1 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {availableDecades.map(d => (
                          <button
                            key={d}
                            onClick={() => setRecoFilterDecades(prev => {
                              const next = new Set(prev);
                              next.has(d) ? next.delete(d) : next.add(d);
                              return next;
                            })}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              recoFilterDecades.has(d)
                                ? "bg-stone-700 border-stone-500 text-stone-200"
                                : "border-stone-800 text-stone-600 hover:text-stone-400"
                            }`}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>
                    )}
                    {hasFilters && (
                      <button
                        onClick={() => { setRecoFilterGenres(new Set()); setRecoFilterDecades(new Set()); }}
                        className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
                      >
                        clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {[
            { type: "random", icon: "🎲", title: "Random Pick" },
            { type: "daily",  icon: "📅", title: "Today's Pick" },
          ].map(({ type, icon, title, disabled }) => (
            <button
              key={type}
              onClick={() => !disabled && !recoLoading && getReco(type)}
              disabled={!!disabled || recoLoading || myRecords.length === 0}
              className={`w-full py-3.5 rounded-xl border text-left px-4 flex items-center gap-3 transition-all ${
                disabled || myRecords.length === 0
                  ? "border-stone-800/50 opacity-35"
                  : "border-stone-700/60 hover:border-amber-900/50 hover:bg-white/[0.02]"
              }`}
            >
              <span className="text-xl w-8 text-center">{icon}</span>
              <div className="font-medium text-stone-200 text-sm">{title}</div>
            </button>
          ))}

          <div className="rounded-xl border border-stone-700/60 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl w-8 text-center">🌙</span>
              <div>
                <div className="font-medium text-stone-200 text-sm">Mood Match</div>
                <div className="text-xs text-stone-600">What&apos;s the vibe?</div>
              </div>
            </div>
            <input
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && mood && !recoLoading && myRecords.length > 0 && getReco("mood")}
              placeholder="e.g. melancholic rainy night, want to dance, road trip energy..."
              className="w-full bg-stone-900/70 border border-stone-800 rounded-lg px-3 py-2 text-sm text-amber-50 placeholder-stone-700 focus:outline-none focus:border-amber-900/50 mb-3"
            />
            <button
              onClick={() => mood && !recoLoading && myRecords.length > 0 && getReco("mood")}
              disabled={!mood || recoLoading || myRecords.length === 0}
              className="w-full py-2.5 rounded-lg bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm font-medium disabled:opacity-40 hover:bg-amber-900/50 transition-colors"
            >
              Find a Match
            </button>
          </div>

          {myRecords.length === 0 && (
            <div className="text-center py-10 px-4">
              <div className="text-4xl mb-3">⬡</div>
              <div className="text-stone-300 text-sm font-medium mb-1">Your crate is empty</div>
              <div className="text-stone-600 text-xs">Import your Discogs collection to get personalised picks.</div>
            </div>
          )}

          {recoLoading && (
            <div className="text-center py-8">
              <img src="/icon-192.png" alt="" style={{ width: 40, height: 40, borderRadius: "50%", display: "inline-block", animation: "spin 2s linear infinite" }} />
              <div className="text-stone-600 text-sm mt-3">Flipping through the crate...</div>
            </div>
          )}
          {recoError && <div className="text-red-500/70 text-sm text-center py-3">{recoError}</div>}
          {reco && !recoLoading && (
            <RecoCard reco={reco} onClose={() => setReco(null)} onGenreClick={toggleGenre} activeGenres={activeGenres} onLogPlay={handleLogPlay} onSelect={setSelected} />
          )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 16, ...(tabSlide ? { animation: `cm-slide-${tabSlide} 200ms ease-out` } : {}) }}>
          {!seenHints["history"] && playSessions.length === 0 && (
            <HintBanner onDismiss={() => dismissHint("history")}>
              Long-press any record in visual views, tap the play button in list view, or use the Log button in the detail card to log a play.
            </HintBanner>
          )}
          <div className="px-4">
          {(() => {
            const streak = computeStreak(playSessions);
            const badge = streakBadge(streak);
            const allSessions = groupPlaySessions(playSessions, collection || []);

            return (
              <>
                {streak > 0 && (
                  <div className="flex items-center gap-2 px-2.5 py-2 mb-3 rounded-xl bg-amber-900/15 border border-amber-900/25">
                    <span className="text-lg">{streak >= 7 ? "🔥" : "●"}</span>
                    <div>
                      <span className="text-amber-300 text-sm font-medium">{streak} day streak</span>
                      {badge && <span className="text-amber-900/80 text-xs ml-2">{badge}</span>}
                    </div>
                  </div>
                )}
                {playSessions.length === 0 ? (
                  <div className="text-stone-600 text-sm text-center py-16">No plays logged yet.</div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={historySearch}
                          onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); setHistoryVisible(HISTORY_PAGE_SIZE); }}
                          placeholder="Search plays…"
                          className="w-full bg-stone-900/60 border border-stone-800 rounded-full pl-8 pr-3 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                        />
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 text-stone-600 absolute left-2.5 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        {historySearch && (
                          <button onClick={() => setHistorySearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400 text-xs">×</button>
                        )}
                      </div>
                      <button
                        onClick={() => { setHistoryInfiniteScroll(s => !s); setHistoryPage(1); setHistoryVisible(HISTORY_PAGE_SIZE); }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${historyInfiniteScroll ? "bg-amber-900/30 border-amber-800/40 text-amber-400" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                      >
                        {historyInfiniteScroll ? "∞" : "p."}
                      </button>
                    </div>
                  <div className="space-y-1">
                    {(() => {
                      const q = historySearch.toLowerCase().trim();
                      const filtered = q
                        ? allSessions.filter(s => s.records.some(r =>
                            (r.title || "").toLowerCase().includes(q) ||
                            (r.artist || "").toLowerCase().includes(q)
                          ))
                        : allSessions;
                      const historyTotalPages = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
                      const visibleSessions = historyInfiniteScroll
                        ? filtered.slice(0, historyVisible)
                        : filtered.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
                      const historyHasMore = historyInfiniteScroll && historyVisible < filtered.length;
                      // Group visible sessions by calendar day
                      const sessionsByDay = [];
                      visibleSessions.forEach(session => {
                        const dayKey = new Date(session.startTime).toDateString();
                        if (!sessionsByDay.length || sessionsByDay[sessionsByDay.length - 1].dayKey !== dayKey) {
                          sessionsByDay.push({ dayKey, label: sessionDateLabel(session.startTime), sessions: [] });
                        }
                        sessionsByDay[sessionsByDay.length - 1].sessions.push(session);
                      });
                      const sessionTimeOfDay = (t) => {
                        const h = new Date(t).getHours();
                        if (h >= 5 && h < 12) return "Morning";
                        if (h >= 12 && h < 17) return "Afternoon";
                        if (h >= 17 && h < 21) return "Evening";
                        return "Night";
                      };
                      return (<>
                        {q && filtered.length === 0 && (
                          <div className="text-stone-600 text-sm text-center py-8">No plays matching "{historySearch}"</div>
                        )}
                        {sessionsByDay.map(({ dayKey, label, sessions: daySessions }, dayIdx) => (
                          <div key={dayKey}>
                            {/* Day header */}
                            <div className={`flex items-center gap-3 px-2 pb-1 ${dayIdx === 0 ? "pt-1" : "pt-4"}`}>
                              <div className="flex-1 h-px bg-stone-800/50" />
                              <span className="text-stone-600 text-xs shrink-0">{label}</span>
                              <div className="flex-1 h-px bg-stone-800/50" />
                            </div>
                            {daySessions.map((session) => {
                      const isExpanded = expandedSessions.has(session.id);
                      const thumbs = session.records.slice(0, 3);
                      const playCounts2 = {};
                      for (const p of session.plays) {
                        playCounts2[p.record_id] = (playCounts2[p.record_id] || 0) + 1;
                      }
                      return (
                        <div key={session.id}>
                          {/* Collapsed row */}
                          <div
                            onClick={() => setExpandedSessions(prev => {
                              const next = new Set(prev);
                              if (next.has(session.id)) next.delete(session.id);
                              else next.add(session.id);
                              return next;
                            })}
                            className="flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] transition-all"
                            style={{ minHeight: 52 }}
                          >
                            {/* Stacked thumbnails */}
                            <div className="relative shrink-0" style={{ width: 28 + (thumbs.length - 1) * 14, height: 28 }}>
                              {thumbs.map((r, i) => (
                                <div key={r.id} className="absolute rounded-md overflow-hidden border border-stone-800"
                                  style={{ left: i * 14, top: 0, width: 28, height: 28, zIndex: thumbs.length - i }}>
                                  <CoverArt record={r} size={28} />
                                </div>
                              ))}
                            </div>
                            {/* Labels */}
                            <div className="flex-1 min-w-0">
                              <div className="text-amber-50 text-sm truncate" style={{ fontFamily: "'Fraunces',serif" }}>
                                {sessionTimeOfDay(session.startTime)}
                              </div>
                              <div className="text-stone-500 text-xs">{sessionDurationLabel(session.playCount, session.listeningSecs)}</div>
                            </div>
                            {/* Share story button */}
                            <button
                              onClick={e => { e.stopPropagation(); handleShareStory(session); }}
                              disabled={storyGenerating}
                              className="shrink-0 text-stone-600 hover:text-stone-300 transition-colors disabled:opacity-40 p-1 rounded-lg hover:bg-white/[0.06]"
                              title="Share as story"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                            </button>
                            {/* Chevron */}
                            <span className={`text-stone-600 text-xs transition-transform inline-block shrink-0 ${isExpanded ? "rotate-90" : ""}`}>›</span>
                          </div>
                          {/* Expanded record list */}
                          {isExpanded && (
                            <div className="ml-4 mb-1 space-y-0.5">
                              {session.records.map(rec => {
                                const count = playCounts2[String(rec.id)] || 1;
                                // Find the most recent play for this record in this session
                                const mostRecentPlay = session.plays.find(p => String(p.record_id) === String(rec.id));
                                return (
                                  <div key={rec.id}
                                    onClick={() => { setSelected(rec); if (!rec.for_sale) setLastPlayed(rec); }}
                                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all">
                                    <CoverArt record={rec} size={36} />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-amber-50 text-xs truncate" style={{ fontFamily: "'Fraunces',serif" }}>{rec.title}</div>
                                      <div className="text-stone-500 text-[10px] truncate">{rec.artist}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {count > 1 && (
                                        <span className="text-stone-500 text-[10px]">×{count}</span>
                                      )}
                                      {mostRecentPlay && new Date(mostRecentPlay.played_at).toDateString() === new Date().toDateString() && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await fetch(`/api/plays/${mostRecentPlay.id}`, { method: "DELETE" });
                                            setPlaySessions(prev => prev.filter(s => s.id !== mostRecentPlay.id));
                                            setPlayCounts(prev => ({ ...prev, [rec.id]: Math.max((prev[rec.id] || 0) - 1, 0) }));
                                            setLastPlayedDates(prev => {
                                              const remaining = playSessions.filter(s => s.id !== mostRecentPlay.id && s.record_id === rec.id);
                                              const nd = { ...prev };
                                              if (remaining.length > 0) nd[rec.id] = remaining[0].played_at;
                                              else delete nd[rec.id];
                                              return nd;
                                            });
                                          }}
                                          className="text-stone-700 hover:text-stone-400 transition-colors text-base w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/[0.06]"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                            })}
                          </div>
                        ))}
                        {historyInfiniteScroll
                          ? (historyHasMore && <div ref={historySentinelRef} className="py-4 text-center text-stone-700 text-xs">Loading more…</div>)
                          : filtered.length > HISTORY_PAGE_SIZE && (
                            <div className="flex items-center justify-center gap-3 py-4">
                              <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                                ← Prev
                              </button>
                              <span className="text-stone-600 text-xs">{historyPage} / {historyTotalPages}</span>
                              <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages}
                                className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                                Next →
                              </button>
                            </div>
                          )
                        }
                      </>);
                    })()}
                  </div>
                  </>
                )}
              </>
            );
          })()}
          </div>
        </div>
      )}

      {tab === "wants" && (
        <div className="flex-1 flex flex-col overflow-hidden" style={tabSlide ? { animation: `cm-slide-${tabSlide} 200ms ease-out` } : undefined}>
          {/* Subtab pills */}
          <div className="px-4 pt-2 pb-1 flex gap-2 shrink-0">
            <button
              onClick={() => setWantsSubTab("wantlist")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${wantsSubTab === "wantlist" ? "bg-amber-900/30 border-amber-800/40 text-amber-400" : "border-stone-800 text-stone-500 hover:text-stone-300"}`}
            >Wantlist</button>
            <button
              onClick={() => setWantsSubTab("discover")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${wantsSubTab === "discover" ? "bg-amber-900/30 border-amber-800/40 text-amber-400" : "border-stone-800 text-stone-500 hover:text-stone-300"}`}
            >Discover</button>
          </div>

          {wantsSubTab === "wantlist" && (
            <WantlistTab
              wantlist={wantlist}
              wantlistImportJob={wantlistImportJob}
              expandedMasters={expandedMasters}
              setExpandedMasters={setExpandedMasters}
              pushPermission={pushPermission}
              pushSubscribed={pushSubscribed}
              onSubscribePush={subscribeToPush}
              priceThresholds={priceThresholds}
              onSaveThreshold={savePriceThreshold}
              onRemoveThreshold={removePriceThreshold}
              nowPlaying={!!nowPlaying}
                           onStartImport={async () => {
                if (!wantlist) {
                  const res = await fetch("/api/discogs/wantlist");
                  if (res.ok) setWantlist(await res.json());
                }
                const res = await fetch("/api/discogs/wantlist/import", { method: "POST" });
                const data = await res.json();
                setWantlistImportJob({ job_id: data.job_id, status: data.status, imported: 0, total: 0 });
              }}
              onRemove={async (releaseId) => {
                await fetch("/api/discogs/wantlist", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ release_id: releaseId }),
                });
                const res = await fetch("/api/discogs/wantlist");
                if (res.ok) setWantlist(await res.json());
              }}
            />
          )}

          {wantsSubTab === "discover" && (
            <div className="flex-1 overflow-y-auto px-4 space-y-3 pt-2" style={{ paddingBottom: 16 }}>

              {myRecords.length === 0 && (
                <div className="text-center py-10 px-4">
                  <div className="text-4xl mb-3">⬡</div>
                  <div className="text-stone-300 text-sm font-medium mb-1">Your crate is empty</div>
                  <div className="text-stone-600 text-xs">Import your Discogs collection to discover similar artists.</div>
                </div>
              )}

              {/* Spotify section — green contour */}
              {spotifyLinked === true && (
                <div className="rounded-xl border border-green-600/40 overflow-hidden">
                  <button
                    onClick={() => setSpotifyExpanded(e => !e)}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer ${spotifyExpanded ? "border-b border-stone-800/40" : ""}`}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                    <span className="text-xs text-stone-400 uppercase tracking-widest font-medium flex-1">From your Spotify</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-stone-600">
                      {spotifyRecs?.length > 0 && !spotifyExpanded && <span>{spotifyRecs.length} albums</span>}
                      <span>{spotifyExpanded ? "▲" : "▼"}</span>
                    </span>
                  </button>
                  {spotifyExpanded && (
                    <>
                      {spotifyRecsLoading && (
                        <div className="px-4 py-4 text-stone-600 text-xs">Loading your listening history...</div>
                      )}
                      {!spotifyRecsLoading && spotifyRecs !== null && spotifyRecs.length === 0 && (
                        <div className="px-4 py-4 text-stone-600 text-xs">All your top played albums are already in your crate.</div>
                      )}
                      {!spotifyRecsLoading && spotifyRecs && spotifyRecs.length > 0 && (
                        <div className="divide-y divide-stone-800/40">
                          {spotifyRecs.slice(0, 10).map((rec) => (
                            <div key={`${rec.artist}|${rec.album}`} className="flex items-center gap-3 px-4 py-3">
                              {rec.image ? (
                                <img src={rec.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-stone-800" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-stone-800 shrink-0 flex items-center justify-center text-stone-600 text-xs">◇</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-amber-50 font-medium truncate">{rec.album}</div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-stone-500 truncate">{rec.artist}{rec.year ? ` · ${rec.year}` : ""}</span>
                                  {rec.artist_in_crate && (
                                    <span className="text-[10px] text-amber-900/70">you have other {rec.artist} records</span>
                                  )}
                                  {rec.on_wantlist && (
                                    <span className="text-[10px] text-stone-500">◉ on wantlist</span>
                                  )}
                                </div>
                              </div>
                              {rec.discogs_vinyl_url && (
                                <a
                                  href={rec.discogs_vinyl_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-[10px] text-stone-600 hover:text-amber-400 transition-colors whitespace-nowrap"
                                >
                                  Find vinyl ↗
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {!spotifyRecsLoading && (
                        <div className="px-4 py-2 border-t border-stone-800/40">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => { setSpotifyLinked(null); setSpotifyRecs(null); }}
                              className="text-[10px] text-stone-700 hover:text-stone-500 transition-colors"
                            >
                              Refresh
                            </button>
                            <button
                              onClick={async () => {
                                await fetch("/api/spotify/status", { method: "DELETE" });
                                setSpotifyLinked(false);
                                setSpotifyRecs(null);
                              }}
                              className="text-[10px] text-stone-700 hover:text-rose-500 transition-colors"
                            >
                              Disconnect Spotify
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Last.fm section — red contour */}
              <div className="rounded-xl border border-red-900/40 overflow-hidden">
                <button
                  onClick={() => setLastfmExpanded(e => !e)}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer ${lastfmExpanded ? "border-b border-stone-800/40" : ""}`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="#D51007"><path d="M10.596 20.727l-.707-1.979s-1.22 1.345-2.993 1.345c-1.581 0-2.711-1.38-2.711-3.597 0-2.829 1.43-3.831 2.831-3.831 2.589 0 3.417 1.68 4.131 3.831l.709 2.299c.731 2.24 2.124 4.047 6.12 4.047 2.872 0 4.812-.882 4.812-3.212 0-1.876-1.072-2.843-3.062-3.308l-1.481-.332c-1.027-.235-1.334-.661-1.334-1.367 0-.806.64-1.278 1.679-1.278 1.133 0 1.738.423 1.833 1.432l2.344-.285c-.195-2.115-1.651-2.98-4.039-2.98-2.113 0-4.157.796-4.157 3.347 0 1.594.771 2.597 2.71 3.065l1.573.378c1.163.284 1.573.756 1.573 1.511 0 .899-.877 1.269-2.354 1.269-2.278 0-3.231-1.198-3.785-2.831l-.749-2.3c-.98-3.017-2.547-4.139-6.528-4.139-3.963 0-5.246 2.499-5.246 5.784 0 3.116 1.594 5.571 5.151 5.571 2.686 0 4.282-1.322 4.282-1.322z"/></svg>
                  <span className="text-xs text-stone-400 uppercase tracking-widest font-medium flex-1">Sounds like your crate</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-stone-600">
                    {lastfmRecs?.length > 0 && !lastfmExpanded && <span>{lastfmRecs.length} artists</span>}
                    <span>{lastfmExpanded ? "▲" : "▼"}</span>
                  </span>
                </button>
                {lastfmExpanded && (
                  <>
                    {lastfmRecsLoading && (
                      <div className="px-4 py-4 text-stone-600 text-xs">Finding similar artists...</div>
                    )}
                    {!lastfmRecsLoading && lastfmRecs !== null && lastfmRecs.length === 0 && (
                      <div className="px-4 py-4 text-stone-600 text-xs">No new artists found — try adding more records to your crate.</div>
                    )}
                    {!lastfmRecsLoading && lastfmRecs && lastfmRecs.length > 0 && (
                      <div className="divide-y divide-stone-800/40">
                        {lastfmRecs.map((artist) => (
                          <div key={artist.name} className="px-4 py-3">
                            <div className="mb-2">
                              <div className="text-xs font-semibold text-stone-300 truncate">{artist.name}</div>
                              <div className="text-[10px] text-stone-600 truncate mt-0.5">Similar to: {artist.similar_to.join(", ")}</div>
                            </div>
                            {artist.top_albums?.length > 0 ? (
                              <div className="space-y-1.5 pl-2">
                                {artist.top_albums.map((album) => (
                                  <div key={album.name} className="flex items-center gap-2">
                                    {album.image ? (
                                      <img src={album.image} alt="" className="w-7 h-7 rounded object-cover shrink-0 bg-stone-800" />
                                    ) : (
                                      <div className="w-7 h-7 rounded bg-stone-800 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0 text-[11px] text-stone-400 truncate">{album.name}</div>
                                    <a
                                      href={`https://www.discogs.com/search/?artist=${encodeURIComponent(artist.name)}&q=${encodeURIComponent(album.name)}&type=release&format=Vinyl`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 text-[10px] text-stone-600 hover:text-amber-400 transition-colors whitespace-nowrap"
                                    >
                                      Find vinyl ↗
                                    </a>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <a
                                href={`https://www.discogs.com/search/?artist=${encodeURIComponent(artist.name)}&type=release&format=Vinyl`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-stone-600 hover:text-amber-400 transition-colors"
                              >
                                Search Discogs ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!lastfmRecsLoading && lastfmRecs !== null && (
                      <div className="px-4 py-2 border-t border-stone-800/40">
                        <button
                          onClick={() => setLastfmRecs(null)}
                          className="text-[10px] text-stone-700 hover:text-stone-500 transition-colors"
                        >
                          Refresh
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "stats" && (
        <div className="flex-1 px-4 overflow-y-auto" style={{ paddingBottom: 16, ...(tabSlide ? { animation: `cm-slide-${tabSlide} 200ms ease-out` } : {}) }}>
          {(() => {
            const { decades, genres, formats, styles } = buildCollectionStats(myRecords);
            const { byHour, byDow, nightPlays, dayPlays, weekendPlays, weekdayPlays, midnightRecord, sunMorningRecord } = buildTimeStats(playSessions, collection);
            const totalPlays = playSessions.length;

            // Listening time stats using duration_secs
            const recordDurationMap = Object.fromEntries((collection || []).filter(r => r.duration_secs).map(r => [String(r.id), r.duration_secs]));
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const playsThisWeek = playSessions.filter(p => new Date(p.played_at).getTime() >= weekAgo);
            const weekListeningSecs = playsThisWeek.reduce((sum, p) => sum + (recordDurationMap[String(p.record_id)] || 0), 0);
            const totalListeningSecs = playSessions.reduce((sum, p) => sum + (recordDurationMap[String(p.record_id)] || 0), 0);
            const weekListeningLabel = weekListeningSecs > 0 ? formatListeningTime(weekListeningSecs) : null;
            const totalListeningLabel = totalListeningSecs > 0 ? formatListeningTime(totalListeningSecs) : null;

            const sortedDecades = Object.entries(decades).sort((a, b) => a[0].localeCompare(b[0]));
            const maxDecadeCount = Math.max(...Object.values(decades), 1);
            const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 7);
            const maxGenreCount = Math.max(...topGenres.map(([,v]) => v), 1);
            const formatEntries = Object.entries(formats).sort((a, b) => b[1] - a[1]);
            const maxFmtCount = Math.max(...Object.values(formats), 1);
            const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const maxDow = Math.max(...byDow, 1);
            const timeSlots = [
              { label: "Morning", hours: [6,7,8,9,10,11], icon: "☀" },
              { label: "Afternoon", hours: [12,13,14,15,16,17], icon: "⛅" },
              { label: "Evening", hours: [18,19,20,21], icon: "🌆" },
              { label: "Night", hours: [22,23,0,1,2,3], icon: "🌙" },
            ];
            const slotCounts = timeSlots.map(({ hours }) => hours.reduce((sum, h) => sum + byHour[h], 0));
            const maxSlot = Math.max(...slotCounts, 1);

            // Listening analytics (moved from History tab)
            const streak = computeStreak(playSessions);
            const longestStreak = computeLongestStreak(playSessions);
            const topPlayed = Object.entries(playCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([id, count]) => ({ record: myRecords.find(r => String(r.id) === String(id)), count }))
              .filter(x => x.record);
            const maxPlays = topPlayed[0]?.count || 1;
            const genrePlayCounts = {};
            for (const [id, count] of Object.entries(playCounts)) {
              const rec = collection?.find(r => String(r.id) === String(id));
              if (!rec) continue;
              for (const g of getGenres(rec)) genrePlayCounts[g] = (genrePlayCounts[g] || 0) + count;
            }
            const topPlayedGenres = Object.entries(genrePlayCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const maxGenrePlays = topPlayedGenres[0]?.[1] || 1;

            return (
              <div className="space-y-6 pt-2">
                {/* Subtab pills */}
                <div className="flex gap-2">
                  {[["collection", "Collection"], ["listening", "Listening"]].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setStatsSubTab(id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        statsSubTab === id
                          ? "bg-amber-900/30 border-amber-800/40 text-amber-400"
                          : "border-stone-800 text-stone-500 hover:text-stone-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── Listening subtab ── */}
                {statsSubTab === "listening" && (
                  <>
                    {totalPlays === 0 && (
                      <div className="text-center py-16 px-4">
                        <div className="text-2xl mb-2 text-stone-700">▷</div>
                        <div className="text-stone-600 text-sm">No plays logged yet.</div>
                        <div className="text-stone-700 text-xs mt-1">Long-press any record to log a play.</div>
                      </div>
                    )}

                    {/* Share listening button */}
                    {totalPlays >= 5 && (
                      <div className="flex justify-end">
                        <button
                          onClick={async () => {
                            if (dnaGenerating) return;
                            setDnaGenerating(true);
                            try {
                              // Genre bar by play count (not record count)
                              const playGenreCounts = {};
                              for (const [id, count] of Object.entries(playCounts)) {
                                const rec = myRecords.find(r => String(r.id) === String(id));
                                if (!rec) continue;
                                for (const g of getGenres(rec)) playGenreCounts[g] = (playGenreCounts[g] || 0) + count;
                              }
                              const topGenresList = Object.entries(playGenreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({ genre, count }));

                              // Top artists by plays with record thumbnails
                              const artistPlayCounts = {};
                              for (const [id, count] of Object.entries(playCounts)) {
                                const rec = myRecords.find(r => String(r.id) === String(id));
                                if (rec?.artist) artistPlayCounts[rec.artist] = (artistPlayCounts[rec.artist] || 0) + count;
                              }
                              const topPlayedArtists = Object.entries(artistPlayCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([artist, count]) => ({
                                artist, count,
                                records: myRecords.filter(r => r.artist === artist).slice(0, 5).map(r => ({ thumb: r.thumb })),
                              }));

                              // Play-weighted audio profile
                              const myIds = new Set(myRecords.map(r => r.id));
                              let wEnergy = 0, wValence = 0, wDance = 0, wAcoustic = 0, wTempo = 0, wTotal = 0;
                              for (const [id, count] of Object.entries(playCounts)) {
                                if (!myIds.has(id)) continue;
                                const f = spotifyFeatures[id];
                                if (!f) continue;
                                wEnergy += f.energy * count; wValence += f.valence * count;
                                wDance += f.danceability * count; wAcoustic += f.acousticness * count;
                                wTempo += (f.tempo || 0) * count; wTotal += count;
                              }
                              const playAudioProfile = wTotal > 0 ? {
                                energy: wEnergy / wTotal, valence: wValence / wTotal,
                                danceability: wDance / wTotal, acousticness: wAcoustic / wTotal,
                                tempo: wTempo / wTotal,
                              } : null;

                              const uniqueRecords = new Set(Object.keys(playCounts).filter(id => (playCounts[id] || 0) > 0)).size;
                              const listeningStats = {
                                topGenres: topGenresList,
                                totalPlays,
                                totalListeningLabel: totalListeningLabel,
                                topPlayed: topPlayed.slice(0, 10),
                                topPlayedArtists,
                                streak,
                                nightPlays, dayPlays, weekendPlays, weekdayPlays,
                                uniqueRecords,
                                playAudioProfile,
                              };
                              const canvas = await generateListeningDNA(listeningStats, discogsUsername);
                              const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
                              const file = new File([blob], "listening-dna.png", { type: "image/png" });
                              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                await navigator.share({ files: [file] });
                              } else {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url; a.download = file.name; a.click();
                                URL.revokeObjectURL(url);
                              }
                            } catch (err) {
                              if (err?.name !== "AbortError") console.error("Listening DNA export failed:", err);
                            } finally {
                              setDnaGenerating(false);
                            }
                          }}
                          disabled={dnaGenerating}
                          className="px-3 py-1.5 rounded-full bg-amber-900/20 border border-amber-800/30 text-amber-400 text-xs hover:bg-amber-900/40 transition-colors disabled:opacity-40"
                        >
                          {dnaGenerating ? "Generating…" : "↗ Share listening"}
                        </button>
                      </div>
                    )}

                    {/* Identity labels */}
                    {totalPlays >= 5 && (
                      <div className="flex gap-2">
                        <div className="flex-1 bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-center">
                          <div className="text-xl">{nightPlays > dayPlays ? "🌙" : "☀"}</div>
                          <div className="text-amber-300 text-xs font-medium mt-1">{nightPlays > dayPlays ? "Night Owl" : "Early Bird"}</div>
                        </div>
                        <div className="flex-1 bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-center">
                          <div className="text-xl">{weekendPlays / Math.max(totalPlays,1) > 0.4 ? "🎉" : "📅"}</div>
                          <div className="text-amber-300 text-xs font-medium mt-1">{weekendPlays / Math.max(totalPlays,1) > 0.4 ? "Weekend Warrior" : "Daily Listener"}</div>
                        </div>
                      </div>
                    )}

                    {/* Listening time */}
                    {(weekListeningLabel || totalListeningLabel) && (
                      <div className="flex gap-2">
                        {weekListeningLabel && (
                          <div className="flex-1 bg-white/[0.04] rounded-xl p-3 text-center">
                            <div className="text-amber-200 text-lg font-light" style={{ fontFamily: "'Fraunces',serif" }}>{weekListeningLabel}</div>
                            <div className="text-stone-500 text-xs mt-0.5">this week</div>
                          </div>
                        )}
                        {totalListeningLabel && (
                          <div className="flex-1 bg-white/[0.04] rounded-xl p-3 text-center">
                            <div className="text-amber-200 text-lg font-light" style={{ fontFamily: "'Fraunces',serif" }}>{totalListeningLabel}</div>
                            <div className="text-stone-500 text-xs mt-0.5">all time</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2x2 stats grid */}
                    {totalPlays > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                          <div className="text-stone-600 text-xs mb-0.5">Total Plays</div>
                          <div className="text-stone-200 text-sm font-medium">{totalPlays}</div>
                        </div>
                        <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                          <div className="text-stone-600 text-xs mb-0.5">Listening Time</div>
                          <div className="text-stone-200 text-sm font-medium">{totalListeningSecs > 0 ? formatListeningTime(totalListeningSecs) : "—"}</div>
                        </div>
                        <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                          <div className="text-stone-600 text-xs mb-0.5">Current Streak</div>
                          <div className="text-stone-200 text-sm font-medium">{streak > 0 ? `${streak}d` : "—"}</div>
                        </div>
                        <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                          <div className="text-stone-600 text-xs mb-0.5">Longest Streak</div>
                          <div className="text-stone-200 text-sm font-medium">{longestStreak > 0 ? `${longestStreak}d` : "—"}</div>
                        </div>
                      </div>
                    )}

                    {/* Most Played */}
                    {topPlayed.length > 0 && (
                      <div>
                        <div className="text-stone-600 text-xs uppercase tracking-widest mb-2 px-0.5">Most Played</div>
                        <div className="space-y-1.5">
                          {topPlayed.map(({ record: r, count }) => (
                            <div key={r.id} className="flex items-center gap-2.5">
                              <CoverArt record={r} size={32} />
                              <div className="flex-1 min-w-0">
                                <div className="text-stone-300 text-xs truncate" style={{ fontFamily: "'Fraunces',serif" }}>{r.title}</div>
                                <div className="mt-0.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                  <div className="h-full rounded-full bg-amber-700/60" style={{ width: `${Math.round((count / maxPlays) * 100)}%` }} />
                                </div>
                              </div>
                              <div className="text-stone-600 text-xs shrink-0 w-6 text-right">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Genre Mix (play-weighted) */}
                    {topPlayedGenres.length > 0 && (
                      <div>
                        <div className="text-stone-600 text-xs uppercase tracking-widest mb-2 px-0.5">Genre Mix</div>
                        <div className="space-y-1.5">
                          {topPlayedGenres.map(([genre, count]) => (
                            <div key={genre} className="flex items-center gap-2.5">
                              <div className="text-stone-500 text-xs w-20 shrink-0 truncate">{genre}</div>
                              <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <div className="h-full rounded-full bg-stone-500/70" style={{ width: `${Math.round((count / maxGenrePlays) * 100)}%` }} />
                              </div>
                              <div className="text-stone-700 text-xs shrink-0 w-6 text-right">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* When You Listen + Day of Week */}
                    {totalPlays > 0 && (
                      <>
                        <div>
                          <div className="text-stone-600 text-xs uppercase tracking-widest mb-2 px-0.5">When You Listen</div>
                          <div className="grid grid-cols-4 gap-2">
                            {timeSlots.map(({ label, icon }, idx) => (
                              <div key={label} className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                                <div className="text-lg">{icon}</div>
                                <div className="mt-1 h-8 flex items-end justify-center">
                                  <div
                                    className="w-4 bg-amber-800/60 rounded-sm"
                                    style={{ height: `${Math.max(4, (slotCounts[idx] / maxSlot) * 32)}px` }}
                                  />
                                </div>
                                <div className="text-stone-500 text-[10px] mt-1">{label}</div>
                                <div className="text-stone-400 text-xs">{slotCounts[idx]}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-stone-600 text-xs uppercase tracking-widest mb-2 px-0.5">Day of Week</div>
                          <div className="flex items-end gap-1 h-16">
                            {byDow.map((count, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className="w-full rounded-sm"
                                  style={{
                                    height: `${Math.max(4, (count / maxDow) * 48)}px`,
                                    background: i === 0 || i === 6 ? "rgba(180,100,30,0.6)" : "rgba(100,100,100,0.4)",
                                  }}
                                />
                                <div className="text-stone-600 text-[10px]">{dowLabels[i].slice(0,1)}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {(midnightRecord || sunMorningRecord) && (
                          <div>
                            <div className="text-stone-600 text-xs uppercase tracking-widest mb-2 px-0.5">Special Records</div>
                            <div className="space-y-2">
                              {midnightRecord && (
                                <button
                                  onClick={() => { setSelected(midnightRecord); setLastPlayed(midnightRecord); }}
                                  className="w-full flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 hover:bg-white/[0.06] transition-colors text-left"
                                >
                                  <span className="text-lg shrink-0">🌙</span>
                                  <CoverArt record={midnightRecord} size={36} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-amber-50 text-xs truncate" style={{ fontFamily: "'Fraunces',serif" }}>{midnightRecord.title}</div>
                                    <div className="text-stone-600 text-xs">Midnight record</div>
                                  </div>
                                </button>
                              )}
                              {sunMorningRecord && (
                                <button
                                  onClick={() => { setSelected(sunMorningRecord); setLastPlayed(sunMorningRecord); }}
                                  className="w-full flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 hover:bg-white/[0.06] transition-colors text-left"
                                >
                                  <span className="text-lg shrink-0">☕</span>
                                  <CoverArt record={sunMorningRecord} size={36} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-amber-50 text-xs truncate" style={{ fontFamily: "'Fraunces',serif" }}>{sunMorningRecord.title}</div>
                                    <div className="text-stone-600 text-xs">Sunday morning album</div>
                                  </div>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ── Collection subtab ── */}
                {statsSubTab === "collection" && (
                  <>
                {/* Collection DNA export */}
                {myRecords.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        if (dnaGenerating) return;
                        setDnaGenerating(true);
                        try {
                          const myIds = new Set(myRecords.map(r => r.id));
                          const spotifyData = Object.entries(spotifyFeatures).filter(([id]) => myIds.has(id)).map(([, f]) => f);
                          const topGenresList = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({ genre, count }));
                          const topDecadesList = Object.entries(decades).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([decade, count]) => ({ decade, count }));
                          const artistCounts = {};
                          myRecords.forEach(r => { if (r.artist) artistCounts[r.artist] = (artistCounts[r.artist] || 0) + 1; });
                          const topArtistsList = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([artist, count]) => ({
                            artist, count,
                            records: myRecords.filter(r => r.artist === artist).slice(0, 5).map(r => ({ thumb: r.thumb })),
                          }));
                          const favoriteRecordsList = [...myRecords]
                            .filter(r => (r.favorite_tracks || []).length > 0)
                            .sort((a, b) => {
                              // Sort by % of tracks hearted (fair to short albums)
                              const tcA = spotifyFeatures[a.id]?.track_count || (a.favorite_tracks || []).length || 1;
                              const tcB = spotifyFeatures[b.id]?.track_count || (b.favorite_tracks || []).length || 1;
                              const pctA = (a.favorite_tracks || []).length / tcA;
                              const pctB = (b.favorite_tracks || []).length / tcB;
                              return pctB - pctA;
                            })
                            .slice(0, 10)
                            .map(r => ({ id: r.id, title: r.title, artist: r.artist, thumb: r.thumb, heartCount: (r.favorite_tracks || []).length }));
                          const avg = (key) => spotifyData.reduce((s, f) => s + (f[key] || 0), 0) / (spotifyData.length || 1);
                          const audioProfile = spotifyData.length > 0 ? { energy: avg("energy"), valence: avg("valence"), danceability: avg("danceability"), acousticness: avg("acousticness"), tempo: avg("tempo") } : null;
                          const stats = {
                            topGenres: topGenresList,
                            topDecades: topDecadesList,
                            topArtists: topArtistsList,
                            favoriteRecords: favoriteRecordsList,
                            audioProfile,
                            totalRecords: myRecords.length,
                            totalPlays: Object.values(playCounts).reduce((s, v) => s + v, 0),
                            totalOwnedLabel: (() => {
                              const secs = myRecords.reduce((s, r) => s + (r.duration_secs || 0), 0);
                              return secs > 0 ? formatListeningTime(secs) : null;
                            })(),
                          };
                          const canvas = await generateCollectionDNA(stats, discogsUsername);
                          const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
                          const filename = "collection-dna.png";
                          const file = new File([blob], filename, { type: "image/png" });
                          if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({ files: [file] });
                          } else {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = filename; a.click();
                            URL.revokeObjectURL(url);
                          }
                        } catch (err) {
                          if (err?.name !== "AbortError") console.error("DNA export failed:", err);
                        } finally {
                          setDnaGenerating(false);
                        }
                      }}
                      disabled={dnaGenerating}
                      className="px-3 py-1.5 rounded-full bg-amber-900/20 border border-amber-800/30 text-amber-400 text-xs hover:bg-amber-900/40 transition-colors disabled:opacity-40"
                    >
                      {dnaGenerating ? "Generating…" : "↗ Share collection"}
                    </button>
                  </div>
                )}
                {/* Collection summary tiles */}
                {myRecords.length > 0 && (() => {
                  const uniqueArtists = new Set(myRecords.map(r => r.artist).filter(Boolean)).size;
                  const totalDurationSecs = myRecords.reduce((s, r) => s + (r.duration_secs || 0), 0);
                  const totalDurationLabel = totalDurationSecs > 0 ? formatListeningTime(totalDurationSecs) : null;
                  const oldestYear = Math.min(...myRecords.map(r => r.year_original || r.year_pressed || 9999).filter(y => y < 9999));
                  const newestYear = Math.max(...myRecords.map(r => r.year_original || r.year_pressed || 0).filter(y => y > 0));
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/[0.04] rounded-xl p-3 text-center">
                        <div className="text-amber-200 text-lg font-light" style={{ fontFamily: "'Fraunces',serif" }}>{myRecords.length}</div>
                        <div className="text-stone-500 text-xs mt-0.5">records</div>
                      </div>
                      <div className="bg-white/[0.04] rounded-xl p-3 text-center">
                        <div className="text-amber-200 text-lg font-light" style={{ fontFamily: "'Fraunces',serif" }}>{uniqueArtists}</div>
                        <div className="text-stone-500 text-xs mt-0.5">artists</div>
                      </div>
                      {totalDurationLabel && (
                        <div className="bg-white/[0.04] rounded-xl p-3 text-center">
                          <div className="text-amber-200 text-lg font-light" style={{ fontFamily: "'Fraunces',serif" }}>{totalDurationLabel}</div>
                          <div className="text-stone-500 text-xs mt-0.5">of music</div>
                        </div>
                      )}
                      {oldestYear < 9999 && newestYear > 0 && (
                        <div className="bg-white/[0.04] rounded-xl p-3 text-center">
                          <div className="text-amber-200 text-lg font-light" style={{ fontFamily: "'Fraunces',serif" }}>{oldestYear}–{newestYear}</div>
                          <div className="text-stone-500 text-xs mt-0.5">year range</div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* By Decade */}
                {sortedDecades.length > 0 && (
                  <div>
                    <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">By Decade</div>
                    <div className="space-y-2">
                      {sortedDecades.map(([decade, count]) => (
                        <button key={decade} onClick={() => drillByDecade(decade)} className="w-full flex items-center gap-3 group">
                          <div className="text-stone-500 text-xs w-10 text-right shrink-0">{decade}</div>
                          <div className="flex-1 bg-stone-800/50 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full bg-amber-800/60 group-hover:bg-amber-700/80 rounded-full transition-all flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(8, (count / maxDecadeCount) * 100)}%` }}
                            >
                              <span className="text-amber-200 text-xs">{count}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* By Label */}
                {(() => {
                  const labels = {};
                  myRecords.forEach(r => {
                    const l = (r.label || "").trim();
                    if (l) labels[l] = (labels[l] || 0) + 1;
                  });
                  const sortedLabels = Object.entries(labels).sort((a, b) => b[1] - a[1]).slice(0, 20);
                  const maxLabelCount = Math.max(...sortedLabels.map(([,v]) => v), 1);
                  if (sortedLabels.length === 0) return null;
                  return (
                    <div>
                      <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">By Label</div>
                      <div className="space-y-2">
                        {sortedLabels.map(([label, count]) => (
                          <button key={label} onClick={() => drillByLabel(label)} className="w-full flex items-center gap-3 group">
                            <div className="text-stone-500 text-xs w-24 text-right shrink-0 truncate">{label}</div>
                            <div className="flex-1 bg-stone-800/50 rounded-full h-5 overflow-hidden">
                              <div
                                className="h-full bg-stone-700/60 group-hover:bg-stone-600/80 rounded-full transition-all flex items-center justify-end pr-2"
                                style={{ width: `${Math.max(8, (count / maxLabelCount) * 100)}%` }}
                              >
                                <span className="text-stone-300 text-xs">{count}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Genre/Style Bubble Map */}
                {(Object.keys(genres).length > 0 || Object.keys(styles).length > 0) && (() => {
                  // Build stylesByGenre for expanded style sub-bubbles
                  const stylesByGenre = {};
                  myRecords.forEach(r => {
                    getGenres(r).forEach(g => {
                      stylesByGenre[g] = stylesByGenre[g] || {};
                      getStyles(r).forEach(s => { stylesByGenre[g][s] = (stylesByGenre[g][s] || 0) + 1; });
                    });
                  });
                  const styleItems = {};
                  for (const [g, sMap] of Object.entries(stylesByGenre)) {
                    styleItems[g] = Object.entries(sMap).map(([label, count]) => ({ label, count })).sort((a,b) => b.count - a.count).slice(0, 8);
                  }
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-stone-500 text-xs uppercase tracking-wider">Collection Map</span>
                        <div className="flex gap-1">
                          {["genres", "styles"].map(v => (
                            <button key={v} onClick={() => setBubbleView(v)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                bubbleView === v
                                  ? "bg-stone-700 border-stone-500 text-stone-100"
                                  : "border-stone-700 text-stone-500 hover:text-stone-300"
                              }`}>
                              {v.charAt(0).toUpperCase() + v.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <GenreBubbleMap
                        items={Object.entries(bubbleView === "genres" ? genres : styles)
                          .map(([label, count]) => ({ label, count }))
                          .filter(i => i.label)}
                        styleItems={bubbleView === "genres" ? styleItems : {}}
                        onBubbleClick={bubbleView === "genres" ? drillByGenre : drillByStyle}
                        onStyleClick={(style, parentGenre) =>
                          parentGenre ? drillByGenreAndStyle(parentGenre, style) : drillByStyle(style)
                        }
                      />
                    </div>
                  );
                })()}

                {/* Sound Profile */}
                {(() => {
                  const myIds = new Set(myRecords.map(r => r.id));
                  const spotifyData = Object.entries(spotifyFeatures).filter(([id]) => myIds.has(id)).map(([, f]) => f);
                  const n = spotifyData.length;
                  const usingSpotify = n > 0;

                  // Fall back to genre-based estimates when no Spotify data
                  const relevant = usingSpotify
                    ? spotifyData
                    : myRecords.map(r => estimateFeaturesFromRecord(r));

                  const avg = (key) => relevant.reduce((s, f) => s + (f[key] || 0), 0) / relevant.length;
                  const energy = avg("energy");
                  const valence = avg("valence");
                  const danceability = avg("danceability");
                  const acousticness = avg("acousticness");
                  const tempo = avg("tempo");
                  const loudness = avg("loudness");

                  const bars = [
                    { label: "Energy",        value: energy,        color: "bg-amber-600/70" },
                    { label: "Mood",          value: valence,       color: "bg-rose-600/60", hint: valence > 0.6 ? "upbeat" : valence < 0.4 ? "melancholic" : "balanced" },
                    { label: "Danceability",  value: danceability,  color: "bg-emerald-700/60" },
                    { label: "Acoustic",      value: acousticness,  color: "bg-stone-500/70" },
                    { label: "Loudness",      value: loudness,      color: "bg-orange-900/70", hint: loudness > 0.80 ? "loud" : loudness < 0.45 ? "dynamic" : "balanced" },
                  ];

                  const analyzeCollection = async () => {
                    if (spotifyAnalyzing) return;
                    setSpotifyAnalyzing(true);
                    // Sort uncached records by play count descending so most-listened
                    // records get real data first, then process 10 per click.
                    const uncached = [...myRecords]
                      .filter(r => !spotifyFeatures[r.id])
                      .sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0))
                      .slice(0, 10);
                    for (const record of uncached) {
                      await fetchOneFeature(record, { force: true });
                    }
                    setSpotifyAnalyzing(false);
                  };

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-stone-400 text-xs uppercase tracking-widest">Sound Profile</div>
                        <div className="text-stone-600 text-xs">
                          {usingSpotify
                            ? `${Math.round(n / myRecords.length * 100)}% enriched (${n}/${myRecords.length}) · ${Math.round(tempo)} BPM`
                            : `genre estimates · ${Math.round(tempo)} BPM avg`}
                        </div>
                      </div>
                      {usingSpotify && n < myRecords.length && (
                        <div className="mb-3">
                          <div className="w-full bg-stone-800/50 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-amber-700/50 rounded-full transition-all" style={{ width: `${Math.round(n / myRecords.length * 100)}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 mb-3">
                        {bars.map(({ label, value, color, hint }) => (
                          <div key={label} className="flex items-center gap-3">
                            <div className="text-stone-500 text-xs w-20 shrink-0">{label}{hint ? <span className="text-stone-700 ml-1">({hint})</span> : null}</div>
                            <div className="flex-1 bg-stone-800/50 rounded-full h-4 overflow-hidden">
                              <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.round(value * 100)}%` }} />
                            </div>
                            <div className="text-stone-600 text-xs w-8 text-right">{Math.round(value * 100)}%</div>
                          </div>
                        ))}
                      </div>
                      {!usingSpotify ? (
                        <button
                          onClick={analyzeCollection}
                          disabled={spotifyAnalyzing}
                          className="text-xs text-stone-600 hover:text-amber-400 transition-colors disabled:opacity-40"
                        >
                          {spotifyAnalyzing ? "Analyzing via Spotify…" : "↑ Analyze via Spotify for precise data"}
                        </button>
                      ) : n < myRecords.length ? (
                        <button
                          onClick={analyzeCollection}
                          disabled={spotifyAnalyzing}
                          className="text-xs text-stone-600 hover:text-amber-400 transition-colors disabled:opacity-40"
                        >
                          {spotifyAnalyzing ? `Analyzing… (${n} done)` : `↑ Analyze next 10 (${myRecords.length - n} remaining)`}
                        </button>
                      ) : null}
                    </div>
                  );
                })()}

                {/* By Format */}
                {formatEntries.length > 0 && (
                  <div>
                    <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">By Format</div>
                    <div className="space-y-2">
                      {formatEntries.map(([fmt, count]) => (
                        <button key={fmt} onClick={() => drillByFormat(fmt)} className="w-full flex items-center gap-3 group">
                          <div className="text-stone-500 text-xs w-10 text-right shrink-0">{fmt}</div>
                          <div className="flex-1 bg-stone-800/50 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full bg-stone-700/70 group-hover:bg-stone-600/80 rounded-full transition-all flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(8, (count / maxFmtCount) * 100)}%` }}
                            >
                              <span className="text-stone-300 text-xs">{count}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                    {myRecords.length === 0 && (
                      <div className="text-stone-600 text-sm text-center py-16">Add records to see stats.</div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {tab === "discover" && (
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 16, ...(tabSlide ? { animation: `cm-slide-${tabSlide} 200ms ease-out` } : {}) }}>
          <div className="px-4 pt-2 space-y-4">
          {/* Discovery toggle + share */}
          <div className="bg-white/[0.04] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-stone-200 text-sm font-medium">Make my crate discoverable</div>
                <div className="text-stone-600 text-xs mt-0.5">Let other CrateMate users find you by shared artists</div>
              </div>
              <button
                onClick={async () => {
                  const next = !isDiscoverable;
                  setIsDiscoverable(next);
                  try {
                    await fetch("/api/discogs/toggle-discovery", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ discoverable: next }),
                    });
                  } catch { setIsDiscoverable(!next); }
                }}
                className={`w-11 h-6 rounded-full border transition-colors relative ${isDiscoverable ? "bg-amber-700/60 border-amber-600/60" : "bg-stone-800 border-stone-700"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white/90 transition-all shadow ${isDiscoverable ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
            {discogsUsername && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/crate/${discogsUsername}`;
                  if (navigator.share) navigator.share({ title: "Check out my crate", url }).catch(() => {});
                  else { navigator.clipboard.writeText(url); }
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-stone-800 text-stone-500 hover:text-amber-300 hover:border-amber-800/50 text-xs transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                Share your crate
              </button>
            )}
          </div>

          {!isDiscoverable ? (
            <div className="text-center py-12">
              <div className="text-stone-600 text-sm">Enable discovery above to find similar crates</div>
            </div>
          ) : (
            <>
              {/* Crate DNA — social card */}
              {(() => {
                const { genres } = buildCollectionStats(myRecords);
                const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 3);
                const topArtists = [...new Map(myRecords.filter(r => r.artist && !/^various/i.test(r.artist)).map(r => [r.artist, r])).entries()]
                  .map(([artist, r]) => ({ artist, count: myRecords.filter(x => x.artist === artist).length, thumb: r.thumb }))
                  .sort((a, b) => b.count - a.count).slice(0, 5);
                return (
                  <div className="bg-white/[0.04] rounded-xl overflow-hidden">
                    <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                      <div className="text-stone-500 text-xs uppercase tracking-wider">Your Crate DNA</div>
                      <div className="text-stone-700 text-[10px]">{myRecords.length} records</div>
                    </div>
                    {topGenres.length > 0 && (
                      <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                        {topGenres.map(([genre]) => (
                          <span key={genre} className="text-[10px] px-2 py-0.5 rounded-full border border-amber-800/30 bg-amber-900/15 text-amber-400/80">{genre}</span>
                        ))}
                      </div>
                    )}
                    <div className="px-3 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                      {topArtists.map(({ artist, count, thumb }) => (
                        <div key={artist} className="shrink-0 text-center" style={{ width: 52 }}>
                          <div className="w-10 h-10 mx-auto rounded-lg overflow-hidden bg-stone-800 mb-1">
                            {thumb ? <img src={proxyArtUrl(upgradeDiscogsThumb(thumb) || thumb)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="w-full h-full bg-stone-700" />}
                          </div>
                          <div className="text-stone-400 text-[9px] truncate">{stripArtistNum(artist)}</div>
                          <div className="text-stone-700 text-[8px]">{count} rec</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between">
                <div className="text-stone-500 text-xs uppercase tracking-wider">Similar Crates</div>
                <button
                  onClick={async () => {
                    setDiscoverLoading(true);
                    try {
                      const res = await fetch("/api/discover");
                      const data = await res.json();
                      setDiscoverResults(Array.isArray(data) ? data : []);
                    } catch { setDiscoverResults([]); }
                    finally { setDiscoverLoading(false); }
                  }}
                  disabled={discoverLoading}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-500 hover:text-amber-300 hover:border-amber-900/50 transition-all disabled:opacity-40"
                >
                  {discoverLoading ? "Loading…" : "↻ Refresh"}
                </button>
              </div>

              {discoverResults === null && !discoverLoading && (
                <div className="text-center py-8 text-stone-600 text-sm">Loading…</div>
              )}
              {discoverLoading && (
                <div className="text-center py-8 text-stone-600 text-sm">Finding similar crates…</div>
              )}
              {discoverResults !== null && !discoverLoading && discoverResults.length === 0 && (
                <div className="text-center py-6">
                  <div className="text-stone-600 text-sm">No other discoverable users yet</div>
                  <div className="text-stone-700 text-xs mt-1">Share your crate link to grow the community</div>
                </div>
              )}
              {discoverResults && discoverResults.length > 0 && (
                <div className="space-y-1">
                  {discoverResults.map((u) => {
                    const isSelected = selectedDiscoverUser === u.username;
                    return (
                      <div key={u.username}>
                        <button
                          onClick={async () => {
                            if (isSelected) { setSelectedDiscoverUser(null); setOverlapData(null); setShowAllSharedArtists(false); setShowAllUniqueRecords(false); return; }
                            setSelectedDiscoverUser(u.username);
                            setOverlapData(null);
                            setShowAllSharedArtists(false);
                            setShowAllUniqueRecords(false);
                            setOverlapLoading(true);
                            try {
                              const res = await fetch(`/api/discover/overlap?username=${encodeURIComponent(u.username)}`);
                              if (res.ok) setOverlapData(await res.json());
                            } catch {}
                            setOverlapLoading(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors border ${isSelected ? "bg-white/[0.06] border-white/[0.08]" : "hover:bg-white/[0.04] border-transparent hover:border-white/[0.06]"}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-stone-200 text-sm truncate">@{u.username}</div>
                            <div className="text-stone-600 text-xs mt-0.5">
                              {u.shared_artists} shared artists · {u.record_count} records
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-amber-400 text-xs font-medium">{u.similarity_pct}%</div>
                              <div className="text-stone-700 text-xs">match</div>
                            </div>
                            <div className={`text-stone-600 text-xs transition-transform ${isSelected ? "rotate-90" : ""}`}>›</div>
                          </div>
                        </button>

                        {/* Overlap panel */}
                        {isSelected && (
                          <div className="mx-2 mb-2 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                            {overlapLoading && (
                              <div className="text-stone-600 text-xs text-center py-4">Loading overlap…</div>
                            )}
                            {!overlapLoading && overlapData && (() => {
                              const artists = overlapData.sharedArtists || [];
                              const maxCount = Math.max(...artists.map(e => Math.max(e.myTitles.length, e.theirTitles.length)), 1);
                              const visibleArtists = showAllSharedArtists ? artists : artists.slice(0, 5);

                              // Compute my profile client-side (mirrors stats tab logic)
                              const myIds = new Set(myRecords.map(r => String(r.id)));
                              const spotifyData = Object.entries(spotifyFeatures).filter(([id]) => myIds.has(id)).map(([, f]) => f);
                              const featureSrc = spotifyData.length > 0 ? spotifyData : myRecords.map(r => estimateFeaturesFromRecord(r));
                              const avgF = key => featureSrc.length ? featureSrc.reduce((s, f) => s + (f[key] || 0), 0) / featureSrc.length : 0;
                              const myProfile = { energy: avgF("energy"), valence: avgF("valence"), danceability: avgF("danceability"), acousticness: avgF("acousticness"), loudness: avgF("loudness") };

                              return (
                                <>
                                  {/* Recent plays */}
                                  {overlapData.theirRecentPlays?.length > 0 && (
                                    <div className="px-3 pt-3 pb-2">
                                      <div className="text-stone-500 text-xs uppercase tracking-wider mb-2">Recently Played</div>
                                      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                                        {overlapData.theirRecentPlays.map((p, i) => (
                                          <div key={`${p.title}-${i}`} className="shrink-0 text-center" style={{ width: 56 }}>
                                            <div className="w-11 h-11 mx-auto rounded-lg overflow-hidden bg-stone-800 mb-1">
                                              {p.thumb
                                                ? <img src={p.thumb} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                : <div className="w-full h-full bg-stone-700" />}
                                            </div>
                                            <div className="text-stone-300 text-[9px] truncate">{p.title}</div>
                                            <div className="text-stone-700 text-[8px] truncate">{stripArtistNum(p.artist)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Spider chart */}
                                  {overlapData.theirProfile && (
                                    <div className="px-3 pt-3 pb-1">
                                      <div className="text-stone-500 text-xs uppercase tracking-wider mb-2">Sound Comparison</div>
                                      <RadarChart
                                        myData={myProfile}
                                        theirData={overlapData.theirProfile}
                                        myLabel="me"
                                        theirLabel={`@${u.username}`}
                                      />
                                    </div>
                                  )}

                                  {/* Shared artists bar chart */}
                                  {artists.length === 0 ? (
                                    <div className="text-stone-600 text-xs text-center py-4">No shared artists found.</div>
                                  ) : (
                                    <div className="divide-y divide-white/[0.04]">
                                      <div className="px-3 py-2 flex items-center justify-between">
                                        <span className="text-stone-500 text-xs uppercase tracking-wider">Shared Artists</span>
                                        <div className="flex items-center gap-3 text-[10px]">
                                          <span className="text-amber-700/70">me</span>
                                          <span className="text-stone-700">|</span>
                                          <span className="text-sky-700/70">@{u.username}</span>
                                          <span className="text-stone-700 ml-1">{artists.length} in common</span>
                                        </div>
                                      </div>
                                      {visibleArtists.map((entry) => (
                                        <div key={entry.artist} className="px-3 py-2.5">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            {entry.thumb && (
                                              <img src={entry.thumb} alt="" className="w-5 h-5 rounded object-cover shrink-0 opacity-70" />
                                            )}
                                            <div className="text-stone-300 text-xs font-medium truncate flex-1">{entry.artist}</div>
                                          </div>
                                          {/* Bidirectional bar */}
                                          <div className="flex items-center gap-1">
                                            {/* My side — bar grows right-to-left */}
                                            <div className="flex-1 flex items-center justify-end gap-1">
                                              <span className="text-[9px] text-amber-700/60 shrink-0 w-3 text-right">{entry.myTitles.length}</span>
                                              <div className="flex-1 flex justify-end">
                                                <div className="h-1.5 rounded-l-full bg-amber-700/50"
                                                  style={{ width: `${(entry.myTitles.length / maxCount) * 100}%`, minWidth: 3 }} />
                                              </div>
                                            </div>
                                            {/* Center divider */}
                                            <div className="w-px h-3 bg-white/15 shrink-0" />
                                            {/* Their side — bar grows left-to-right */}
                                            <div className="flex-1 flex items-center gap-1">
                                              <div className="h-1.5 rounded-r-full bg-sky-900/60"
                                                style={{ width: `${(entry.theirTitles.length / maxCount) * 100}%`, minWidth: 3 }} />
                                              <span className="text-[9px] text-sky-700/60 shrink-0 w-3">{entry.theirTitles.length}</span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      {artists.length > 5 && (
                                        <button
                                          onClick={() => setShowAllSharedArtists(s => !s)}
                                          className="w-full px-3 py-2 text-stone-600 hover:text-stone-400 text-xs text-center transition-colors"
                                        >
                                          {showAllSharedArtists ? "Show less" : `Show all ${artists.length} artists`}
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Albums you're missing — by shared artists only */}
                                  {overlapData.theirUniqueRecords?.length > 0 && (() => {
                                    const unique = overlapData.theirUniqueRecords;
                                    const visible = showAllUniqueRecords ? unique : unique.slice(0, 5);
                                    return (
                                      <div className="border-t border-white/[0.04]">
                                        <div className="px-3 py-2">
                                          <span className="text-stone-500 text-xs uppercase tracking-wider">Albums you&apos;re missing</span>
                                          <span className="text-stone-700 text-[10px] ml-2">{unique.length}</span>
                                        </div>
                                        <div className="px-3 pb-2 space-y-1">
                                          {visible.map((r, i) => (
                                            <div key={`${r.artist}-${r.title}-${i}`} className="flex items-center gap-2.5 py-1.5">
                                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-stone-800 shrink-0">
                                                {r.thumb
                                                  ? <img src={r.thumb} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                  : <div className="w-full h-full bg-stone-700" />}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="text-stone-300 text-xs truncate">{r.title}</div>
                                                <div className="text-stone-600 text-[10px] truncate">
                                                  {stripArtistNum(r.artist)}{r.year ? ` · ${r.year}` : ""}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {unique.length > 5 && (
                                          <button
                                            onClick={() => setShowAllUniqueRecords(s => !s)}
                                            className="w-full px-3 py-2 text-stone-600 hover:text-stone-400 text-xs text-center transition-colors border-t border-white/[0.04]"
                                          >
                                            {showAllUniqueRecords ? "Show less" : `Show all ${unique.length} albums`}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <div className="px-3 py-2.5 border-t border-white/[0.04] flex justify-end">
                                    <a
                                      href={`/crate/${u.username}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-stone-500 hover:text-amber-400 text-xs transition-colors"
                                    >
                                      View full crate →
                                    </a>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {selected && (
        <DetailSheet
          record={selected}
          hasNowPlaying={!!nowPlaying}
          onClose={() => setSelected(null)}
          onGenreClick={toggleGenre}
          activeGenres={activeGenres}
          onToggleForSale={toggleForSale}
          onDelete={handleDelete}
          onLogPlay={handleLogPlay}
          onEnrich={silentEnrich}
          onEnterTrail={(rec) => { enterTrail(rec); setSelected(null); }}
          onCompare={(rec) => { setCompareBase(rec); setCompareTarget(null); setSelected(null); }}
          onRecordUpdate={(patch) => {
            const updated = { ...selected, ...patch };
            setSelected(updated);
            setCollection((prev) => Array.isArray(prev) ? prev.map((r) => r.id === updated.id ? updated : r) : prev);
          }}
          playCount={playCounts[selected.id] || 0}
          playCountThisYear={playSessions.filter(s => String(s.record_id) === String(selected.id) && new Date(s.played_at).getFullYear() === new Date().getFullYear()).length}
          lastPlayedDate={lastPlayedDates[selected.id] || null}
          onSeedNext={(rec) => {
            setLastPlayed(rec);
            setTab("reco");
            setSelected(null);
            setAutoTriggerReco(true);
          }}
          spotifyFeatures={spotifyFeatures}
        />
      )}

      {/* Quick-start onboarding overlay — shows once for users with records */}
      {!seenHints["onboarding_tour"] && collection.length > 0 && !showOnboarding && tab === "crate" && (() => {
        const steps = [
          { icon: "▷", label: "Log plays", desc: "Long-press a record to log what you're spinning" },
          { icon: "✦", label: "Get picks", desc: "Today's Pick and Mood Match find your next record" },
          { icon: "◎", label: "See stats", desc: "Track your listening habits and share your taste" },
        ];
        return (
          <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => dismissHint("onboarding_tour")}
          >
            <div className="bg-stone-900 border border-stone-700/50 rounded-2xl p-6 max-w-sm w-full space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22 }} className="text-amber-50 mb-1">Welcome to CrateMate</div>
                <div className="text-stone-500 text-xs">Here's how to get started</div>
              </div>
              {steps.map(({ icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-amber-400 text-lg w-6 text-center shrink-0">{icon}</span>
                  <div>
                    <div className="text-stone-200 text-sm font-medium">{label}</div>
                    <div className="text-stone-500 text-xs">{desc}</div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => dismissHint("onboarding_tour")}
                className="w-full py-2.5 rounded-xl bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm hover:bg-amber-900/50 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        );
      })()}

      {/* Today's Pick toast — full banner, auto-minimizes after 9s */}
      {dailyPickToast && !dailyPickToastMinimized && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-full px-4 animate-[cm-toast-in_400ms_ease-out]"
          onClick={() => { setReco({ record: dailyPickToast.record, reason: dailyPickToast.reason, label: "Today's Pick" }); setDailyPickToast(null); setDailyPickToastMinimized(false); setTab("reco"); try { localStorage.setItem("cratemate_daily_toast_dismissed", new Date().toISOString().slice(0, 10)); } catch {} }}
        >
          <div className="bg-stone-900/95 backdrop-blur-md border border-amber-800/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg cursor-pointer">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-stone-800">
              {dailyPickToast.record.thumb
                ? <img src={proxyArtUrl(upgradeDiscogsThumb(dailyPickToast.record.thumb) || dailyPickToast.record.thumb)} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-stone-700" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-amber-400 text-[10px] uppercase tracking-widest">Today&apos;s Pick</div>
              <div className="text-amber-50 text-sm truncate">{dailyPickToast.record.title}</div>
            </div>
            <span className="text-stone-600 text-xs shrink-0">→</span>
          </div>
        </div>
      )}

      {showStoryPreview && storyCanvases && (
        <StoryPreviewModal
          canvases={storyCanvases}
          onClose={() => { setShowStoryPreview(false); setStoryCanvases(null); }}
        />
      )}

      {/* Compare overlay — derive records live from collection so for_sale updates reflect immediately */}
      {compareBase && (
        <CompareView
          recordA={collection?.find(r => r.id === compareBase.id) || compareBase}
          recordB={compareTarget ? (collection?.find(r => r.id === compareTarget.id) || compareTarget) : null}
          featuresA={spotifyFeatures?.[compareBase.id] || null}
          featuresB={compareTarget ? (spotifyFeatures?.[compareTarget.id] || null) : null}
          playCountA={playCounts[compareBase.id] || 0}
          playCountB={compareTarget ? (playCounts[compareTarget.id] || 0) : 0}
          lastPlayedA={lastPlayedDates[compareBase.id] || null}
          lastPlayedB={compareTarget ? (lastPlayedDates[compareTarget.id] || null) : null}
          collection={myRecords}
          onToggleForSale={toggleForSale}
          onOpenRecord={(rec, isPick) => {
            if (isPick) {
              // User selected record B from the picker
              setCompareTarget(rec);
            } else {
              // Tap on a record card → open its detail sheet
              setCompareBase(null);
              setCompareTarget(null);
              setSelected(rec);
            }
          }}
          onClose={() => { setCompareBase(null); setCompareTarget(null); }}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" onClick={() => setShowSettings(false)}>
          <div
            className="w-full max-w-md mx-auto rounded-t-3xl border border-stone-800/60 pt-5 px-5 overflow-y-auto"
            style={{ background: "var(--bg-surface, #0c0b09)", maxHeight: "80vh", paddingBottom: 40 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22 }} className="text-amber-50">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-stone-600 hover:text-stone-400 text-xl leading-none">×</button>
            </div>
            <div className="flex items-center justify-between py-3.5 border-b border-stone-800/40">
              <div>
                <div className="text-stone-200 text-sm">Hide for-sale records</div>
                <div className="text-stone-600 text-xs mt-0.5">Removes them from all views, including the list</div>
              </div>
              <button
                onClick={() => setHideForSale(v => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-4 ${hideForSale ? "bg-amber-600" : "bg-stone-700"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${hideForSale ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Location setting */}
            <div className="py-3.5 border-b border-stone-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-stone-200 text-sm">📍 Location</div>
                  <div className="text-stone-600 text-xs mt-0.5">
                    {userLocation?.city_name || "Not set — used for weather recommendations"}
                  </div>
                </div>
                <button
                  onClick={() => setCitySearch(s => ({ ...s, open: !s.open, query: "" }))}
                  className="text-amber-500 text-xs hover:text-amber-400 transition-colors shrink-0 ml-4"
                >
                  {userLocation?.city_name ? "Change" : "Set"}
                </button>
              </div>
              {citySearch.open && (
                <div className="mt-3">
                  <input
                    autoFocus
                    type="text"
                    value={citySearch.query}
                    onChange={e => handleCitySearchInput(e.target.value)}
                    placeholder="Search city..."
                    className="w-full bg-stone-900 border border-stone-700/60 rounded-xl px-3 py-2 text-stone-200 text-sm placeholder-stone-600 outline-none focus:border-amber-700/60"
                  />
                  {citySearch.loading && (
                    <div className="text-stone-600 text-xs mt-2 px-1">Searching...</div>
                  )}
                  {citySearch.results.length > 0 && (
                    <div className="mt-1 rounded-xl border border-stone-800/60 overflow-hidden">
                      {citySearch.results.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => handleCitySelect(r)}
                          className="w-full text-left px-3 py-2.5 text-stone-300 text-sm hover:bg-stone-800/60 transition-colors border-b border-stone-800/40 last:border-0"
                        >
                          <span>{r.name}</span>
                          <span className="text-stone-600 text-xs ml-2">{[r.admin1, r.country].filter(Boolean).join(", ")}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {todayWeather && userLocation?.city_name && !citySearch.open && (
                <div className="mt-1.5 text-stone-600 text-xs">
                  Now: {todayWeather.label} · {todayWeather.temperature_c}°C
                </div>
              )}
            </div>

            {/* Export data */}
            <div className="mt-6 pt-4 border-t border-stone-800/40">
              <div className="text-stone-700 text-[10px] uppercase tracking-widest mb-3">Your Data</div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const headers = ["Title","Artist","Year","Genre","Label","Discogs ID"];
                    const rows = myRecords.map(r => [
                      r.title || "", stripArtistNum(r.artist || ""), r.year_original || r.year_pressed || "",
                      r.genre || "", r.label || "", r.discogs_id || "",
                    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
                    const csv = [headers.join(","), ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                    a.download = "cratemate-collection.csv"; a.click(); URL.revokeObjectURL(a.href);
                  }}
                  className="flex-1 py-2 rounded-xl border border-stone-800/60 text-stone-400 text-xs hover:text-amber-300 hover:border-amber-900/50 transition-colors"
                >
                  Export collection
                </button>
                <button
                  onClick={() => {
                    const headers = ["Title","Artist","Played At"];
                    const rows = playSessions.map(s => {
                      const rec = (collection || []).find(r => String(r.id) === String(s.record_id));
                      return [rec?.title || "", stripArtistNum(rec?.artist || ""), s.played_at || ""]
                        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
                    });
                    const csv = [headers.join(","), ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                    a.download = "cratemate-plays.csv"; a.click(); URL.revokeObjectURL(a.href);
                  }}
                  className="flex-1 py-2 rounded-xl border border-stone-800/60 text-stone-400 text-xs hover:text-amber-300 hover:border-amber-900/50 transition-colors"
                >
                  Export plays
                </button>
              </div>
            </div>

            {/* Developer tools */}
            <div className="mt-6 pt-4 border-t border-stone-800/40">
              <div className="text-stone-700 text-[10px] uppercase tracking-widest mb-3">Developer</div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-stone-400 text-sm">Simulate free user</div>
                  <div className="text-stone-600 text-xs mt-0.5">Forces Last.fm Play Next instead of Spotify 3-way trail</div>
                </div>
                <button
                  onClick={() => {
                    const next = !devSimulateFree;
                    setDevSimulateFree(next);
                    try { localStorage.setItem("cratemate_dev_simulate_free", next ? "1" : "0"); } catch {}
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-4 ${devSimulateFree ? "bg-amber-600" : "bg-stone-700"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${devSimulateFree ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && <AddRecordModal onClose={() => setShowAddModal(false)} onAdd={(r) => setCollection((p) => [...(p || []), r])} />}

      {/* Undo toast — appears for 4s after logging a play */}
      {undoPending && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[200] shadow-2xl" style={{ minWidth: 260, bottom: nowPlaying ? 92 : 80 }}>
          <div className="bg-stone-950 border border-stone-700/60 rounded-2xl px-4 py-3 backdrop-blur-sm flex items-center gap-3">
            <span className="text-emerald-400 text-sm">✓</span>
            <span className="text-stone-300 text-sm truncate flex-1">Logged — {undoPending.record.title}</span>
            <button onClick={handleUndo} className="text-amber-400 text-xs hover:text-amber-300 shrink-0 transition-colors">Undo</button>
          </div>
        </div>
      )}

      {/* SW update banner */}
      {showUpdateBanner && (
        <div className="fixed top-0 left-0 right-0 z-[300] flex justify-center px-4 pt-3 pointer-events-none">
          <div className="flex items-center gap-3 bg-stone-900 border border-stone-700/60 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-sm pointer-events-auto max-w-sm w-full">
            <span className="text-amber-400 text-sm shrink-0">↑</span>
            <span className="text-stone-300 text-sm flex-1">New version available</span>
            <button
              onClick={() => window.location.reload()}
              className="text-amber-400 text-xs hover:text-amber-300 transition-colors shrink-0 font-medium"
            >Update</button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="text-stone-600 hover:text-stone-400 text-base leading-none shrink-0 transition-colors"
            >×</button>
          </div>
        </div>
      )}

      {/* Preview backdrop — dismisses direction preview on outside tap */}
      {bannerPreviewDirection && (
        <div className="fixed inset-0 z-[185]" onClick={() => setBannerPreviewDirection(null)} />
      )}

      {/* Session toast — add to session or start fresh when logging while trail active */}
      {sessionToast && (
        <div className="fixed top-0 left-0 right-0 z-[500] flex justify-center">
          <div className="bg-stone-900/98 border border-stone-700/60 rounded-2xl mx-4 mt-3 px-3 py-2.5 flex items-center gap-2.5 max-w-sm w-full shadow-xl backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-stone-800">
              {sessionToast.record?.thumb
                ? <img src={proxyArtUrl(upgradeDiscogsThumb(sessionToast.record.thumb) || sessionToast.record.thumb)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : <div className="w-full h-full bg-stone-700" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-amber-50 text-xs font-medium truncate">{sessionToast.record?.title || "This record"}</div>
              <div className="text-stone-500 text-[10px]">Add to your session?</div>
            </div>
            <button
              onClick={() => {
                navigateTrail(sessionToast.record);
                setTrailAlreadyLoggedIds(prev => new Set([...prev, String(sessionToast.recordId)]));
                if (sessionToastTimerRef.current) clearTimeout(sessionToastTimerRef.current);
                setSessionToast(null);
              }}
              className="text-amber-400 text-xs font-medium shrink-0 px-2 py-1 rounded-lg hover:bg-amber-900/30 transition-colors"
            >Add</button>
            <button
              onClick={() => {
                enterTrail(sessionToast.record, true);
                if (sessionToastTimerRef.current) clearTimeout(sessionToastTimerRef.current);
                setSessionToast(null);
              }}
              className="text-stone-400 text-xs shrink-0 px-2 py-1 rounded-lg hover:bg-stone-800/50 transition-colors"
            >Start fresh</button>
            <button
              onClick={() => { if (sessionToastTimerRef.current) clearTimeout(sessionToastTimerRef.current); setSessionToast(null); }}
              className="text-stone-600 hover:text-stone-400 text-base leading-none shrink-0 transition-colors"
            >×</button>
          </div>
        </div>
      )}

      {/* Now Playing banner — sits above bottom tabs */}
      {nowPlaying && viewMode !== "drift" && (
        <div
          className="shrink-0 border-t border-stone-800/60"
          style={{ background: "var(--bg-main, #0c0b09)" }}
        >
          {(() => {
            const sessionMinimized = !!(trailCenter && !trailActive);
            const bannerRecord = sessionMinimized ? trailCenter : nowPlaying.record;
            const hasSpotifyFeatures = !devSimulateFree && Object.keys(spotifyFeatures).length > 0;
            return (
              <div className="flex items-center gap-3 px-4 py-2.5 max-w-md mx-auto">
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setSelected(bannerRecord)}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-stone-800">
                    {bannerRecord.thumb
                      ? <img src={proxyArtUrl(upgradeDiscogsThumb(bannerRecord.thumb) || bannerRecord.thumb)} alt="" className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <div className="w-full h-full bg-stone-700" />}
                  </div>
                  <div className="min-w-0">
                    <MarqueeTitle style={{ fontSize: 14, color: "#fef3c7", lineHeight: 1.3 }}>{bannerRecord.title}</MarqueeTitle>
                    <div className="text-stone-500 text-xs">
                      {sessionMinimized ? `${trailHistory.length} in session` : relativePlayTime(nowPlaying.loggedAt)}
                    </div>
                  </div>
                </div>
                {sessionMinimized ? (
                  <>
                    {trailSuggestions && !trailLoading && (
                      hasSpotifyFeatures ? (
                        <div className="relative flex items-center gap-1 shrink-0" style={{ zIndex: 1 }}>
                          {bannerPreviewDirection && (() => {
                            const prev = trailSuggestions[bannerPreviewDirection];
                            if (!prev) return null;
                            const dirColors = { windDown: "#60a5fa", liftUp: "#f87171", sideways: "#a78bfa" };
                            const color = dirColors[bannerPreviewDirection];
                            return (
                              <div
                                className="absolute bottom-full mb-2 right-0 w-48 rounded-xl border bg-stone-950/98 backdrop-blur-md p-2 flex items-center gap-2 shadow-lg pointer-events-auto"
                                style={{ borderColor: `${color}44`, zIndex: 10 }}
                              >
                                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-stone-800">
                                  {prev.record.thumb
                                    ? <img src={proxyArtUrl(upgradeDiscogsThumb(prev.record.thumb) || prev.record.thumb)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                    : <div className="w-full h-full bg-stone-700" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-stone-200 text-xs leading-tight truncate">{prev.record.title}</div>
                                  <div className="text-stone-500 text-[10px] truncate">{stripArtistNum(prev.record.artist)}</div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigateTrail(prev.record); setBannerPreviewDirection(null); }}
                                  className="text-xs font-medium shrink-0 px-1.5 py-1 rounded-lg transition-colors"
                                  style={{ color, background: `${color}22` }}
                                >→</button>
                              </div>
                            );
                          })()}
                          {[
                            { key: "windDown", color: "#60a5fa", symbol: "↓", label: "Cool off" },
                            { key: "liftUp",   color: "#f87171", symbol: "↑", label: "Turn it up" },
                            { key: "sideways", color: "#a78bfa", symbol: "↔", label: "Left turn" },
                          ].map(({ key, color, symbol, label }) => {
                            const s = trailSuggestions[key];
                            if (!s) return null;
                            return (
                              <button
                                key={key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBannerPreviewDirection(prev => prev === key ? null : key);
                                }}
                                title={label}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-all"
                                style={{
                                  background: bannerPreviewDirection === key ? `${color}44` : `${color}22`,
                                  border: `1px solid ${color}${bannerPreviewDirection === key ? "99" : "66"}`,
                                  color,
                                }}
                              >{symbol}</button>
                            );
                          })}
                        </div>
                      ) : (() => {
                        const next = lastfmNextSuggestion
                          || trailSuggestions.windDown
                          || trailSuggestions.liftUp
                          || trailSuggestions.sideways;
                        return next ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateTrail(next.record); }}
                            title={next.record.title}
                            className="px-2.5 py-1 rounded-full border border-stone-700/60 text-stone-400 text-xs hover:text-stone-300 hover:border-stone-600 transition-colors shrink-0"
                          >Next →</button>
                        ) : null;
                      })()
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setTrailActive(true); setSelected(null); }}
                      className="px-3 py-1.5 rounded-full border border-amber-700/60 text-amber-400 text-xs hover:bg-amber-900/30 transition-colors shrink-0 flex items-center gap-1"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3"><path d="M5 15l7-7 7 7"/></svg>
                      Resume
                    </button>
                  </>
                ) : (
                  <>
                    {/* Trail direction buttons — visible even without active session */}
                    {bannerSuggestions && hasSpotifyFeatures && (
                      <div className="relative flex items-center gap-1 shrink-0" style={{ zIndex: 1 }}>
                        {bannerPreviewDirection && (() => {
                          const prev = bannerSuggestions[bannerPreviewDirection];
                          if (!prev) return null;
                          const dirColors = { windDown: "#60a5fa", liftUp: "#f87171", sideways: "#a78bfa" };
                          const color = dirColors[bannerPreviewDirection];
                          return (
                            <div
                              className="absolute bottom-full mb-2 right-0 w-48 rounded-xl border bg-stone-950/98 backdrop-blur-md p-2 flex items-center gap-2 shadow-lg pointer-events-auto"
                              style={{ borderColor: `${color}44`, zIndex: 10 }}
                            >
                              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-stone-800">
                                {prev.record.thumb
                                  ? <img src={proxyArtUrl(upgradeDiscogsThumb(prev.record.thumb) || prev.record.thumb)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                  : <div className="w-full h-full bg-stone-700" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-stone-200 text-xs leading-tight truncate">{prev.record.title}</div>
                                <div className="text-stone-500 text-[10px] truncate">{stripArtistNum(prev.record.artist)}</div>
                              </div>
                              <button
                                onClick={async (e) => { e.stopPropagation(); setBannerPreviewDirection(null); await logPlay(prev.record.id); }}
                                className="text-xs font-medium shrink-0 px-1.5 py-1 rounded-lg transition-colors"
                                style={{ color, background: `${color}22` }}
                              >▶</button>
                            </div>
                          );
                        })()}
                        {[
                          { key: "windDown", color: "#60a5fa", symbol: "↓", label: "Cool off" },
                          { key: "liftUp",   color: "#f87171", symbol: "↑", label: "Turn it up" },
                          { key: "sideways", color: "#a78bfa", symbol: "↔", label: "Left turn" },
                        ].map(({ key, color, symbol, label }) => {
                          const s = bannerSuggestions[key];
                          if (!s) return null;
                          return (
                            <button
                              key={key}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBannerPreviewDirection(prev => prev === key ? null : key);
                              }}
                              title={label}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-all"
                              style={{
                                background: bannerPreviewDirection === key ? `${color}44` : `${color}22`,
                                border: `1px solid ${color}${bannerPreviewDirection === key ? "99" : "66"}`,
                                color,
                              }}
                            >{symbol}</button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); enterTrail(nowPlaying.record, true); setSelected(null); }}
                      className="px-3 py-1.5 rounded-full border border-amber-800/50 text-amber-400 text-xs hover:bg-amber-900/30 transition-colors shrink-0"
                    >▷ Session</button>
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sessionMinimized) {
                      if (trailHistory.length > 1) {
                        setTrailActive(true);
                        setTrailSavePrompt(true);
                      } else {
                        setTrailCenter(null);
                        setTrailHistory([]);
                        setTrailSuggestions(null);
                        setTrailAlreadyLoggedIds(new Set());
                        setLastfmNextSuggestion(null);
                      }
                    } else {
                      const sid = playSessions[0]?.id;
                      setDismissedSessionId(sid);
                      try { localStorage.setItem("cratemate_np_dismissed", JSON.stringify({ id: sid, ts: Date.now() })); } catch {}
                    }
                  }}
                  className="text-stone-600 hover:text-stone-400 text-lg leading-none shrink-0 transition-colors"
                >×</button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Play Trail overlay */}
      {trailActive && (
        <PlayTrailView
          centerRecord={trailCenter}
          suggestions={trailSuggestions}
          loading={trailLoading}
          error={trailError}
          history={trailHistory}
          collection={myRecords}
          searchOpen={trailSearchOpen}
          searchQuery={trailSearch}
          onNavigate={navigateTrail}
          onSearchChange={setTrailSearch}
          onToggleSearch={() => setTrailSearchOpen(o => !o)}
          onClose={handleTrailClose}
          onMinimize={minimizeTrail}
          playCounts={playCounts}
          savePrompt={trailSavePrompt}
          saving={trailSaving}
          onSaveSession={saveTrailSession}
          onDiscardSession={handleTrailDiscard}
          onRefresh={refreshTrailSuggestions}
        />
      )}

      {/* ── Bottom tab bar (static) ── */}
      {(viewMode !== "drift" || tab !== "crate") && (
        <div ref={tabRowRef} className="shrink-0 border-t border-stone-800/40" style={{ background: "var(--bg-main, #0c0b09)" }}>
          <div className="flex px-2 py-1.5">
            {[
              ["crate",    "⏺", "Crate"],
              ["history",  "▷", "Log"],
              ["reco",     "✦", "Picks"],
              ["wants",    "☆", "Wants"],
              ["stats",    "◫", "Stats"],
              ["hearts",   "♥", "Hearts"],
              ["discover", "⊕", "Discover"],
            ].map(([id, icon, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => { setTab(id); setSelected(null); }}
                  className={`flex-1 min-h-[40px] flex items-center justify-center rounded-xl text-xs font-medium transition-all ${
                    active
                      ? "bg-amber-900/25 text-amber-400 border border-amber-800/35"
                      : "text-stone-500 hover:text-stone-300"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {id === "crate"
                      ? <img src="/icon-192.png" alt="" width={11} height={11} className={`rounded-sm ${active ? "opacity-75" : "opacity-50"}`} />
                      : <span>{icon}</span>}
                    {active && <span>{label}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      )}

      {/* Bottom tab bar for drift view */}
      {viewMode === "drift" && tab === "crate" && !controlsHidden && (
        <div className="shrink-0 relative z-[60]" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="flex px-2 py-1.5">
            {[
              ["crate",    "⏺", "Crate"],
              ["history",  "▷", "Log"],
              ["reco",     "✦", "Picks"],
              ["wants",    "☆", "Wants"],
              ["stats",    "◫", "Stats"],
              ["hearts",   "♥", "Hearts"],
              ["discover", "⊕", "Discover"],
            ].map(([id, icon, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => { setTab(id); setSelected(null); }}
                  className={`flex-1 min-h-[40px] flex items-center justify-center rounded-xl text-xs font-medium transition-all ${
                    active
                      ? "bg-amber-900/25 text-amber-400 border border-amber-800/35"
                      : "text-stone-600 hover:text-stone-400"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {id === "crate"
                      ? <img src="/icon-192.png" alt="" width={11} height={11} className={`rounded-sm ${active ? "opacity-75" : "opacity-50"}`} />
                      : <span>{icon}</span>}
                    {active && <span>{label}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      )}

      {/* Background enrichment indicator — top of screen, out of the way */}
      {enrichmentProgress && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[150] pointer-events-none">
          <div className="bg-stone-950/90 border border-stone-800/60 rounded-full px-3 py-1 flex items-center gap-2 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-600/70 animate-pulse shrink-0" />
            <span className="text-stone-500 text-[10px]">
              {enrichmentProgress.type === "audio" ? "Analyzing" : "Enriching"} · {enrichmentProgress.done}/{enrichmentProgress.total}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
