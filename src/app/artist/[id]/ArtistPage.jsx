"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function ArtistPage({ artist, studioAlbums, epsSingles, live }) {
  const router = useRouter();
  const [myRecords, setMyRecords] = useState([]);
  const [fanRank, setFanRank] = useState(null);
  const [showEps, setShowEps] = useState(false);
  const [showLive, setShowLive] = useState(false);

  useEffect(() => {
    if (!artist?.name) return;
    fetch("/api/records")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const name = artist.name.toLowerCase();
          setMyRecords(data.filter((r) => (r.artist || "").toLowerCase().includes(name)));
        }
      })
      .catch(() => {});

    fetch(`/api/artist-fans?artist=${encodeURIComponent(artist.name)}`)
      .then((r) => r.json())
      .then((data) => setFanRank(data))
      .catch(() => {});
  }, [artist?.name]);

  const ownedMasterIds = new Set(myRecords.map((r) => String(r.discogs_id)).filter(Boolean));
  const ownedCount = studioAlbums.filter((a) => ownedMasterIds.has(String(a.id))).length;
  const totalCount = studioAlbums.length;
  const pct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  const myOwnedRank = fanRank?.byOwned
    ? fanRank.byOwned.findIndex((u) => u.user_id === fanRank.currentUserId) + 1
    : null;
  const myPlaysRank = fanRank?.byPlays
    ? fanRank.byPlays.findIndex((u) => u.user_id === fanRank.currentUserId) + 1
    : null;

  const profileImage = artist?.images?.[0]?.uri || artist?.images?.[0]?.uri150 || "";
  const artistName = artist?.name || "Artist";

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

        {/* Studio albums progress */}
        {totalCount > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-stone-300 text-sm font-medium">Studio Albums</div>
              <div className="text-stone-500 text-xs">{ownedCount} / {totalCount} ({pct}%)</div>
            </div>
            <div className="w-full bg-stone-800 rounded-full h-1.5 mb-3">
              <div
                className="bg-amber-600 h-1.5 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {studioAlbums.map((album) => {
                const owned = ownedMasterIds.has(String(album.id));
                const thumbUrl = album.thumb || "";
                return (
                  <div
                    key={album.id}
                    className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                      owned ? "border-amber-700/60" : "border-transparent opacity-40"
                    }`}
                    title={`${album.title} (${album.year || "?"})`}
                  >
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={album.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                        <span className="text-stone-600 text-xs">♪</span>
                      </div>
                    )}
                    {owned && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-amber-600 rounded-tl-md flex items-center justify-center">
                        <span style={{ fontSize: 8, color: "white" }}>✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EPs/Singles collapsible */}
        {epsSingles.length > 0 && (
          <div>
            <button
              onClick={() => setShowEps((s) => !s)}
              className="flex items-center justify-between w-full text-stone-400 text-sm py-1"
            >
              <span>EPs & Singles <span className="text-stone-600">({epsSingles.length})</span></span>
              <span>{showEps ? "▲" : "▼"}</span>
            </button>
            {showEps && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {epsSingles.map((r) => {
                  const owned = ownedMasterIds.has(String(r.id));
                  return (
                    <div
                      key={r.id}
                      className={`aspect-square rounded-lg overflow-hidden border ${owned ? "border-amber-700/60" : "border-transparent opacity-40"}`}
                      title={r.title}
                    >
                      {r.thumb ? (
                        <img src={r.thumb} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-stone-800" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Live collapsible */}
        {live.length > 0 && (
          <div>
            <button
              onClick={() => setShowLive((s) => !s)}
              className="flex items-center justify-between w-full text-stone-400 text-sm py-1"
            >
              <span>Live <span className="text-stone-600">({live.length})</span></span>
              <span>{showLive ? "▲" : "▼"}</span>
            </button>
            {showLive && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {live.map((r) => {
                  const owned = ownedMasterIds.has(String(r.id));
                  return (
                    <div
                      key={r.id}
                      className={`aspect-square rounded-lg overflow-hidden border ${owned ? "border-amber-700/60" : "border-transparent opacity-40"}`}
                      title={r.title}
                    >
                      {r.thumb ? (
                        <img src={r.thumb} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-stone-800" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {totalCount === 0 && epsSingles.length === 0 && live.length === 0 && (
          <div className="text-stone-600 text-sm text-center py-8">No releases found for this artist.</div>
        )}
      </div>
    </div>
  );
}
