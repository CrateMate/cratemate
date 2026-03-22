"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const ThemeContext = createContext({ theme: "dark", setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(t) {
  const html = document.documentElement;
  if (t === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    html.setAttribute("data-theme", t);
  }
}

function captureCurrentBg() {
  const root = document.documentElement;
  const inlineBg = root.style.getPropertyValue("--bg-app");
  if (inlineBg) return inlineBg;
  return (
    getComputedStyle(root).getPropertyValue("--bg-app").trim() ||
    "linear-gradient(160deg, #1c1610 0%, #0c0b09 100%)"
  );
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("cratemate_theme") || "dark";
  });
  // overlay: null | { bg: string, collapsed: boolean }
  const [overlay, setOverlay] = useState(null);
  const cleanupRef = useRef(null);

  // Apply theme on mount (lazy init already set the state value)
  useEffect(() => { applyTheme(theme); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t) {
    if (t === theme) return;

    if (cleanupRef.current) { clearTimeout(cleanupRef.current); cleanupRef.current = null; }

    // Snapshot old background before switching
    const oldBg = captureCurrentBg();

    // Switch theme — body background updates immediately to new theme
    setThemeState(t);
    localStorage.setItem("cratemate_theme", t);
    applyTheme(t);

    // Overlay carries the OLD background, sits at z-index 0 (behind all content)
    // It starts covering the full screen, then collapses toward BR — revealing
    // the new background from TL without touching the UI layer above
    setOverlay({ bg: oldBg, collapsed: false });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverlay(prev => prev ? { ...prev, collapsed: true } : null);
      });
    });

    cleanupRef.current = setTimeout(() => {
      setOverlay(null);
      cleanupRef.current = null;
    }, 650);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/*
        Background wash overlay — z-index 0, behind the content wrapper below.
        Carries the OLD theme's background and collapses toward the bottom-right,
        revealing the new theme background (on body) from top-left.
      */}
      {overlay && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background: overlay.bg,
            clipPath: overlay.collapsed
              ? "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)"
              : "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            transition: overlay.collapsed
              ? "clip-path 0.58s cubic-bezier(0.77, 0, 0.175, 1)"
              : "none",
          }}
        />
      )}
      {/*
        Content wrapper — z-index 1, always above the background overlay.
        UI elements, modals, toasts (z-index 50+) all live inside here
        and are never obscured by the background animation.
      */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
