"use client";

import { useEffect, useRef, useState } from "react";

export default function StoryPreviewModal({ canvases, onClose }) {
  const [index, setIndex] = useState(0);
  const [dataURLs, setDataURLs] = useState([]);
  const touchStartX = useRef(null);

  useEffect(() => {
    setDataURLs(canvases.map((c) => c.toDataURL("image/png")));
  }, [canvases]);

  function prev() { setIndex((i) => Math.max(0, i - 1)); }
  function next() { setIndex((i) => Math.min(canvases.length - 1, i + 1)); }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -50) next();
    else if (dx > 50) prev();
  }

  async function canvasToFile(canvas, i) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return new File([blob], `crate-story-${i + 1}.png`, { type: "image/png" });
  }

  async function shareOne(i) {
    try {
      const file = await canvasToFile(canvases[i], i);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err?.name !== "AbortError") console.error("Share failed:", err);
    }
  }

  async function shareAll() {
    try {
      const files = await Promise.all(canvases.map((c, i) => canvasToFile(c, i)));
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files });
      } else {
        for (let i = 0; i < files.length; i++) {
          const url = URL.createObjectURL(files[i]);
          const a = document.createElement("a");
          a.href = url; a.download = files[i].name; a.click();
          URL.revokeObjectURL(url);
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") console.error("Share all failed:", err);
    }
  }

  if (dataURLs.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-black/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <div className="text-stone-400 text-sm">{index + 1} / {canvases.length}</div>
        <button
          onClick={onClose}
          className="text-stone-400 hover:text-white text-2xl leading-none"
        >×</button>
      </div>

      {/* Slide area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden px-4 relative select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Prev arrow */}
        {index > 0 && (
          <button
            onClick={prev}
            className="absolute left-2 z-10 text-white/60 hover:text-white text-3xl px-2 py-4"
          >‹</button>
        )}

        <img
          src={dataURLs[index]}
          alt={`Story card ${index + 1}`}
          className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
          draggable={false}
        />

        {/* Next arrow */}
        {index < canvases.length - 1 && (
          <button
            onClick={next}
            className="absolute right-2 z-10 text-white/60 hover:text-white text-3xl px-2 py-4"
          >›</button>
        )}
      </div>

      {/* Dot pagination */}
      {canvases.length > 1 && (
        <div className="flex justify-center gap-2 py-3 shrink-0">
          {canvases.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === index ? "bg-amber-400" : "bg-stone-600 hover:bg-stone-400"}`}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 px-4 pb-6 pt-2 shrink-0">
        <button
          onClick={() => shareOne(index)}
          className="flex-1 py-3 rounded-xl border border-stone-700 text-stone-300 text-sm hover:border-amber-800/50 hover:text-amber-200 transition-colors"
        >
          Share this one
        </button>
        {canvases.length > 1 && (
          <button
            onClick={shareAll}
            className="flex-1 py-3 rounded-xl bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm hover:bg-amber-900/50 transition-colors"
          >
            Share all ({canvases.length})
          </button>
        )}
      </div>
    </div>
  );
}
