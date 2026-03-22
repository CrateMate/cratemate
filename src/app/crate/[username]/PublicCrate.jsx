"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { HoneycombView, TileView, CoverArt } from "@/app/components/VinylCrate";

function PublicDetailCard({ record, onClose }) {
  const year = record.year_original || record.year_pressed;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8 border border-stone-800/60"
        style={{ background: "var(--bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <CoverArt record={record} size={80} />
          <div className="flex-1 min-w-0 pt-1">
            <div
              className="text-amber-50 leading-tight truncate"
              style={{ fontFamily: "'Fraunces',serif", fontSize: 22 }}
            >
              {record.title}
            </div>
            <div className="text-stone-400 text-sm mt-0.5 truncate">{record.artist}</div>
            {(year || record.genre) && (
              <div className="text-stone-600 text-xs mt-1.5 flex items-center gap-2">
                {year && <span>{year}</span>}
                {year && record.genre && <span>·</span>}
                {record.genre && <span>{record.genre}</span>}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-stone-600 hover:text-stone-400 text-xl leading-none mt-1"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicCrate({ records, username }) {
  const searchParams = useSearchParams();
  const [zoom, setZoom] = useState(1.0);
  const [selected, setSelected] = useState(null);
  const [shape, setShape] = useState(() => {
    const v = searchParams?.get("view");
    return (v === "grid" || v === "tiles" || v === "honeycomb") ? v : "honeycomb";
  });

  return (
    <div
      className="h-dvh flex flex-col"
      style={{ fontFamily: "'DM Sans',sans-serif" }}
    >
      {/* Header bar */}
      <div className="w-full flex items-center justify-between px-4 py-2.5 border-b border-stone-800/60 bg-black/30">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="CrateMate" width={20} height={20} className="rounded-md opacity-70" />
          <div className="text-xs text-stone-500">
            <span className="text-stone-400 font-medium">{username}</span>
            <span className="ml-1">· {records.length} records</span>
          </div>
        </div>
        <a
          href="/sign-up"
          className="text-xs px-3 py-1.5 rounded-full border border-amber-800/50 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors whitespace-nowrap"
        >
          Build your own crate — it&apos;s free →
        </a>
      </div>

      {/* View */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {records.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-stone-700 text-sm py-24">
            This crate is empty.
          </div>
        ) : shape === "tiles" ? (
          <TileView
            records={records}
            playCounts={{}}
            onSelect={setSelected}
          />
        ) : (
          <HoneycombView
            key={shape}
            records={records}
            playCounts={{}}
            zoom={zoom}
            shape={shape}
            onSelect={setSelected}
          />
        )}

        {/* View toggle */}
        <div className="absolute top-4 right-4 z-50 flex rounded-full bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden">
          <button onClick={() => setShape("honeycomb")}
            className={`px-3 py-1.5 text-xs transition-colors ${shape === "honeycomb" ? "text-amber-300" : "text-stone-400 hover:text-stone-200"}`}>⬡</button>
          <button onClick={() => setShape("grid")}
            className={`px-3 py-1.5 text-xs border-l border-white/10 transition-colors ${shape === "grid" ? "text-amber-300" : "text-stone-400 hover:text-stone-200"}`}>⊞</button>
          <button onClick={() => setShape("tiles")}
            className={`px-3 py-1.5 text-xs border-l border-white/10 transition-colors ${shape === "tiles" ? "text-amber-300" : "text-stone-400 hover:text-stone-200"}`}>▦</button>
        </div>

        {/* Zoom controls (hidden for tiles) */}
        {shape !== "tiles" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, parseFloat((z - 0.25).toFixed(2))))}
              className="px-4 py-1.5 text-stone-400 text-base hover:text-amber-300 transition-colors"
            >
              −
            </button>
            <div className="w-px h-3 bg-white/10" />
            <button
              onClick={() => setZoom((z) => Math.min(1.8, parseFloat((z + 0.25).toFixed(2))))}
              className="px-4 py-1.5 text-stone-400 text-base hover:text-amber-300 transition-colors"
            >
              +
            </button>
          </div>
        )}
      </div>

      {selected && (
        <PublicDetailCard record={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
