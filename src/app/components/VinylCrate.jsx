"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";

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
            style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20 }}
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
                  src={r.thumb}
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

const GENRE_COLORS = [
  "bg-orange-900/40 text-orange-300 border-orange-800/40",
  "bg-red-900/40 text-red-300 border-red-800/40",
  "bg-sky-900/40 text-sky-300 border-sky-800/40",
  "bg-teal-900/40 text-teal-300 border-teal-800/40",
  "bg-yellow-900/40 text-yellow-300 border-yellow-800/40",
  "bg-purple-900/40 text-purple-300 border-purple-800/40",
  "bg-indigo-900/40 text-indigo-300 border-indigo-800/40",
  "bg-rose-900/40 text-rose-300 border-rose-800/40",
  "bg-lime-900/40 text-lime-300 border-lime-800/40",
  "bg-cyan-900/40 text-cyan-300 border-cyan-800/40",
  "bg-blue-900/40 text-blue-300 border-blue-800/40",
  "bg-pink-900/40 text-pink-300 border-pink-800/40",
  "bg-amber-900/40 text-amber-300 border-amber-800/40",
  "bg-green-900/40 text-green-300 border-green-800/40",
  "bg-emerald-900/40 text-emerald-300 border-emerald-800/40",
  "bg-violet-900/40 text-violet-300 border-violet-800/40",
];

function genreColor(genre) {
  let hash = 0;
  for (let i = 0; i < genre.length; i++) hash = (hash * 31 + genre.charCodeAt(i)) >>> 0;
  return GENRE_COLORS[hash % GENRE_COLORS.length];
}

const GENRE_SVG_PALETTE = [
  { fill: "#78350f44", stroke: "#d97706", text: "#fcd34d" },
  { fill: "#1e3a5f44", stroke: "#60a5fa", text: "#93c5fd" },
  { fill: "#14532d44", stroke: "#4ade80", text: "#86efac" },
  { fill: "#4c1d9544", stroke: "#a78bfa", text: "#c4b5fd" },
  { fill: "#7f1d1d44", stroke: "#f87171", text: "#fca5a5" },
  { fill: "#164e6344", stroke: "#22d3ee", text: "#67e8f9" },
  { fill: "#71350044", stroke: "#fb923c", text: "#fdba74" },
  { fill: "#1e1b4b44", stroke: "#818cf8", text: "#a5b4fc" },
  { fill: "#4a194244", stroke: "#e879f9", text: "#f0abfc" },
  { fill: "#134e4a44", stroke: "#2dd4bf", text: "#5eead4" },
];

