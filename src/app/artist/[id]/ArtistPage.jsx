"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function categorize(releases) {
  const studioAlbums = [];
  const epsSingles = [];
  const live = [];

  for (const r of releases) {
    if (r.type !== "master") continue;
    const fmt = (r.format || "") + " " + (r.role || "");
    if (/acetate|unofficial|video/i.test(fmt)) continue;
    if (/live/i.test(fmt)) { live.push(r); continue; }
    if (/ep|single/i.test(fmt)) { epsSingles.push(r); continue; }
    if (/compilation|dj.?mix/i.test(fmt)) continue;
    studioAlbums.push(r);
  }

  return { studioAlbums, epsSingles, live };
}

function ProgressBar({ pct }) {
  return (
    <div className="w-full bg-stone-800 rounded-full h-1.5">
      <div
        className="bg-amber-600 h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ReleaseRow({ album, owned }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className={`flex items-center gap-3 py-1.5 ${owned ? "" : "opacity-40"}`}>
      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-stone-800 flex items-center justify-center">
        {album.thumb ? (
          <img
            src={album.thumb}
            alt={album.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <span className="text-stone-600 text-xs">♪</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${owned ? "text-amber-400" : "text-stone-500"}`}>
            {owned ? "✓" : "○"}
          </span>
          <span className="text-stone-200 text-sm truncate">{album.title}</span>
          {album.year && <span className="text-stone-600 text-xs flex-shrink-0">{album.year}</span>}
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({ label, count, items, ownedIds }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex items-center justify-between w-full text-stone-400 text-sm py-1"
      >
        <span>{label} <span className="text-stone-600">({count})</span></span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {items.map((r) => (
            <ReleaseRow key={r.id} album={r} owned={ownedIds.has(String(r.id))} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArtistPage({ releaseId }) {
  const router = useRouter();

  // Phase 1 state — from local DB
  const [myRecords, setMyRecords] = useState(null); // null = loading

  // Phase 2 state — from Discogs cache
  const [artistData, setArtistData] = useState(null);
  const [discogsLoading, setDiscogsLoading] = useState(true);

  // Fan ranking
  const [fanRank, setFanRank] = useState(null);

  // Phase 1: fetch owned records immediately
  useEffect(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((data) => setMyRecords(Array.isArray(data) ? data : []))
      .catch(() => setMyRecords([]));
  }, []);

  // Phase 2: fetch artist + discography (cached route)
  useEffect(() => {
    if (!releaseId) return;
    fetch(`/api/discogs/artist/${releaseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.artist) setArtistData(data);
      })
      .catch(() => {})
      .finally(() => setDiscogsLoading(false));
  }, [releaseId]);

  // Fetch fan ranking once we know the artist name
  useEffect(() => {
    const name = artistData?.artist?.name;
    if (!name) return;
    fetch(`/api/artist-fans?artist=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => setFanRank(data))
      .catch(() => {});
  }, [artistData?.artist?.name]);

  // Derive display values
  const artistName = artistData?.artist?.name
    ?? (myRecords?.length > 0 ? myRecords[0].artist : "Artist");
  const profileImage = artistData?.artist?.profile_image || "";

  // Filter owned records by artist name (works in phase 1 with guessed name)
  const ownedRecords = myRecords
    ? myRecords.filter((r) => (r.artist || "").toLowerCase().includes(artistName.toLowerCase()))
    : [];
  const ownedMasterIds = new Set(ownedRecords.map((r) => String(r.discogs_id)).filter(Boolean));

  // Discography (phase 2)
  const { studioAlbums, epsSingles, live } = artistData
    ? categorize(artistData.releases || [])
    : { studioAlbums: [], epsSingles: [], live: [] };

  const ownedCount = studioAlbums.filter((a) => ownedMasterIds.has(String(a.id))).length;
  const totalCount = studioAlbums.length;
  const pct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  const myOwnedRank = fanRank?.byOwned
    ? fanRank.byOwned.findIndex((u) => u.user_id === fanRank.currentUserId) + 1
    : null;
  const myPlaysRank = fanRank?.byPlays
    ? fanRank.byPlays.findIndex((u) => u.user_id === fanRank.currentUserId) + 1
    : null;

  return (
    <div
      className="min-h-screen flex flex-col max-w-md mx-auto pb-10"
      style={{ background: "linear-gradient(160deg,#1c1610 0%,#0c0b09 100%)", fontFamily: "'DM Sans',sans-serif", color: "#e8ddd0" }}
    >
      {/* Header */}
      <div className="relative h-56 overflow-hidden">
        {profileImage ? (
          <img src={profileImage} alt={artistName} className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full bg-stone-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
        <button
          onClick={() => router.back()}
          className="absolute top-5 left-5 bg-black/50 backdrop-blur-sm text-stone-300 w-9 h-9 rounded-full flex items-center justify-center text-lg hover:text-white"
        >
          ←
        </button>
        <div className="absolute bottom-4 left-5 right-5">
          <h1
            className="text-amber-50 font-semibold leading-tight"
            style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30 }}
          >
            {artistName}
          </h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Fan ranking */}
        {(myOwnedRank > 0 || myPlaysRank > 0) && (
          <div className="flex gap-2">
            {myOwnedRank > 0 && (
              <div className="flex-1 bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-center">
                <div className="text-amber-400 font-semibold text-lg">#{myOwnedRank}</div>
                <div className="text-stone-500 text-xs">by records owned</div>
              </div>
            )}
            {myPlaysRank > 0 && (
              <div className="flex-1 bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-center">
                <div className="text-amber-400 font-semibold text-lg">#{myPlaysRank}</div>
                <div className="text-stone-500 text-xs">by plays</div>
              </div>
            )}
          </div>
        )}

        {/* Phase 1: owned records (shown immediately) */}
        {myRecords !== null && ownedRecords.length > 0 && !artistData && (
          <div>
            <div className="text-stone-400 text-sm font-medium mb-2">Your records</div>
            <div className="space-y-1">
              {ownedRecords.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-1">
                  {r.thumb ? (
                    <img src={r.thumb} alt={r.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-stone-800 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-stone-200 text-sm truncate">{r.title}</div>
                    {r.year_original && <div className="text-stone-500 text-xs">{r.year_original}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase 2: full discography (text list, immediate; images lazy-load) */}
        {artistData && totalCount > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-stone-300 text-sm font-medium">Studio Albums</div>
              <div className="text-stone-500 text-xs">{ownedCount} / {totalCount} ({pct}%)</div>
            </div>
            <ProgressBar pct={pct} />
            <div className="mt-3 space-y-0.5">
              {studioAlbums.map((album) => (
                <ReleaseRow key={album.id} album={album} owned={ownedMasterIds.has(String(album.id))} />
              ))}
            </div>
          </div>
        )}

        {/* EPs & Singles */}
        {artistData && epsSingles.length > 0 && (
          <CollapsibleSection
            label="EPs & Singles"
            count={epsSingles.length}
            items={epsSingles}
            ownedIds={ownedMasterIds}
          />
        )}

        {/* Live */}
        {artistData && live.length > 0 && (
          <CollapsibleSection
            label="Live"
            count={live.length}
            items={live}
            ownedIds={ownedMasterIds}
          />
        )}

        {/* Loading state for discography */}
        {discogsLoading && (
          <div className="text-stone-600 text-sm text-center py-4">Loading discography…</div>
        )}

        {/* Empty state */}
        {!discogsLoading && artistData && totalCount === 0 && epsSingles.length === 0 && live.length === 0 && (
          <div className="text-stone-600 text-sm text-center py-8">No releases found for this artist.</div>
        )}
      </div>
    </div>
  );
}
