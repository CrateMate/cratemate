"use client";
import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      setVisible(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#1a1814",
        border: "1px solid #3a3530",
        borderRadius: "0.75rem",
        padding: "0.75rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        maxWidth: "calc(100vw - 2rem)",
      }}
    >
      {isIOS ? (
        <span style={{ color: "#d4c5a9", fontSize: "0.875rem" }}>
          Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install
        </span>
      ) : prompt ? (
        <>
          <span style={{ color: "#d4c5a9", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
            Add CrateMate to your home screen
          </span>
          <button
            onClick={install}
            style={{
              background: "#c9a84c",
              color: "#0c0b09",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.4rem 0.9rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Install
          </button>
        </>
      ) : (
        <span style={{ color: "#d4c5a9", fontSize: "0.875rem" }}>
          Tap <strong>⋮</strong> → <strong>Add to Home Screen</strong> to install
        </span>
      )}
      <button
        onClick={() => setVisible(false)}
        style={{
          background: "transparent",
          border: "none",
          color: "#6b6560",
          cursor: "pointer",
          fontSize: "1rem",
          lineHeight: 1,
          padding: "0 0.25rem",
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