function genreSvgColor(genre) {
  let hash = 0;
  for (let i = 0; i < genre.length; i++) hash = (hash * 31 + genre.charCodeAt(i)) >>> 0;
  return GENRE_SVG_PALETTE[hash % GENRE_SVG_PALETTE.length];
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
  // iTunes: upgrade to 1000px for the detail hero.
  if (/mzstatic\.com/i.test(str))
    return str.replace(/\d+x\d+bb(\.(jpe?g|png|webp))?$/i, "1000x1000bb.jpg");
  return str;
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
    let best = null, bestScore = 0;
    for (const r of results) {
      const a = (r.artistName || "").toLowerCase();
      const t = (r.collectionName || "").toLowerCase();
      const ra = (artist || "").toLowerCase().replace(/\(.*?\)/g, "").trim();
      const rt = (title || "").toLowerCase().replace(/\(.*?\)/g, "").trim();
      let score = 0;
      if (a && ra && (a.includes(ra) || ra.includes(a))) score += 2;
      if (t && rt && (t.includes(rt) || rt.includes(t))) score += 2;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    if (!best || bestScore < 4) return ""; // require both artist AND title to match
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
  // Only use iTunes for confirmed bad images (user photos) or truly missing covers.
  // Blurry-but-correct Discogs images stay as-is — wrong iTunes art is worse than low-res correct art.
  const needsITunes = isUpload || !upgraded;

  const [fallback, setFallback] = useState(() => _artCache.get(record.id) || null);

  useEffect(() => {
    if (!needsITunes) return;
    return _enqueueArt(record, (url) => { if (url) setFallback(url); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  // Prefer iTunes art (higher quality); fall back to the Discogs URL so nothing goes blank
  const src = fallback || upgraded;

  if (src) {
    return (
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden border border-white/[0.08]"
        style={{ width: size, height: size, boxShadow: "0 3px 16px rgba(0,0,0,0.55)" }}
      >
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover opacity-90"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
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
      className={`text-xs px-1.5 py-0.5 rounded-full border ${cls} whitespace-nowrap ${
        onClick ? "cursor-pointer" : ""
      } ${active ? "ring-1 ring-white/40" : ""}`}
    >
      {genre}
    </span>
  );
}

function condenseCondition(c) {
  return (c || "")
    .replace("Near Mint (NM or M-)", "NM")
    .replace("Very Good Plus (VG+)", "VG+")
    .replace("Very Good (VG)", "VG")
    .replace("Mint (M)", "M")
    .replace("Good Plus (G+)", "G+")
    .replace("Good (G)", "G");
}

function ArtistTag({ artist, discogsId }) {
  const cls = "bg-stone-800/60 text-stone-300 border-stone-700/50";
  if (discogsId) {
    return (
      <a
        href={`/artist/${discogsId}`}
        onClick={(e) => e.stopPropagation()}
        className={`text-xs px-1.5 py-0.5 rounded-full border ${cls} whitespace-nowrap hover:text-amber-300 hover:border-amber-800/50 transition-colors`}
      >
        {artist}
      </a>
    );
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${cls} whitespace-nowrap`}>
      {artist}
    </span>
  );
}

function RecordRow({ record, onClick, onGenreClick, activeGenres = new Set(), playCount, onLogPlay, onShowToast }) {
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);
  const originalYear = record.year_original || record.year_pressed;
  const pressedYear = record.year_pressed || null;
  const showPressed = originalYear && pressedYear && pressedYear !== originalYear;

  function handlePointerDown() {
    didLongPress.current = false;
    if (!onShowToast) return;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onShowToast(record); // shows action pill — user chooses log vs trail
    }, 500);
  }
  function handlePointerUp() {
    clearTimeout(longPressTimer.current);
    if (didLongPress.current) return;
    onClick(record);
  }
  function handlePointerLeave() { clearTimeout(longPressTimer.current); }
  function handleDoubleClick(e) {
    e.stopPropagation();
    if (!onShowToast) return;
    onShowToast(record);
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onDoubleClick={handleDoubleClick}
      className="flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.04] active:scale-[0.99] border border-transparent hover:border-white/[0.07]"
      style={{ touchAction: "manipulation" }}
    >
      <CoverArt record={record} size={52} />
      <div className="flex-1 min-w-0">
        <div
          className="truncate text-amber-50 leading-snug"
          style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17 }}
        >
          {record.title}
        </div>
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          <ArtistTag artist={record.artist} discogsId={record.discogs_id} />
          {record.for_sale && <span className="text-xs text-rose-400/80">FOR SALE</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
        {originalYear ? (
          <div className="text-right leading-tight">
            <div className="text-stone-500 text-xs">’{String(originalYear).slice(-2)}</div>
            {showPressed && <div className="text-stone-700 text-[11px]">press {pressedYear}</div>}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-0.5">
          {getGenres(record).map((g) => (
            <GenreTag key={g} genre={g} onClick={onGenreClick} active={activeGenres.has(g)} />
          ))}
        </div>
        {playCount > 0 && (
          <div className="text-stone-600 text-[11px]">▶ {playCount}</div>
        )}
      </div>
    </div>
  );
}

function DetailSheet({ record, onClose, onSeedNext, onGenreClick, activeGenres = new Set(), onToggleForSale, onDelete, onLogPlay, onUndoLogPlay, onRecordUpdate, playCount, lastPlayedDate }) {
  const [tracks, setTracks] = useState([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [favTracks, setFavTracks] = useState(record.favorite_tracks || []);

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
  }
  const [heroUrl, setHeroUrl] = useState("");
  const [itunesUrl, setItunesUrl] = useState("");
  const preferThumb = !!record?.thumb;

  useEffect(() => {
    setHeroUrl("");
    setItunesUrl("");
  }, [record?.id]);

  // Try iTunes for a high-res hero whenever the record lacks good art.
  useEffect(() => {
    if (!record?.artist && !record?.title) return;
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md mx-auto h-full flex flex-col">
        <div
          className="relative h-[42vh] min-h-[280px] w-full overflow-hidden"
          style={{
            backgroundImage: heroImage || "linear-gradient(160deg,#1c1610 0%,#0c0b09 100%)",
            backgroundPosition: heroIsUpgraded ? "center, center" : "center",
            backgroundSize: heroIsUpgraded ? "cover, cover" : "cover",
            backgroundRepeat: "no-repeat",
          }}
        >
          {!heroUrl && !record.thumb && (
            <div className="absolute inset-0 flex items-center justify-center">
              <VinylDisc record={record} size={140} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/70" />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 bg-black/40 text-stone-200 w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/60"
            aria-label="Close"
          >
            ×
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <div
              style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26 }}
              className="text-amber-50 font-semibold leading-tight"
            >
              {record.title}
            </div>
            <div className="text-stone-200 text-sm mt-1">
              {record.discogs_id ? (
                <a
                  href={`/artist/${record.discogs_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-amber-300 transition-colors underline-offset-2 hover:underline cursor-pointer"
                >
                  {record.artist}
                </a>
              ) : record.artist}
            </div>
          </div>
        </div>

        <div
          className="flex-1 bg-stone-950 border border-stone-800/80 rounded-t-3xl -mt-6 px-5 pt-5 pb-6 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-8 h-1 bg-white/15 rounded-full mx-auto mb-4" />
          <div className="flex flex-wrap gap-1.5 mb-4">
            {getGenres(record).map((g) => (
              <GenreTag key={g} genre={g} onClick={onGenreClick} active={activeGenres.has(g)} />
            ))}
            {record.is_compilation && (
              <span className="text-xs px-1.5 py-0.5 rounded-full border border-stone-700/50 text-stone-500">
                Compilation
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-white/[0.04] rounded-xl p-2.5">
              <div className="text-stone-600 text-xs mb-0.5">Year</div>
              <div className="text-stone-200 text-sm font-medium truncate">{originalYear || "—"}</div>
              {pressedYear && originalYear && pressedYear !== originalYear && (
                <div className="text-stone-600 text-[11px] truncate mt-0.5">Press {pressedYear}</div>
              )}
            </div>
            <div className="bg-white/[0.04] rounded-xl p-2.5">
              <div className="text-stone-600 text-xs mb-0.5">Condition</div>
              <div className="text-stone-200 text-sm font-medium truncate">{condenseCondition(record.condition) || "—"}</div>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-2.5">
              <div className="text-stone-600 text-xs mb-0.5">Label</div>
              <div className="text-stone-200 text-sm font-medium truncate">
                {(record.label || "—").split(",")[0].trim().slice(0, 16)}
              </div>
            </div>
          </div>

          {isRepress && (
            <div className="text-stone-600 text-xs text-center mb-3">
              Originally {record.year_original} · This press {record.year_pressed}
            </div>
          )}
          <div className="text-stone-600 text-xs text-center mb-4">{record.format}</div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              onClick={() => onToggleForSale?.(record)}
              className={`py-3 rounded-xl border text-sm font-medium transition-colors ${
                record.for_sale
                  ? "bg-rose-900/25 border-rose-800/40 text-rose-200 hover:bg-rose-900/35"
                  : "bg-stone-900/40 border-stone-800/60 text-stone-300 hover:border-amber-900/50 hover:text-amber-200"
              }`}
            >
              {record.for_sale ? "Remove from For Sale" : "Mark For Sale"}
            </button>
            <button
              onClick={() => {
                onSeedNext(record);
                onClose();
              }}
              className="py-3 rounded-xl bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm font-medium hover:bg-amber-900/50 transition-colors"
            >
              ▶︎ Seed &quot;Play Next&quot;
            </button>
          </div>

          <div className="mb-2">
            <StreamingButtons artist={record.artist} title={record.title} />
          </div>

          <div className="flex gap-2 mb-5">
            <button
              onClick={() => onLogPlay?.(record.id)}
              className="flex-1 py-3 rounded-xl bg-stone-900/40 border border-stone-800/60 text-stone-300 text-sm font-medium hover:border-amber-900/50 hover:text-amber-200 transition-colors flex items-center justify-between px-4"
            >
              <span>▶ Log Play</span>
              {playCount > 0 && (
                <span className="text-stone-600 text-xs">{playCount} {playCount === 1 ? "play" : "plays"}</span>
              )}
            </button>
            {playCount > 0 && (
              <button
                onClick={() => onUndoLogPlay?.(record.id)}
                className="px-3 py-3 rounded-xl border border-stone-800/60 text-stone-600 text-sm hover:border-stone-700 hover:text-stone-400 transition-colors"
                title="Undo last play"
              >
                ↩
              </button>
            )}
          </div>

          {lastPlayedDate && (
            <div className="text-stone-600 text-xs text-center mb-4">
              Last played: {(() => {
                const diff = Date.now() - new Date(lastPlayedDate).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return "just now";
                if (mins < 60) return `${mins} min ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
                const days = Math.floor(hrs / 24);
                if (days === 1) return "yesterday";
                return `${days} days ago`;
              })()}
            </div>
          )}

          <div className="mb-2 text-stone-400 text-xs uppercase tracking-widest">Tracklist</div>
          {trackLoading && <div className="text-stone-600 text-sm py-2">Loading tracklist...</div>}
          {trackError && <div className="text-red-400/70 text-sm py-2">{trackError}</div>}
          {!trackLoading && !trackError && tracks.length === 0 && (
            <div className="text-stone-600 text-sm py-2">No tracklist found.</div>
          )}
          <div className="space-y-2">
            {tracks.map((t, i) => {
              const key = t.position || String(i);
              const faved = favTracks.some((f) => (typeof f === "object" ? f.key : f) === key);
              const isHeading = t.type === "heading";
              return (
                <div key={`${t.position || "h"}-${i}`} className="flex items-start gap-3">
                  <div className="text-stone-600 text-xs w-10 shrink-0 pt-0.5">{t.position || "—"}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${isHeading ? "text-stone-300 uppercase tracking-widest text-xs" : "text-amber-50"}`}>
                      {t.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="text-stone-600 text-xs">{t.duration || ""}</span>
                    {!isHeading && (
                      <button
                        onClick={() => toggleFav(key, t.title)}
                        className={`text-sm transition-colors ${faved ? "text-rose-400" : "text-stone-700 hover:text-stone-400"}`}
                      >
                        ♥
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!record.discogs_instance_id && (
            <button
              onClick={() => {
                if (window.confirm(`Remove "${record.title}" from your crate?`)) onDelete?.(record);
              }}
              className="mt-6 w-full py-2.5 rounded-xl border border-red-900/40 text-red-400/70 text-sm hover:bg-red-900/20 hover:text-red-300 transition-colors"
            >
              Remove from crate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function HoneycombView({ records, playCounts, onSelect, zoom = 1, onLogPlay, onShowToast }) {
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
  const hexLongPressDidFire = useRef(false);

  const BASE_SIZE = Math.round(180 * zoom);
  const COL_STEP = BASE_SIZE * 0.76;
  const ROW_STEP = BASE_SIZE * 0.88;
  const CIRCLE_RADIUS = BASE_SIZE * 4.8; // controls how wide the circular grid is

  // Generate all candidate positions in a circular boundary, sorted center-outward
  const allPositions = [];
  const RANGE = 9;
  for (let col = -RANGE; col <= RANGE; col++) {
    for (let row = -RANGE; row <= RANGE; row++) {
      const px = col * COL_STEP;
      const py = row * ROW_STEP + (((col % 2) + 2) % 2 === 1 ? ROW_STEP / 2 : 0);
      const dist = Math.hypot(px, py);
      if (dist <= CIRCLE_RADIUS) {
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

  function onPointerDown(e) {
    dragging.current = true;
    moveDistance.current = 0;
    velocity.current = { x: 0, y: 0 };
    cancelAnimationFrame(rafRef.current);
    const pos = e.touches ? e.touches[0] : e;
    lastPos.current = { x: pos.clientX, y: pos.clientY };
  }

  function onPointerMove(e) {
    if (!dragging.current) return;
    const pos = e.touches ? e.touches[0] : e;
    const dx = pos.clientX - lastPos.current.x;
    const dy = pos.clientY - lastPos.current.y;
    lastPos.current = { x: pos.clientX, y: pos.clientY };
    moveDistance.current += Math.abs(dx) + Math.abs(dy);
    if (moveDistance.current > 6) { clearTimeout(hexLongPressTimer.current); }
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
    clearTimeout(hexLongPressTimer.current);
    if (moveDistance.current < 6 && record) {
      if (!hexLongPressDidFire.current) onSelect(record);
      hexLongPressDidFire.current = false;
    } else {
      startMomentum();
    }
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
              onMouseDown={(e) => {
                if (!onShowToast) return;
                hexLongPressDidFire.current = false;
                hexLongPressTimer.current = setTimeout(() => {
                  hexLongPressDidFire.current = true;
                  onShowToast(record);
                }, 500);
              }}
              onTouchStart={(e) => {
                if (!onShowToast) return;
                hexLongPressDidFire.current = false;
                hexLongPressTimer.current = setTimeout(() => {
                  hexLongPressDidFire.current = true;
                  onShowToast(record);
                }, 500);
              }}
              onMouseUp={(e) => { e.stopPropagation(); onPointerUp(e, record); }}
              onTouchEnd={(e) => { e.stopPropagation(); onPointerUp(e, record); }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: isFocused
                    ? "0 0 0 2px rgba(180,120,30,0.5), 0 8px 28px rgba(0,0,0,0.7)"
                    : "0 3px 12px rgba(0,0,0,0.5)",
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
                    <p style={{ color: "#a8a29e", fontSize: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.artist}</p>
                    {plays > 0 && <p style={{ color: "#78716c", fontSize: 7, marginTop: 1 }}>▶ {plays}</p>}
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

function RecoCard({ reco, onClose, onGenreClick, activeGenres = new Set() }) {
  if (!reco) return null;
  const { record, reason, label } = reco;
  return (
    <div className="rounded-2xl border border-stone-700/60 bg-stone-900/80 p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">{label}</span>
        <button onClick={onClose} className="text-stone-600 hover:text-stone-300 text-xl leading-none">
          ×
        </button>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <CoverArt record={record} size={70} />
        <div>
          <div
            style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 21 }}
            className="text-amber-50 font-semibold leading-tight"
          >
            {record.title}
          </div>
          <div className="text-stone-400 text-sm">{record.artist}</div>
          <div className="flex items-center gap-2 mt-1">
            {(record.year_original || record.year_pressed) && (
              <span className="text-stone-500 text-xs">{record.year_original || record.year_pressed}</span>
            )}
            {getGenres(record).map((g) => (
              <GenreTag key={g} genre={g} onClick={onGenreClick} active={activeGenres.has(g)} />
            ))}
          </div>
        </div>
      </div>
      {reason && (
        <div className="border-t border-white/[0.06] pt-3 text-stone-300 text-sm leading-relaxed italic">{reason}</div>
      )}
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
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-stone-700/60 text-stone-400 hover:bg-white hover:text-stone-900 hover:border-white/80 transition-colors"
          >
            {icon}
            <span className="text-[10px]">{name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function buildTodayHook(myRecords, lastPlayedDates, playCounts) {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay   = today.getDate();
  const STALE_DAYS = 90;
  const now = Date.now();

  // Priority 1: Release anniversaries (date-specific — always feels intentional)
  const anniversaryCandidates = myRecords.filter(
    (r) => r.release_month === todayMonth && r.release_day === todayDay
  );
  if (anniversaryCandidates.length > 0) {
    const pick = anniversaryCandidates[Math.floor(Math.random() * anniversaryCandidates.length)];
    const releaseYear = pick.year_original || pick.year_pressed;
    const years = releaseYear ? today.getFullYear() - releaseYear : null;
    return {
      type: "anniversary",
      record: pick,
      fact: years
        ? `"${pick.title}" by ${pick.artist} was released exactly ${years} year${years === 1 ? "" : "s"} ago today.`
        : `"${pick.title}" by ${pick.artist} was released on this date.`,
    };
  }

  // Priority 2a: Artist born today
  const birthdayCandidates = myRecords.filter(
    (r) => !r.is_compilation && r.artist_birth_month === todayMonth && r.artist_birth_day === todayDay
  );
  if (birthdayCandidates.length > 0) {
    const pick = birthdayCandidates[Math.floor(Math.random() * birthdayCandidates.length)];
    const years = pick.artist_birth_year ? today.getFullYear() - pick.artist_birth_year : null;
    return {
      type: "birthday",
      record: pick,
      fact: years
        ? `${pick.artist} was born ${years} years ago today in ${pick.artist_birth_year}.`
        : `${pick.artist} was born on this day.`,
    };
  }

  // Priority 2b: Artist died today
  const deathCandidates = myRecords.filter(
    (r) => !r.is_compilation && r.artist_death_month === todayMonth && r.artist_death_day === todayDay
  );
  if (deathCandidates.length > 0) {
    const pick = deathCandidates[Math.floor(Math.random() * deathCandidates.length)];
    const years = pick.artist_death_year ? today.getFullYear() - pick.artist_death_year : null;
    return {
      type: "death",
      record: pick,
      fact: years
        ? `${pick.artist} passed away ${years} years ago today in ${pick.artist_death_year}.`
        : `${pick.artist} passed away on this day.`,
    };
  }

  // Priority 3: Beloved-but-forgotten
  // Only records played before — ranked by play count so high-love records surface first.
  // Picks randomly from the top 10 by play count among stale candidates.
  const staleCandidates = myRecords
    .filter((r) => {
      const last = lastPlayedDates[r.id];
      if (!last) return false; // never played → not "stale", just unplayed
      const daysSince = (now - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= STALE_DAYS;
    })
    .sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0)); // most-played first

  if (staleCandidates.length > 0) {
    // Pick randomly from top 10 by play count — introduces variety across taps
    const pool = staleCandidates.slice(0, 10);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const daysSince = Math.floor((now - new Date(lastPlayedDates[pick.id]).getTime()) / (1000 * 60 * 60 * 24));
    const plays = playCounts[pick.id] || 0;
    return {
      type: "stale",
      record: pick,
      fact: plays > 1
        ? `You've played "${pick.title}" by ${pick.artist} ${plays} times, but not in ${daysSince} days.`
        : `You haven't played "${pick.title}" by ${pick.artist} in ${daysSince} days.`,
    };
  }

  // Priority 4: Never-played records — something in the crate that hasn't had a spin yet.
  // Shuffle so it doesn't always surface the same record.
  const neverPlayed = myRecords.filter((r) => !lastPlayedDates[r.id]);
  if (neverPlayed.length > 0) {
    const shuffled = [...neverPlayed].sort(() => Math.random() - 0.5);
    const pick = shuffled[0];
    return {
      type: "unplayed",
      record: pick,
      fact: `"${pick.title}" by ${pick.artist} is sitting in your crate and you've never played it.`,
    };
  }

  return null; // → smart fallback
}

function PlayTrailView({ centerRecord, suggestions, loading, error, history, collection, searchOpen, searchQuery, onNavigate, onSearchChange, onToggleSearch, onClose, playCounts }) {
  const CENTER = 140;
  const SLOT = 100;
  const GAP = 18;

  const directions = [
    { key: "windDown", label: "wind down", offsetX: -(SLOT + GAP), offsetY: (CENTER - SLOT) / 2, color: "#60a5fa" },
    { key: "liftUp",  label: "lift up",   offsetX: CENTER + GAP,    offsetY: (CENTER - SLOT) / 2, color: "#f87171" },
    { key: "sideways",label: "detour",    offsetX: (CENTER - SLOT) / 2, offsetY: -(SLOT + GAP),  color: "#a78bfa" },
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
        <span className="text-stone-600 text-xs uppercase tracking-widest">Listening Trail</span>
        <div className="w-12" />
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
                <p style={{ color: "#a8a29e", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{centerRecord.artist}</p>
              </div>
            </div>

            {/* Directional slots */}
            {directions.map(({ key, label, offsetX, offsetY, color }) => {
              const rec = suggestions?.[key];
              const isLoading = loading && !suggestions;
              return (
                <div
                  key={key}
                  style={{ position: "absolute", left: offsetX, top: offsetY, width: SLOT, height: SLOT }}
                >
                  {/* Direction label */}
                  <div style={{
                    position: "absolute",
                    fontSize: 9,
                    color: color,
                    opacity: 0.7,
                    whiteSpace: "nowrap",
                    ...(key === "windDown" ? { right: "calc(100% + 4px)", top: "50%", transform: "translateY(-50%)" } : {}),
                    ...(key === "liftUp"   ? { left:  "calc(100% + 4px)", top: "50%", transform: "translateY(-50%)" } : {}),
                    ...(key === "sideways" ? { bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)" } : {}),
                  }}>
                    {label}
                  </div>

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
                        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)",
                        display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 5,
                      }}>
                        <p style={{ color: "#fef3c7", fontSize: 8, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</p>
                        <p style={{ color: "#a8a29e", fontSize: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.artist}</p>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-xl w-full h-full flex items-center justify-center" style={{ background: "#1c1917", border: "1px dashed #3c3532" }}>
                      <span className="text-stone-700 text-xs">?</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* DOWN slot — custom pick */}
            <div style={{ position: "absolute", left: (CENTER - SLOT) / 2, top: CENTER + GAP, width: SLOT }}>
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#78716c", whiteSpace: "nowrap" }}>
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
                          <div className="text-stone-600 text-[10px] truncate">{r.artist}</div>
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

function GenreBubbleMapInner({ items, styleItems, onBubbleClick, onStyleClick, fullscreen = false }) {
  const [containerWidth, setContainerWidth] = useState(fullscreen ? window.innerWidth : 320);
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

  // When a genre is expanded, position it at SVG center for maximum orbit room
  const cx = width / 2;
  const cy = height / 2;

  function renderBubbles() {
    return placed.map(b => {
      const { fill, stroke, text } = genreSvgColor(b.label);
      const isExpanded = expandedGenre === b.label;
      const isHidden = expandedGenre !== null && !isExpanded;
      const styleList = styleItems?.[b.label] || [];

      // In expanded mode the genre moves to center
      const bx = isExpanded ? cx : b.cx;
      const by = isExpanded ? cy : b.cy;
      const br = isExpanded ? (fullscreen ? b.r * 1.4 : b.r * 1.2) : b.r;
      const showLabel = br >= 22;
      const showCount = br >= 18;

      // Orbit radius scales with available space
      const orbitR = br + (fullscreen ? 60 : 36);
      const maxSCount = Math.max(...styleList.map(x => x.count), 1);

      return (
        <g key={b.label} style={{ transition: "opacity 0.25s", opacity: isHidden ? 0 : 1, pointerEvents: isHidden ? "none" : "auto" }}>
          {/* Style sub-bubbles orbit center when expanded */}
          {isExpanded && styleList.map((s, idx) => {
            const angle = (idx / Math.max(styleList.length, 1)) * Math.PI * 2 - Math.PI / 2;
            const scx = bx + orbitR * Math.cos(angle);
            const scy = by + orbitR * Math.sin(angle);
            const sr = (fullscreen ? 14 : 9) + (fullscreen ? 18 : 12) * Math.sqrt(s.count / maxSCount);
            const { fill: sf, stroke: ss, text: st } = genreSvgColor(s.label);
            return (
              <g key={s.label} onClick={(e) => { e.stopPropagation(); onStyleClick?.(s.label, expandedGenre); }} style={{ cursor: "pointer" }}>
                <circle cx={scx} cy={scy} r={sr} fill={sf} stroke={ss} strokeWidth={1} opacity={0.9} />
                <text x={scx} y={scy} textAnchor="middle" dominantBaseline="middle"
                  fill={st} fontSize={Math.max(8, sr * 0.38)}
                  style={{ pointerEvents: "none", userSelect: "none" }}>
                  {s.label.length > 10 ? s.label.slice(0, 9) + "…" : s.label}
                </text>
              </g>
            );
          })}
          {/* Main genre bubble */}
          <g
            onClick={(e) => {
              e.stopPropagation();
              if (isExpanded) { onBubbleClick(b.label); setExpandedGenre(null); }
              else setExpandedGenre(b.label);
            }}
            style={{ cursor: "pointer", transition: "transform 0.25s" }}
          >
            <circle cx={bx} cy={by} r={br} fill={fill} stroke={isExpanded ? "#fbbf24" : stroke} strokeWidth={isExpanded ? 2.5 : 1.5} />
            {showLabel && (
              <text x={bx} y={by - (showCount ? 7 : 0)} textAnchor="middle"
                dominantBaseline="middle" fill={text} fontSize={Math.max(9, br * 0.32)}
                style={{ pointerEvents: "none", userSelect: "none" }}>
                {b.label.length > 12 ? b.label.slice(0, 11) + "…" : b.label}
              </text>
            )}
            {showCount && (
              <text x={bx} y={by + (showLabel ? 11 : 0)} textAnchor="middle"
                dominantBaseline="middle" fill={text} fontSize={Math.max(8, br * 0.26)}
                opacity={0.7} style={{ pointerEvents: "none", userSelect: "none" }}>
                {b.count}
              </text>
            )}
          </g>
        </g>
      );
    });
  }

  return (
    <div ref={ref} className="w-full h-full relative">
      <svg width={width} height={height} onClick={() => setExpandedGenre(null)} style={{ display: "block" }}>
        {renderBubbles()}
      </svg>
      {expandedGenre && (
        <div className="text-center text-stone-600 text-xs mt-1 absolute bottom-0 w-full">
          Tap genre again to filter · tap a style to drill in
        </div>
      )}
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

export default function VinylCrate() {
  const { user } = useUser();
  const [collection, setCollection] = useState(null);
  const [collectionError, setCollectionError] = useState("");
  const [tab, setTab] = useState("crate");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("artist");
  const [showForSale, setShowForSale] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [reco, setReco] = useState(null);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoError, setRecoError] = useState("");
  const [mood, setMood] = useState("");
  const [activeGenres, setActiveGenres] = useState(new Set());
  const toggleGenre = (g) =>
    setActiveGenres((prev) => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });
  const [activeStyles, setActiveStyles] = useState(new Set());
  const toggleStyle = (s) =>
    setActiveStyles((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const [bubbleView, setBubbleView] = useState("genres");

  const [playCounts, setPlayCounts] = useState({});
  const [lastPlayedDates, setLastPlayedDates] = useState({});
  const [playSessions, setPlaySessions] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [honeycombSort, setHoneycombSort] = useState("year");
  const [honeycombZoom, setHoneycombZoom] = useState(1.0);
  const [activeDecade, setActiveDecade] = useState(new Set());
  const [activeFormat, setActiveFormat] = useState(null);
  const [statFilterLabel, setStatFilterLabel] = useState(null);
  const [previousTab, setPreviousTab] = useState(null);

  const [shareCopied, setShareCopied] = useState(false);
  const [favTitles, setFavTitles] = useState({});
  const [page, setPage] = useState(1);
  const [infiniteScroll, setInfiniteScroll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(25);
  const PAGE_SIZE = 25;
  const sentinelRef = useRef(null);

  // Long-press action pill (replaces old playToast)
  const [actionPill, setActionPill] = useState(null); // { record }
  const actionPillTimer = useRef(null);

  // Play Trail
  const [trailActive, setTrailActive] = useState(false);
  const [trailCenter, setTrailCenter] = useState(null);
  const [trailHistory, setTrailHistory] = useState([]);
  const [trailSuggestions, setTrailSuggestions] = useState(null); // { windDown, liftUp, sideways } each { record, score }
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState("");
  const [trailSearchOpen, setTrailSearchOpen] = useState(false);
  const [trailSearch, setTrailSearch] = useState("");
  const [spotifyFeatures, setSpotifyFeatures] = useState({}); // { [record_id]: features }

  // legacy playToast kept as null so nothing breaks — pill replaces it
  const [playToast] = useState(null);
  const playToastTimer = useRef(null);

  const [expandedHearts, setExpandedHearts] = useState(new Set());
  const [heartsPage, setHeartsPage] = useState(1);
  const [heartsInfiniteScroll, setHeartsInfiniteScroll] = useState(false);
  const [heartsVisible, setHeartsVisible] = useState(20);
  const HEARTS_PAGE_SIZE = 20;
  const heartsSentinelRef = useRef(null);

  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [discoverResults, setDiscoverResults] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const [discogsConnected, setDiscogsConnected] = useState(false);
  const [discogsUsername, setDiscogsUsername] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);

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
    fetch("/api/discogs/status")
      .then((r) => r.json())
      .then((d) => {
        setDiscogsConnected(d.connected);
        setDiscogsUsername(d.username);
        setIsDiscoverable(d.is_discoverable ?? false);
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
          setIsDiscoverable(d.is_discoverable ?? false);
        })
        .catch(() => {});
    }
  }, []);

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

  function showActionPill(record) {
    clearTimeout(actionPillTimer.current);
    setActionPill({ record });
    actionPillTimer.current = setTimeout(() => setActionPill(null), 4000);
  }

  // kept for backwards compat signature — RecordRow/HoneycombView call onShowToast(record)
  const showPlayToast = showActionPill;

  useEffect(() => {
    refreshRecords();
    loadPlays();
  }, [refreshRecords]);

  useEffect(() => {
    if (tab !== "hearts") return;
    const favRecords = myRecords.filter(r => (r.favorite_tracks || []).length > 0 && r.discogs_id);
    for (const r of favRecords) {
      if (favTitles[r.id]) continue;
      const needsResolve = (r.favorite_tracks || []).some(f => typeof f !== "object");
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

  useEffect(() => { setPage(1); setVisibleCount(PAGE_SIZE); }, [search, sortBy, activeGenres, activeDecade, activeFormat, showForSale]);

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

  const myRecords = Array.isArray(collection) ? collection.filter((r) => !r.for_sale) : [];
  const forSaleRecords = Array.isArray(collection) ? collection.filter((r) => r.for_sale) : [];
  const pool = showForSale ? forSaleRecords : myRecords;

  const sorted = [...pool].sort((a, b) => {
    if (sortBy === "year") return (a.year_original || a.year_pressed || 9999) - (b.year_original || b.year_pressed || 9999);
    if (sortBy === "genre") return (a.genres || a.genre || "").localeCompare(b.genres || b.genre || "");
    return (a.artist || "").localeCompare(b.artist || "");
  });

  const filtered = sorted.filter((r) => {
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
    return matchesSearch && matchesGenre && matchesStyle && matchesDecade && matchesFormat;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRecords = infiniteScroll
    ? filtered.slice(0, visibleCount)
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasMore = infiniteScroll && visibleCount < filtered.length;

  const honeycombRecords = (() => {
    if (honeycombSort === "year") {
      return [...filtered].sort((a, b) =>
        (a.year_original || a.year_pressed || 9999) - (b.year_original || b.year_pressed || 9999)
      );
    }
    if (honeycombSort === "az") {
      return [...filtered].sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
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

  const getReco = useCallback(
    async (type) => {
      setRecoLoading(true);
      setRecoError("");
      setReco(null);
      try {
        const today = new Date();
        const month = today.toLocaleString("default", { month: "long" });
        const day = today.getDate();
        let ctx = "";
        let fallbackPool = myRecords;

        if (type === "daily") {
          const hook = buildTodayHook(myRecords, lastPlayedDates, playCounts);
          if (hook) {
            const SYSTEM = "You are a passionate music obsessive recommending records from a friend's personal collection. Be warm and specific — speak to the music, not the calendar. Avoid filler slang like dude, man, or bro. Return valid JSON only — no markdown, no prose outside the JSON.";
            const text = await callClaude(
              [{
                role: "user",
                content: `Here's a fun fact about a record in my collection:\n\n${hook.fact}\n\nThe record: "${hook.record.title}" by ${hook.record.artist} (${hook.record.year_original || hook.record.year_pressed || "?"}, ${(() => { const g = hook.record.genres || hook.record.genre || ""; const s = hook.record.styles || ""; return s ? `${g}/${s}` : g; })()}).\n\nWrite 1-2 casual conversational sentences that surface this fact and make me want to pull it out right now.\n\nRespond ONLY with JSON: {"reason":"..."}`,
              }],
              120,
              SYSTEM
            );
            const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
            let parsed;
            try { parsed = JSON.parse(stripped); } catch {
              const m = stripped.match(/\{[\s\S]*\}/);
              if (!m) throw new Error("no-json");
              try { parsed = JSON.parse(m[0]); } catch { throw new Error("no-json"); }
            }
            if (Array.isArray(parsed)) parsed = parsed[0];
            if (!parsed || typeof parsed.reason !== "string") throw new Error("bad-schema");
            setReco({ record: hook.record, reason: parsed.reason, label: "Today's Pick" });
            return;
          }

          // No hook fired — smart fallback: exclude recently played, cap at 60 records
          const recentIds = new Set(
            Object.entries(lastPlayedDates)
              .filter(([, d]) => (Date.now() - new Date(d).getTime()) < 7 * 86400000)
              .map(([id]) => parseInt(id))
          );
          fallbackPool = myRecords.filter((r) => !recentIds.has(r.id));
          ctx = `Pick the record from this collection that most deserves a spin right now. Reason from the music itself — the artist, era, sound — not from the time of year.`;
        } else if (type === "random") {
          ctx = "Pick one completely random record. Surprise me.";
        } else if (type === "mood") {
          ctx = `Pick the single best record for this mood: "${mood}"`;
        } else {
          const lpGenreStr = lastPlayed?.genres || lastPlayed?.genre || "";
          const lpStyleStr = lastPlayed?.styles || "";
          const lpDescriptor = lpStyleStr ? `${lpGenreStr}/${lpStyleStr}` : lpGenreStr;
          ctx = `I just listened to "${lastPlayed?.title}" by ${lastPlayed?.artist} (${lastPlayed?.year_original || lastPlayed?.year_pressed}, ${lpDescriptor}). Pick the ideal next record.`;
        }

        // Re-index to sequential 1-based IDs — prevents Claude from hallucinating a real DB ID.
        const dailyPool = (type === "daily") ? fallbackPool : myRecords;
        const sample = dailyPool.length > 60
          ? [...dailyPool].sort(() => Math.random() - 0.5).slice(0, 60)
          : dailyPool;
        const indexMap = new Map();
        const list = sample
          .map((r, i) => {
            indexMap.set(i + 1, r);
            const genreStr = r.genres || r.genre || "";
            const styleStr = r.styles || "";
            const descriptor = styleStr ? `${genreStr}/${styleStr}` : genreStr;
            return `id:${i + 1}|"${r.title}"|${r.artist}|${r.year_original || r.year_pressed || "?"}|${descriptor}${r.is_compilation ? " (comp)" : ""}`;
          })
          .join("\n");

        const SYSTEM = "You are a passionate music obsessive recommending records from a friend's personal collection. Be warm and specific — speak to the music, not the calendar. Avoid filler slang like dude, man, or bro. Return valid JSON only — no markdown, no prose outside the JSON.";
        const text = await callClaude(
          [
            {
              role: "user",
              content: `${ctx}\n\nCollection:\n${list}\n\nRespond ONLY with JSON: {"id":<number>,"reason":"<1-2 casual conversational sentences — why this record, why now>"}`,
            },
          ],
          120,
          SYSTEM
        );
        const parsed = extractJson(text);
        const found = indexMap.get(parsed.id);
        if (!found) throw new Error("not-found");
        setReco({
          record: found,
          reason: parsed.reason,
          label: { random: "Random Pick", daily: "Today's Pick", mood: "Mood Match", next: "Play Next" }[type],
        });
      } catch (err) {
        if (err.message === "not-found") setRecoError("Claude picked a record that isn't in your crate — try again.");
        else if (err.message === "no-json" || err.message === "bad-schema") setRecoError("Got an unexpected response — try again.");
        else setRecoError("Couldn't reach the AI — check your connection and try again.");
      } finally {
        setRecoLoading(false);
      }
    },
    [myRecords, mood, lastPlayed, lastPlayedDates, playCounts]
  );

  async function handleDiscogsImport() {
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/discogs/import", { method: "POST" });
      const data = await readJsonOrText(res);
      if (!res.ok) throw new Error(data?.error || `Import failed (${res.status})`);
      setImportResult({ ...data, syncing_meta: true });
      await refreshRecords();

      // After a sync, run metadata enrich — failures here don't undo the import success.
      setEnrichLoading(true);
      try {
        const meta = await runEnrichAll("full");
        setImportResult({ ...data, meta });
      } catch (enrichErr) {
        // Import succeeded; enrichment failed. Show import counts without meta stats.
        console.error("Post-import enrich failed:", enrichErr);
        setImportResult({ ...data });
      }
      await refreshRecords();
    } catch (e) {
      setImportResult({ error: e instanceof Error ? e.message : "Discogs import failed." });
    } finally {
      setImportLoading(false);
      setEnrichLoading(false);
    }
  }

  async function runEnrichAll(mode) {
    // Start both jobs simultaneously — release metadata (Discogs) and artist dates (MusicBrainz)
    // are independent so they can run in parallel.
    const [metaRes, artistRes] = await Promise.all([
      fetch(`/api/discogs/enrich/job?mode=${encodeURIComponent(mode)}`, { method: "POST" }),
      fetch("/api/discogs/enrich/artist/job", { method: "POST" }),
    ]);
    const metaData = await readJsonOrText(metaRes);
    const artistData = await readJsonOrText(artistRes);
    if (!metaRes.ok) throw new Error(metaData?.error || `Metadata sync failed (${metaRes.status})`);
    if (!artistRes.ok) throw new Error(artistData?.error || `Artist sync failed (${artistRes.status})`);

    const metaJobId = metaData.job_id;
    const artistJobId = artistData.job_id;
    if (!metaJobId) throw new Error("Missing metadata job id");
    if (!artistJobId) throw new Error("Missing artist job id");

    // Poll both jobs in one loop until both are done
    let metaDone = false, artistDone = false;
    let metaLatest = metaData, artistLatest = artistData;
    while (!metaDone || !artistDone) {
      await new Promise((r) => setTimeout(r, 600));
      if (!metaDone) {
        const res = await fetch(`/api/discogs/enrich/job/${encodeURIComponent(metaJobId)}`);
        const data = await readJsonOrText(res);
        if (res.ok) metaLatest = data;
        if (data?.status === "completed" || data?.status === "failed") metaDone = true;
      }
      if (!artistDone) {
        const res = await fetch(`/api/discogs/enrich/job/${encodeURIComponent(artistJobId)}`);
        const data = await readJsonOrText(res);
        if (res.ok) artistLatest = data;
        if (data?.status === "completed" || data?.status === "failed") artistDone = true;
      }
    }

    if (metaLatest.status === "failed") throw new Error(metaLatest.error || "Metadata job failed");

    return {
      updated: (metaLatest.updated || 0) + (artistLatest.updated || 0),
      considered: metaLatest.considered || 0,
      warning: metaLatest.warning || "",
    };
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
  function clearStatFilter() {
    setActiveDecade(new Set()); setActiveFormat(null); setActiveGenres(new Set()); setActiveStyles(new Set()); setStatFilterLabel(null);
    setPreviousTab(null);
  }

  // ── Play Trail ──────────────────────────────────────────────────────────────

  async function loadSpotifyFeatures() {
    try {
      const res = await fetch("/api/spotify/features");
      if (res.ok) setSpotifyFeatures(await res.json());
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
      const f = await res.json();
      if (f) setSpotifyFeatures(prev => ({ ...prev, [record.id]: f }));
      return f;
    } catch { return null; }
  }

  function computeTrailSuggestions(centerRecord, features) {
    const cf = features[centerRecord.id];
    const candidates = myRecords.filter(r => r.id !== centerRecord.id);

    function score(r, direction) {
      const rf = features[r.id];
      if (cf && rf) {
        const eDiff = rf.energy - cf.energy;
        const tDiff = rf.tempo - cf.tempo;
        if (direction === "windDown") {
          // Want lower energy + lower tempo
          return eDiff < 0 ? Math.abs(eDiff) * 2 + Math.max(0, -tDiff / 150) : eDiff - 1;
        }
        if (direction === "liftUp") {
          // Want higher energy + higher tempo
          return eDiff > 0 ? eDiff * 2 + Math.max(0, tDiff / 150) : eDiff - 1;
        }
        // sideways: similar energy but different genre or very different valence
        const energyClose = 1 - Math.abs(eDiff);
        const valenceDiff = Math.abs(rf.valence - cf.valence);
        const diffGenre = !getGenres(r).some(g => getGenres(centerRecord).includes(g)) ? 0.6 : 0;
        return energyClose * 0.4 + valenceDiff * 0.3 + diffGenre;
      }
      // Fallback: genre/decade heuristics only
      const sameGenre = getGenres(r).some(g => getGenres(centerRecord).includes(g));
      const sameDec = getDecade(r) === getDecade(centerRecord);
      if (direction === "windDown") return sameGenre && !sameDec ? 0.4 : sameGenre ? 0.3 : 0.1;
      if (direction === "liftUp") return sameGenre && !sameDec ? 0.4 : sameGenre ? 0.3 : 0.1;
      return !sameGenre ? 0.6 : sameDec ? 0.1 : 0.3;
    }

    const sorted = (dir) => [...candidates].sort((a, b) => score(b, dir) - score(a, dir));
    const pickedIds = new Set();

    function pick(dir) {
      const best = sorted(dir).find(r => !pickedIds.has(r.id));
      if (best) pickedIds.add(best.id);
      return best || null;
    }

    return {
      windDown: pick("windDown"),
      liftUp: pick("liftUp"),
      sideways: pick("sideways"),
    };
  }

  async function enterTrail(record) {
    setTrailCenter(record);
    setTrailHistory([record]);
    setTrailSuggestions(null);
    setTrailSearch("");
    setTrailSearchOpen(false);
    setTrailError("");
    setTrailActive(true);
    setTrailLoading(true);
    try {
      // Load all cached features + fetch center record's features
      const [, centerFeatures] = await Promise.all([
        loadSpotifyFeatures(),
        fetchAndCacheFeatures(record),
      ]);
      const allFeatures = { ...spotifyFeatures, ...(centerFeatures ? { [record.id]: centerFeatures } : {}) };
      setTrailSuggestions(computeTrailSuggestions(record, allFeatures));
    } catch {
      setTrailError("Couldn't load suggestions — try again.");
    } finally {
      setTrailLoading(false);
    }
  }

  async function navigateTrail(record) {
    await logPlay(record.id);
    setTrailCenter(record);
    setTrailHistory(prev => [...prev, record]);
    setTrailSuggestions(null);
    setTrailSearch("");
    setTrailSearchOpen(false);
    setTrailError("");
    setTrailLoading(true);
    try {
      const centerFeatures = await fetchAndCacheFeatures(record);
      const allFeatures = { ...spotifyFeatures, ...(centerFeatures ? { [record.id]: centerFeatures } : {}) };
      setTrailSuggestions(computeTrailSuggestions(record, allFeatures));
    } catch {
      setTrailError("Couldn't load suggestions — try again.");
    } finally {
      setTrailLoading(false);
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
    const res = await fetch("/api/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: recordId }),
    });
    const data = await res.json();
    const playedAt = data.played_at || new Date().toISOString();
    setPlayCounts((prev) => ({ ...prev, [recordId]: (prev[recordId] || 0) + 1 }));
    setLastPlayedDates((prev) => ({ ...prev, [recordId]: playedAt }));
    setPlaySessions((prev) => [{ id: data.id || crypto.randomUUID(), record_id: recordId, played_at: playedAt }, ...prev]);
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
        <div className="text-4xl mb-5" style={{ animation: "spin 3s linear infinite" }}>
          ⏺
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24 }} className="text-amber-100 mb-2">
          Loading your crate...
        </div>
        {collectionError && <div className="text-red-500/70 text-sm mt-2">{collectionError}</div>}
      </div>
    );
  }

  const hasUnlinked = collection.some((r) => r.discogs_id == null);
  const hasDiscogsLinked = collection.some((r) => r.discogs_id != null);

  return (
    <div
      className="min-h-screen flex flex-col max-w-md mx-auto"
      style={{ background: "linear-gradient(160deg,#1c1610 0%,#0c0b09 100%)", fontFamily: "'DM Sans',sans-serif", color: "#e8ddd0" }}
    >
      {viewMode !== "drift" && (
        <div className="px-5 pt-7 pb-2 flex items-start justify-between">
          <div>
            {user?.firstName && (
              <div className="text-xs uppercase tracking-widest text-amber-900 mb-0.5">{user.firstName}&apos;s</div>
            )}
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, lineHeight: 1 }} className="text-amber-50">
              CrateMate
            </h1>
            <div className="text-stone-600 text-xs mt-1">
              {myRecords.length} records · {forSaleRecords.length} for sale
            </div>
          </div>
          <div className="pt-1">
            <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </div>
        </div>
      )}

      <div className={`flex px-4 gap-0.5 mt-3 mb-2 ${viewMode === "drift" ? "relative z-[60]" : ""}`}>
        {[
          ["crate", "⏺ Crate"],
          ["hearts", "♥ Hearts"],
          ["history", "▷ History"],
          ["reco", "✦ Reco"],
          ["stats", "◎ Stats"],
          ["discover", "⊕ Discover"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
              tab === id
                ? "bg-amber-900/25 text-amber-400 border border-amber-800/35"
                : viewMode === "drift" ? "text-stone-600 hover:text-stone-400 bg-black/40" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "crate" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewMode !== "drift" && <div className="px-4 space-y-2 mb-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artist, title, genre, song..."
              className="w-full bg-stone-900/70 border border-stone-800/80 rounded-xl px-4 py-2.5 text-sm text-amber-50 placeholder-stone-700 focus:outline-none focus:border-amber-900/60"
            />
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[
                  ["artist", "A–Z"],
                  ["year", "Year"],
                  ["genre", "Genre"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setSortBy(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                      sortBy === k ? "bg-stone-700 text-amber-300" : "text-stone-600 hover:text-stone-300"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-2 py-1 rounded-lg text-xs transition-all ${
                    viewMode === "list" ? "bg-stone-700 text-amber-300" : "text-stone-600 hover:text-stone-300"
                  }`}
                  title="List view"
                >
                  ≡
                </button>
                <button
                  onClick={() => setViewMode("drift")}
                  className={`px-2 py-1 rounded-lg text-xs transition-all ${
                    viewMode === "drift" ? "bg-stone-700 text-amber-300" : "text-stone-600 hover:text-stone-300"
                  }`}
                  title="Honeycomb view"
                >
                  ⬡
                </button>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowForSale((s) => !s)}
                className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                  showForSale
                    ? "bg-rose-900/25 border-rose-800/40 text-rose-300"
                    : "border-stone-800 text-stone-600 hover:text-stone-400"
                }`}
              >
                {showForSale ? "📋 For Sale" : "For Sale"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-stone-700">
                {filtered.length} records{!infiniteScroll && totalPages > 1 ? ` · p${page}/${totalPages}` : ""}
              </div>
              {activeGenres.size > 0 && (
                <button
                  onClick={() => setActiveGenres(new Set())}
                  className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-800/40 text-amber-400"
                >
                  {activeGenres.size === 1 ? [...activeGenres][0] : `${activeGenres.size} genres`} ×
                </button>
              )}
              <button
                onClick={() => { setInfiniteScroll(s => !s); setPage(1); setVisibleCount(PAGE_SIZE); }}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${infiniteScroll ? "bg-amber-900/30 border-amber-800/40 text-amber-400" : "border-stone-800 text-stone-600 hover:text-stone-400"}`}
                title={infiniteScroll ? "Switch to pages" : "Switch to infinite scroll"}
              >
                {infiniteScroll ? "∞ scroll" : "pages"}
              </button>
              <div className="flex-1" />

              {discogsConnected ? (
                <>
                  <button
                    onClick={handleDiscogsImport}
                    disabled={importLoading}
                    title={discogsUsername ? `Linked as @${discogsUsername}` : "Discogs linked"}
                    className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-300 hover:border-amber-900/50 transition-all disabled:opacity-40"
                  >
                    {importLoading ? "Importing..." : `↓ ${discogsUsername ? `@${discogsUsername}` : "Discogs"}`}
                  </button>
                  <a
                    href="/api/discogs/auth"
                    title="Connect a different Discogs account"
                    onClick={async (e) => {
                      e.preventDefault();
                      await fetch("/api/discogs/disconnect", { method: "POST" });
                      setDiscogsConnected(false);
                      setDiscogsUsername(null);
                      window.location.href = "/api/discogs/auth";
                    }}
                    className="text-xs px-2 py-1 rounded-lg text-stone-700 hover:text-amber-500 transition-colors"
                    title="Re-link a different Discogs account"
                  >
                    ↺
                  </a>
                  {hasUnlinked && (
                    <button
                      onClick={handleCleanupSeeded}
                      disabled={cleanupLoading}
                      title="Removes records without discogs_id (legacy seed/manual rows)"
                      className="text-xs px-2.5 py-1 rounded-lg border border-stone-800 text-stone-500 hover:text-amber-300 hover:border-amber-900/50 transition-all disabled:opacity-40"
                    >
                      {cleanupLoading ? "Cleaning..." : "Cleanup"}
                    </button>
                  )}
                </>
              ) : (
                <a
                  href="/api/discogs/auth"
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-500 hover:text-amber-300 hover:border-amber-900/50 transition-all"
                >
                  Link Discogs
                </a>
              )}

              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-300 hover:border-amber-900/50 transition-all"
              >
                + Add
              </button>
            </div>

            {importResult && (
              <div
                className={`text-xs px-3 py-1.5 rounded-lg ${
                  importResult.error ? "text-red-400 bg-red-900/20" : "text-emerald-400 bg-emerald-900/20"
                }`}
              >
                {importResult.error
                  ? typeof importResult.error === "string"
                    ? importResult.error
                    : "Action failed — try again"
                  : importResult.syncing_meta
                    ? <CrateSyncAnimation />
                  : importResult.meta
                    ? `Metadata: updated ${importResult.meta.updated || 0} of ${importResult.meta.considered || 0}`
                  : importResult.cleanup
                    ? `Removed ${importResult.deleted} unlinked records`
                    : [
                      importResult.imported > 0 && `${importResult.imported} new`,
                      importResult.deleted > 0 && `${importResult.deleted} removed`,
                      importResult.deduped > 0 && `${importResult.deduped} dupes cleaned`,
                    ].filter(Boolean).join(" · ") || "Collection already up to date"}
                {!importResult.error && importResult.meta?.warning ? (
                  <span className="block text-stone-500 mt-1">{importResult.meta.warning}</span>
                ) : null}
              </div>
            )}
          </div>}

          {collection.length === 0 ? (
            <div className="flex-1 px-6 flex flex-col items-center justify-center text-center">
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26 }} className="text-amber-100 mb-2">
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
              <HoneycombView
                key={honeycombSort}
                records={honeycombRecords}
                playCounts={playCounts}
                zoom={honeycombZoom}
                onSelect={(rec) => {
                  setSelected(rec);
                  if (!rec.for_sale) setLastPlayed(rec);
                }}
                onLogPlay={logPlay}
                onShowToast={showPlayToast}
              />
              {/* Top-left: back to list + share */}
              <div className="absolute top-16 left-4 z-50 flex items-center gap-2">
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
                      navigator.clipboard.writeText(`${window.location.origin}/crate/${discogsUsername}`);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }}
                    disabled={!discogsUsername}
                    className={`px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border text-xs transition-colors ${
                      discogsUsername
                        ? "border-white/10 text-stone-400 hover:text-amber-300"
                        : "border-white/5 text-stone-700 cursor-not-allowed"
                    }`}
                    title={discogsUsername ? "Share your crate" : "Re-link Discogs to enable sharing"}
                  >
                    {shareCopied ? "Copied!" : "↗ Share"}
                  </button>
                )}
              </div>
              {/* Top-right: sort toggle */}
              <div className="absolute top-4 right-4 z-50 flex rounded-full bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden">
                {[["year", "Year"], ["genre", "Genre"], ["az", "A–Z"]].map(([val, label], i) => (
                  <button
                    key={val}
                    onClick={() => setHoneycombSort(val)}
                    className={`px-3 py-1.5 text-xs transition-colors ${honeycombSort === val ? "text-amber-300" : "text-stone-400 hover:text-stone-200"} ${i > 0 ? "border-l border-white/10" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Stat filter badge */}
              {statFilterLabel && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50">
                  <button
                    onClick={clearStatFilter}
                    className="px-3 py-1.5 rounded-full bg-amber-900/70 backdrop-blur-sm border border-amber-700/50 text-amber-200 text-xs flex items-center gap-2"
                  >
                    <span>Filtered: {statFilterLabel}</span>
                    <span className="text-amber-400 font-bold">×</span>
                  </button>
                </div>
              )}
              {/* Genre filter strip — bottom */}
              {(() => {
                const genres = [...new Set(pool.flatMap((r) => getGenres(r)))].sort();
                if (genres.length === 0) return null;
                return (
                  <div className="absolute bottom-20 left-0 right-0 z-50 flex justify-center pointer-events-none">
                    <div
                      className="flex gap-1.5 px-3 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 pointer-events-auto"
                      style={{ overflowX: "auto", maxWidth: "calc(100% - 32px)", scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      {genres.map((g) => (
                        <GenreTag
                          key={g}
                          genre={g}
                          onClick={() => toggleGenre(g)}
                          active={activeGenres.has(g)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Decade picker strip — above genre */}
              {decades.length > 0 && (
                <div className="absolute bottom-32 left-0 right-0 z-50 flex justify-center pointer-events-none">
                  <div
                    className="flex gap-1.5 px-3 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 pointer-events-auto"
                    style={{ overflowX: "auto", maxWidth: "calc(100% - 32px)", scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
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
                  </div>
                </div>
              )}
              {/* Bottom-center: zoom — above decade */}
              <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-50 flex items-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden">
                <button
                  onClick={() => setHoneycombZoom((z) => Math.max(0.4, parseFloat((z - 0.25).toFixed(2))))}
                  className="px-4 py-1.5 text-stone-400 text-base hover:text-amber-300 transition-colors"
                >
                  −
                </button>
                <div className="w-px h-3 bg-white/10" />
                <button
                  onClick={() => setHoneycombZoom((z) => Math.min(1.8, parseFloat((z + 0.25).toFixed(2))))}
                  className="px-4 py-1.5 text-stone-400 text-base hover:text-amber-300 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 pb-8 space-y-0.5">
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
                  onLogPlay={logPlay}
                  onShowToast={showPlayToast}
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
            </div>
          )}
        </div>
      )}

      {tab === "hearts" && (
        <div className="flex-1 px-4 overflow-y-auto pb-8">
          {(() => {
            const allFavRecords = myRecords
              .filter((r) => (r.favorite_tracks || []).length > 0)
              .sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
            if (allFavRecords.length === 0) {
              return (
                <div className="text-center py-16">
                  <div className="text-3xl mb-3 text-stone-700">♥</div>
                  <div className="text-stone-600 text-sm">No favorite tracks yet.</div>
                  <div className="text-stone-700 text-xs mt-1">Tap ♥ on a track in any record&apos;s tracklist.</div>
                </div>
              );
            }
            const heartsTotalPages = Math.ceil(allFavRecords.length / HEARTS_PAGE_SIZE);
            const visibleFavRecords = heartsInfiniteScroll
              ? allFavRecords.slice(0, heartsVisible)
              : allFavRecords.slice((heartsPage - 1) * HEARTS_PAGE_SIZE, heartsPage * HEARTS_PAGE_SIZE);
            const heartsHasMore = heartsInfiniteScroll && heartsVisible < allFavRecords.length;
            const allExpanded = expandedHearts.size >= visibleFavRecords.length;
            return (
              <>
                <div className="flex items-center gap-2 mt-2 mb-3">
                  <button
                    onClick={() => {
                      if (allExpanded) setExpandedHearts(new Set());
                      else setExpandedHearts(new Set(visibleFavRecords.map(r => r.id)));
                    }}
                    className="text-xs px-2.5 py-1 rounded-full border border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
                  >
                    {allExpanded ? "▼ Collapse all" : "▶ Expand all"}
                  </button>
                  <button
                    onClick={() => { setHeartsInfiniteScroll(s => !s); setHeartsPage(1); setHeartsVisible(HEARTS_PAGE_SIZE); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${heartsInfiniteScroll ? "bg-amber-900/30 border-amber-800/40 text-amber-400" : "border-stone-700 text-stone-500 hover:text-stone-300"}`}
                  >
                    {heartsInfiniteScroll ? "∞ scroll" : "pages"}
                  </button>
                </div>
                <div className="space-y-0.5">
                  {visibleFavRecords.map((r) => {
                    const isExpanded = expandedHearts.has(r.id);
                    const heartCount = (r.favorite_tracks || []).length;
                    return (
                      <div key={r.id} className="rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedHearts(prev => {
                            const next = new Set(prev);
                            next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                            return next;
                          })}
                          className="flex items-center gap-3 w-full px-2.5 py-2 text-left hover:bg-white/[0.04] transition-colors rounded-xl"
                          style={{ minHeight: 44 }}
                        >
                          <CoverArt record={r} size={36} />
                          <div className="flex-1 min-w-0">
                            <span className="text-amber-50 text-sm truncate block" style={{ fontFamily: "'Cormorant Garamond',serif" }}>
                              {r.artist} — {r.title}
                            </span>
                          </div>
                          <span className="text-rose-400 text-xs shrink-0 mr-1">♥ {heartCount}</span>
                          <span className="text-stone-600 text-xs shrink-0">{isExpanded ? "▼" : "▶"}</span>
                        </button>
                        {isExpanded && (
                          <div className="space-y-0.5 pl-[52px] pr-2 pb-2">
                            {(r.favorite_tracks || []).map((f) => {
                              const { key, title } = normFav(f);
                              const displayTitle = (title && title !== key) ? title : (favTitles[r.id]?.[key] || key);
                              return (
                                <div key={key} className="flex items-center gap-2 py-0.5">
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
                  {heartsInfiniteScroll ? (
                    heartsHasMore && <div ref={heartsSentinelRef} className="py-4 text-center text-stone-700 text-xs">Loading more…</div>
                  ) : (
                    heartsTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 py-4">
                        <button onClick={() => setHeartsPage(p => Math.max(1, p - 1))} disabled={heartsPage === 1}
                          className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                          ← Prev
                        </button>
                        <span className="text-stone-600 text-xs">{heartsPage} / {heartsTotalPages}</span>
                        <button onClick={() => setHeartsPage(p => Math.min(heartsTotalPages, p + 1))} disabled={heartsPage === heartsTotalPages}
                          className="px-3 py-1.5 rounded-lg text-xs border border-stone-800 text-stone-500 disabled:opacity-30 hover:text-stone-300 transition-colors">
                          Next →
                        </button>
                      </div>
                    )
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {tab === "reco" && (
        <div className="flex-1 px-4 overflow-y-auto pb-8 space-y-3">
          {[
            { type: "random", icon: "🎲", title: "Random Pick", sub: "Surprise me from the crate" },
            {
              type: "daily",
              icon: "📅",
              title: "Today's Pick",
              sub: `Seasonal & cultural fit for ${new Date().toLocaleString("default", { month: "long", day: "numeric" })}`,
            },
            {
              type: "next",
              icon: "▶︎",
              title: "Play Next",
              sub: lastPlayed
                ? `After "${(lastPlayed.title || "").slice(0, 30)}${lastPlayed.title?.length > 30 ? "..." : ""}"`
                : "Tap a record in Crate first",
              disabled: !lastPlayed,
            },
          ].map(({ type, icon, title, sub, disabled }) => (
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
              <div>
                <div className="font-medium text-stone-200 text-sm">{title}</div>
                <div className="text-xs text-stone-600">{sub}</div>
              </div>
            </button>
          ))}

          <div className="rounded-xl border border-stone-700/60 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl w-8 text-center">🌙</span>
              <div>
                <div className="font-medium text-stone-200 text-sm">Mood Match</div>
                <div className="text-xs text-stone-600">Describe how you&apos;re feeling or what you need</div>
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
            <div className="text-stone-600 text-sm text-center py-6">Import or add records to get recommendations.</div>
          )}

          {recoLoading && (
            <div className="text-center py-8">
              <div className="text-amber-900 text-3xl" style={{ display: "inline-block", animation: "spin 2s linear infinite" }}>
                ⏺
              </div>
              <div className="text-stone-600 text-sm mt-3">Flipping through the crate...</div>
            </div>
          )}
          {recoError && <div className="text-red-500/70 text-sm text-center py-3">{recoError}</div>}
          {reco && !recoLoading && (
            <RecoCard reco={reco} onClose={() => setReco(null)} onGenreClick={toggleGenre} activeGenres={activeGenres} />
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="flex-1 px-4 overflow-y-auto pb-8">
          {(() => {
            const totalPlays = playSessions.length;
            const uniqueRecords = new Set(playSessions.map((s) => s.record_id)).size;
            const mostPlayedId = Object.entries(playCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
            const mostPlayed = mostPlayedId ? collection?.find((r) => String(r.id) === String(mostPlayedId)) : null;
            return (
              <>
                {totalPlays > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4 mt-1">
                    <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                      <div className="text-stone-600 text-xs mb-0.5">Total Plays</div>
                      <div className="text-stone-200 text-sm font-medium">{totalPlays}</div>
                    </div>
                    <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                      <div className="text-stone-600 text-xs mb-0.5">Unique Records</div>
                      <div className="text-stone-200 text-sm font-medium">{uniqueRecords}</div>
                    </div>
                    <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
                      <div className="text-stone-600 text-xs mb-0.5">Most Played</div>
                      <div className="text-stone-200 text-xs font-medium truncate">{mostPlayed?.title || "—"}</div>
                    </div>
                  </div>
                )}
                {playSessions.length === 0 ? (
                  <div className="text-stone-600 text-sm text-center py-16">No plays logged yet.</div>
                ) : (
                  <div className="space-y-1">
                    {playSessions.map((session) => {
                      const rec = collection?.find((r) => String(r.id) === String(session.record_id));
                      if (!rec) return null;
                      const relDate = (() => {
                        const diff = Date.now() - new Date(session.played_at).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return "just now";
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        const days = Math.floor(hrs / 24);
                        if (days === 1) return "Yesterday";
                        if (days < 7) return `${days}d ago`;
                        return new Date(session.played_at).toLocaleDateString();
                      })();
                      return (
                        <div key={session.id} onClick={() => { setSelected(rec); if (!rec.for_sale) setLastPlayed(rec); }} className="flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] transition-all">
                          <CoverArt record={rec} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="text-amber-50 text-sm truncate" style={{ fontFamily: "'Cormorant Garamond',serif" }}>{rec.title}</div>
                            <div className="text-stone-500 text-xs truncate">{rec.artist}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-stone-600 text-xs">{relDate}</div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await fetch(`/api/plays/${session.id}`, { method: "DELETE" });
                                setPlaySessions((prev) => prev.filter((s) => s.id !== session.id));
                                setPlayCounts((prev) => ({ ...prev, [session.record_id]: Math.max((prev[session.record_id] || 0) - 1, 0) }));
                                setLastPlayedDates((prev) => {
                                  const remaining = playSessions.filter((s) => s.id !== session.id && s.record_id === session.record_id);
                                  const nd = { ...prev };
                                  if (remaining.length > 0) nd[session.record_id] = remaining[0].played_at;
                                  else delete nd[session.record_id];
                                  return nd;
                                });
                              }}
                              className="text-stone-700 hover:text-stone-400 transition-colors text-base w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/[0.06]"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {tab === "stats" && (
        <div className="flex-1 px-4 overflow-y-auto pb-8">
          {(() => {
            const { decades, genres, formats, styles } = buildCollectionStats(myRecords);
            const { byHour, byDow, nightPlays, dayPlays, weekendPlays, weekdayPlays, midnightRecord, sunMorningRecord } = buildTimeStats(playSessions, collection);
            const totalPlays = playSessions.length;

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

            return (
              <div className="space-y-6 pt-2">
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

                {/* When You Listen */}
                {totalPlays > 0 && (
                  <>
                    <div>
                      <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">When You Listen</div>
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
                      <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">Day of Week</div>
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
                        <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">Special Records</div>
                        <div className="space-y-2">
                          {midnightRecord && (
                            <button
                              onClick={() => { setSelected(midnightRecord); setLastPlayed(midnightRecord); }}
                              className="w-full flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 hover:bg-white/[0.06] transition-colors text-left"
                            >
                              <span className="text-lg shrink-0">🌙</span>
                              <CoverArt record={midnightRecord} size={36} />
                              <div className="flex-1 min-w-0">
                                <div className="text-amber-50 text-xs truncate" style={{ fontFamily: "'Cormorant Garamond',serif" }}>{midnightRecord.title}</div>
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
                                <div className="text-amber-50 text-xs truncate" style={{ fontFamily: "'Cormorant Garamond',serif" }}>{sunMorningRecord.title}</div>
                                <div className="text-stone-600 text-xs">Sunday morning album</div>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {myRecords.length === 0 && (
                  <div className="text-stone-600 text-sm text-center py-16">Add records to see stats.</div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {tab === "discover" && (
        <div className="flex-1 px-4 overflow-y-auto pb-8 pt-2 space-y-4">
          {/* Discovery toggle */}
          <div className="bg-white/[0.04] rounded-xl p-4">
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
          </div>

          {!isDiscoverable ? (
            <div className="text-center py-12">
              <div className="text-stone-600 text-sm">Enable discovery above to find similar crates</div>
            </div>
          ) : (
            <>
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
                <div className="text-center py-8">
                  <div className="text-stone-600 text-sm">Hit Refresh to find users with similar taste</div>
                </div>
              )}
              {discoverLoading && (
                <div className="text-center py-8 text-stone-600 text-sm">Finding similar crates…</div>
              )}
              {discoverResults !== null && !discoverLoading && discoverResults.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-stone-600 text-sm">No other discoverable users yet — spread the word</div>
                </div>
              )}
              {discoverResults && discoverResults.length > 0 && (
                <div className="space-y-1">
                  {discoverResults.map((u) => (
                    <button
                      key={u.username}
                      onClick={() => window.open(`/crate/${u.username}`, "_blank")}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.06]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-stone-200 text-sm truncate">@{u.username}</div>
                        <div className="text-stone-600 text-xs mt-0.5">
                          {u.shared_artists} shared artists · {u.record_count} records
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-amber-400 text-xs font-medium">{u.similarity_pct}%</div>
                        <div className="text-stone-700 text-xs">match</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {selected && (
        <DetailSheet
          record={selected}
          onClose={() => setSelected(null)}
          onGenreClick={toggleGenre}
          activeGenres={activeGenres}
          onToggleForSale={toggleForSale}
          onDelete={handleDelete}
          onLogPlay={logPlay}
          onUndoLogPlay={undoLogPlay}
          onRecordUpdate={(patch) => {
            const updated = { ...selected, ...patch };
            setSelected(updated);
            setCollection((prev) => Array.isArray(prev) ? prev.map((r) => r.id === updated.id ? updated : r) : prev);
          }}
          playCount={playCounts[selected.id] || 0}
          lastPlayedDate={lastPlayedDates[selected.id] || null}
          onSeedNext={(rec) => {
            setLastPlayed(rec);
            setTab("reco");
            setSelected(null);
          }}
        />
      )}
      {showAddModal && <AddRecordModal onClose={() => setShowAddModal(false)} onAdd={(r) => setCollection((p) => [...(p || []), r])} />}

      {/* Long-press action pill */}
      {actionPill && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] shadow-2xl" style={{ pointerEvents: "auto", minWidth: 270 }}>
          <div className="bg-stone-950 border border-stone-700/60 rounded-2xl px-4 pt-3 pb-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-stone-400 text-sm truncate flex-1">{actionPill.record.title}</span>
              <button onClick={() => { clearTimeout(actionPillTimer.current); setActionPill(null); }}
                className="text-stone-700 hover:text-stone-400 text-lg leading-none shrink-0">×</button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  logPlay(actionPill.record.id);
                  clearTimeout(actionPillTimer.current);
                  setActionPill(null);
                }}
                className="flex-1 py-2 rounded-xl border border-stone-700 text-stone-300 text-xs hover:border-amber-900/50 hover:text-amber-200 transition-colors"
              >
                ▶ Log play
              </button>
              <button
                onClick={() => {
                  const rec = actionPill.record;
                  clearTimeout(actionPillTimer.current);
                  setActionPill(null);
                  enterTrail(rec);
                }}
                className="flex-1 py-2 rounded-xl border border-amber-800/60 bg-amber-900/20 text-amber-300 text-xs hover:bg-amber-900/40 transition-colors"
              >
                ⬡ Play Trail
              </button>
            </div>
          </div>
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
          onClose={() => { setTrailActive(false); setTrailSearchOpen(false); }}
          playCounts={playCounts}
        />
      )}
    </div>
  );
}
