"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";

function mapSearchResult(r) {
  const dash = (r.title || "").indexOf(" - ");
  const artist = dash > -1 ? r.title.slice(0, dash) : "Unknown";
  const title = dash > -1 ? r.title.slice(dash + 3) : r.title;
  const year = parseInt(r.year) || null;
  return {
    artist,
    title,
    label: r.label?.[0] || "",
    year_pressed: year,
    year_original: year,
    genre: ((r.style || []).length > 0 ? (r.style || []).slice(0, 3) : (r.genre || []).slice(0, 2)).join(", "),
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
  const debounce = useRef(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/discogs/search?q=${encodeURIComponent(q)}`);
        setResults(await res.json());
      } catch {
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

const GENRE_STYLES = {
  "Classic Rock": "bg-orange-900/40 text-orange-300 border-orange-800/40",
  "Hard Rock": "bg-red-900/40 text-red-300 border-red-800/40",
  "Pop Rock": "bg-sky-900/40 text-sky-300 border-sky-800/40",
  "Soft Rock": "bg-teal-900/40 text-teal-300 border-teal-800/40",
  "Rock & Roll": "bg-yellow-900/40 text-yellow-300 border-yellow-800/40",
  "Funk/Soul": "bg-purple-900/40 text-purple-300 border-purple-800/40",
  Jazz: "bg-indigo-900/40 text-indigo-300 border-indigo-800/40",
  Latin: "bg-rose-900/40 text-rose-300 border-rose-800/40",
  "Punk Rock": "bg-lime-900/40 text-lime-300 border-lime-800/40",
  Electronic: "bg-cyan-900/40 text-cyan-300 border-cyan-800/40",
  Blues: "bg-blue-900/40 text-blue-300 border-blue-800/40",
  Pop: "bg-pink-900/40 text-pink-300 border-pink-800/40",
  "Rock en Espanol": "bg-amber-900/40 text-amber-300 border-amber-800/40",
  Country: "bg-green-900/40 text-green-300 border-green-800/40",
  Reggae: "bg-emerald-900/40 text-emerald-300 border-emerald-800/40",
  Classical: "bg-violet-900/40 text-violet-300 border-violet-800/40",
};

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

function getGenres(record) {
  return (record.genre || "").split(",").map((g) => g.trim()).filter(Boolean);
}

function GenreTag({ genre, onClick, active }) {
  const cls = GENRE_STYLES[genre] || "bg-stone-800/40 text-stone-400 border-stone-700/40";
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

function RecordRow({ record, onClick, onGenreClick, activeGenres = new Set(), playCount }) {
  const originalYear = record.year_original || record.year_pressed;
  const pressedYear = record.year_pressed || null;
  const showPressed = originalYear && pressedYear && pressedYear !== originalYear;
  return (
    <div
      onClick={() => onClick(record)}
      className="flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.04] active:scale-[0.99] border border-transparent hover:border-white/[0.07]"
    >
      <CoverArt record={record} size={52} />
      <div className="flex-1 min-w-0">
        <div
          className="truncate text-amber-50 leading-snug"
          style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17 }}
        >
          {record.title}
        </div>
        <div className="text-stone-400 text-xs truncate mt-0.5">
          {record.artist}
          {record.for_sale && <span className="ml-2 text-rose-400/80">FOR SALE</span>}
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

function DetailSheet({ record, onClose, onSeedNext, onGenreClick, activeGenres = new Set(), onToggleForSale, onDelete, onLogPlay, onUndoLogPlay, playCount, lastPlayedDate }) {
  const [tracks, setTracks] = useState([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
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
            {tracks.map((t, i) => (
              <div key={`${t.position || "h"}-${i}`} className="flex items-start gap-3">
                <div className="text-stone-600 text-xs w-10 shrink-0 pt-0.5">{t.position || "—"}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${t.type === "heading" ? "text-stone-300 uppercase tracking-widest text-xs" : "text-amber-50"}`}>
                    {t.title}
                  </div>
                </div>
                <div className="text-stone-600 text-xs shrink-0 pt-0.5">{t.duration || ""}</div>
              </div>
            ))}
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

