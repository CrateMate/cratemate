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
  // Prefer the JS-set inline variable (personal theme uses this)
  const inlineBg = root.style.getPropertyValue("--bg-app");
  if (inlineBg) return inlineBg;
  // Fall back to computed (picks up CSS-defined --bg-app)
  return getComputedStyle(root).getPropertyValue("--bg-app").trim() ||
    "linear-gradient(160deg, #1c1610 0%, #0c0b09 100%)";
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  // overlay: null | { bg: string, collapsed: boolean }
  const [overlay, setOverlay] = useState(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("cratemate_theme") || "dark";
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t) {
    if (t === theme) return;

    // Cancel any in-flight transition
    if (cleanupRef.current) { clearTimeout(cleanupRef.current); cleanupRef.current = null; }

    // Snapshot the current background before switching
    const oldBg = captureCurrentBg();

    // Show overlay covering the whole screen with the OLD theme
    setOverlay({ bg: oldBg, collapsed: false });

    // Switch theme immediately — new theme renders underneath
    setThemeState(t);
    localStorage.setItem("cratemate_theme", t);
    applyTheme(t);

    // Two rAFs to ensure the overlay is painted at full-screen before we animate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Collapse all 4 corners toward the bottom-right — diagonal wipe from TL→BR
        setOverlay(prev => prev ? { ...prev, collapsed: true } : null);
      });
    });

    // Remove overlay after the CSS transition finishes
    cleanupRef.current = setTimeout(() => {
      setOverlay(null);
      cleanupRef.current = null;
    }, 620);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
      {overlay && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
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
    </ThemeContext.Provider>
  );
}