export function HoneycombView({ records, playCounts, onSelect, zoom = 1 }) {
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
      onSelect(record);
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

async function callClaude(messages, maxTokens = 400) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: maxTokens }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.content?.[0]?.text || "";
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

  const [playCounts, setPlayCounts] = useState({});
  const [lastPlayedDates, setLastPlayedDates] = useState({});
  const [playSessions, setPlaySessions] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [honeycombSort, setHoneycombSort] = useState("year");
  const [honeycombZoom, setHoneycombZoom] = useState(1.0);

  const [shareCopied, setShareCopied] = useState(false);

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
      setCollection(Array.isArray(data) ? data : []);
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

  useEffect(() => {
    refreshRecords();
    loadPlays();
  }, [refreshRecords]);

  const myRecords = Array.isArray(collection) ? collection.filter((r) => !r.for_sale) : [];
  const forSaleRecords = Array.isArray(collection) ? collection.filter((r) => r.for_sale) : [];
  const pool = showForSale ? forSaleRecords : myRecords;

  const sorted = [...pool].sort((a, b) => {
    if (sortBy === "year") return (a.year_original || a.year_pressed || 9999) - (b.year_original || b.year_pressed || 9999);
    if (sortBy === "genre") return (a.genre || "").localeCompare(b.genre || "");
    return (a.artist || "").localeCompare(b.artist || "");
  });

  const filtered = sorted.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (r.title || "").toLowerCase().includes(q) ||
      (r.artist || "").toLowerCase().includes(q) ||
      (r.genre || "").toLowerCase().includes(q) ||
      (r.tracks || []).some((t) => (t.title || "").toLowerCase().includes(q));
    const matchesGenre = !activeGenres.size || getGenres(r).some((g) => activeGenres.has(g));
    return matchesSearch && matchesGenre;
  });

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

  const getReco = useCallback(
    async (type) => {
      setRecoLoading(true);
      setRecoError("");
      setReco(null);
      try {
        const list = myRecords
          .map(
            (r) =>
              `id:${r.id}|"${r.title}"|${r.artist}|${r.year_original || r.year_pressed || "?"}|${r.genre}${
                r.is_compilation ? " (comp)" : ""
              }`
          )
          .join("\n");
        const today = new Date();
        const month = today.toLocaleString("default", { month: "long" });
        const day = today.getDate();
        let ctx = "";
        if (type === "random") ctx = "Pick one completely random record. Surprise me.";
        else if (type === "daily")
          ctx = `Today is ${month} ${day}. Pick the most fitting record for this specific date — consider season in Mexico, holidays (e.g. July 4 = American vibes, Dec = festive, Dia de Muertos, etc.), time-of-year energy. Be creative and specific.`;
        else if (type === "mood") ctx = `Pick the single best record for this mood: "${mood}"`;
        else
          ctx = `I just listened to "${lastPlayed?.title}" by ${lastPlayed?.artist} (${lastPlayed?.year_original || lastPlayed?.year_pressed}, ${
            lastPlayed?.genre
          }). Pick the ideal next record.`;

        const text = await callClaude(
          [
            {
              role: "user",
              content: `Vinyl curator. ${ctx}\n\nCollection:\n${list}\n\nRespond ONLY with JSON: {"id":<number>,"reason":"<one vivid specific sentence>"}\nNo markdown.`,
            },
          ],
          300
        );
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        const found = myRecords.find((r) => r.id === parsed.id);
        if (!found) throw new Error("not-found");
        setReco({
          record: found,
          reason: parsed.reason,
          label: { random: "Random Pick", daily: "Today's Pick", mood: "Mood Match", next: "Play Next" }[type],
        });
      } catch {
        setRecoError("Couldn't get a recommendation — try again.");
      } finally {
        setRecoLoading(false);
      }
    },
    [myRecords, mood, lastPlayed]
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
    const startRes = await fetch(`/api/discogs/enrich/job?mode=${encodeURIComponent(mode)}`, {
      method: "POST",
    });
    const startData = await readJsonOrText(startRes);
    if (!startRes.ok) throw new Error(startData?.error || `Metadata sync failed (${startRes.status})`);
    const jobId = startData.job_id;
    if (!jobId) throw new Error("Missing metadata job id");

    let latest = startData;
    while (true) {
      const statusRes = await fetch(`/api/discogs/enrich/job/${encodeURIComponent(jobId)}`);
      const statusData = await readJsonOrText(statusRes);
      if (!statusRes.ok) throw new Error(statusData?.error || `Metadata job failed (${statusRes.status})`);
      latest = statusData;
      if (statusData.status === "completed") break;
      if (statusData.status === "failed") break;
      await new Promise((r) => setTimeout(r, 600));
    }

    if (latest.status === "failed") {
      throw new Error(latest.error || "Metadata job failed");
    }

    return {
      updated: latest.updated || 0,
      considered: latest.considered || 0,
      warning: latest.warning || "",
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

      {viewMode !== "drift" && <div className="flex px-4 gap-1 mt-3 mb-2">
        {[
          ["crate", "⏺ Crate"],
          ["history", "▷ History"],
          ["reco", "✦ Reco"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === id
                ? "bg-amber-900/25 text-amber-400 border border-amber-800/35"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>}

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
              <div className="text-xs text-stone-700">{filtered.length} records</div>
              {activeGenres.size > 0 && (
                <button
                  onClick={() => setActiveGenres(new Set())}
                  className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-800/40 text-amber-400"
                >
                  {activeGenres.size === 1 ? [...activeGenres][0] : `${activeGenres.size} genres`} ×
                </button>
              )}
              <div className="flex-1" />

              {discogsConnected ? (
                <>
                  <button
                    onClick={handleDiscogsImport}
                    disabled={importLoading}
                    title={discogsUsername ? `Linked as ${discogsUsername}` : "Discogs linked"}
                    className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-300 hover:border-amber-900/50 transition-all disabled:opacity-40"
                  >
                    {importLoading ? "Importing..." : `↓ Discogs`}
                  </button>
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
              />
              {/* Top-left: back to list + share */}
              <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
                <button
                  onClick={() => setViewMode("list")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-stone-400 text-xs hover:text-amber-300 transition-colors"
                >
                  ≡ List
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
              {/* Genre filter strip */}
              {(() => {
                const genres = [...new Set(pool.flatMap((r) => getGenres(r)))].sort();
                if (genres.length === 0) return null;
                return (
                  <div className="absolute bottom-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
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
              {/* Bottom-center: zoom */}
              <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden">
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
              {filtered.map((r) => (
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
                />
              ))}
              {filtered.length === 0 && <div className="text-center text-stone-700 py-16">No records found</div>}
            </div>
          )}
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
                        <div key={session.id} className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] transition-all">
                          <CoverArt record={rec} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="text-amber-50 text-sm truncate" style={{ fontFamily: "'Cormorant Garamond',serif" }}>{rec.title}</div>
                            <div className="text-stone-500 text-xs truncate">{rec.artist}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-stone-600 text-xs">{relDate}</div>
                            <button
                              onClick={async () => {
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
    </div>
  );
}
