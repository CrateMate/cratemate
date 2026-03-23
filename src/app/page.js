"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SCREENSHOTS = [
  { name: "crate", label: "Crate" },
  { name: "wants", label: "Wants" },
  { name: "hearts", label: "Hearts" },
  { name: "history", label: "History" },
  { name: "reco", label: "Reco" },
  { name: "stats-listening", label: "Stats" },
  { name: "stats-collection", label: "Collection" },
  { name: "discover", label: "Discover" },
  { name: "honeycomb", label: "Honeycomb" },
];

function PhoneFrame({ src, label, style }) {
  return (
    <div
      style={{ width: 200, flexShrink: 0, ...style }}
      className="relative aspect-[9/19] rounded-[2.5rem] overflow-hidden border border-white/[0.08] bg-white/[0.03]"
    >
      <img
        src={src}
        alt={label}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-stone-700 text-xs">{label}</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const query = window.location.search;
      router.replace(query ? `/app${query}` : "/app");
    }
  }, [isLoaded, isSignedIn, router]);

  const marqueeItems = [...SCREENSHOTS, ...SCREENSHOTS];

  return (
    <div
      className="min-h-screen text-[#e8ddd0]"
      style={{ background: "linear-gradient(160deg, #1c1610 0%, #0c0b09 100%)" }}
    >
      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 flex flex-col md:flex-row items-center gap-12">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="CrateMate"
              width={48}
              height={48}
              className="rounded-xl"
            />
            <span
              className="text-2xl tracking-tight"
              style={{ fontFamily: "'Fraunces', serif", color: "#fef3c7" }}
            >
              CrateMate
            </span>
          </div>

          <h1
            className="text-5xl md:text-6xl leading-tight"
            style={{
              fontFamily: "'Fraunces', serif",

              fontWeight: 700,
              color: "#fbbf24",
            }}
          >
            Rediscover your crate.
          </h1>

          <p
            className="text-lg text-stone-400 leading-relaxed max-w-md"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Track what you spin. Discover what&rsquo;s next.
            <br />
            Share your collection with the world.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/sign-up"
              className="px-6 py-3 rounded-xl font-medium transition-all"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                background: "#fbbf24",
                color: "#0c0b09",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f59e0b")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#fbbf24")}
            >
              Get started free →
            </Link>
            <Link
              href="/sign-in"
              className="px-6 py-3 rounded-xl font-medium border border-white/[0.12] transition-all hover:bg-white/[0.05]"
              style={{ fontFamily: "'DM Sans', sans-serif", color: "#e8ddd0" }}
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Right — hero phone */}
        <div className="flex-1 flex justify-center md:justify-end">
          <div style={{ width: 240 }}>
            <div
              className="relative rounded-[2.5rem] overflow-hidden border border-white/[0.08] bg-white/[0.03]"
              style={{ aspectRatio: "9/19" }}
            >
              <img
                src="/screenshots/honeycomb.png"
                alt="CrateMate honeycomb view"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── SCREENSHOT MARQUEE ── */}
      <section className="py-10 overflow-hidden">
        <style>{`
          @keyframes marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            gap: 16px;
            width: max-content;
            animation: marquee 40s linear infinite;
          }
          .marquee-track:hover {
            animation-play-state: paused;
          }
        `}</style>
        <div className="marquee-track">
          {marqueeItems.map((s, i) => (
            <PhoneFrame
              key={i}
              src={`/screenshots/${s.name}.png`}
              label={s.label}
            />
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: "🎵",
              title: "Your whole collection",
              body: "Discogs sync or search 60M+ records. No Discogs account needed.",
            },
            {
              icon: "📈",
              title: "Track every spin",
              body: "Plays, streaks, and session history so you always know what you've been spinning.",
            },
            {
              icon: "✦",
              title: "Discover what's next",
              body: "AI + Spotify recs built from your actual listening — not generic charts.",
            },
            {
              icon: "🌐",
              title: "Share your crate",
              body: "Public profiles. Let others find you by shared artists and genres.",
            },
          ].map(({ icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl p-6 border border-white/[0.06] bg-white/[0.03] flex flex-col gap-2"
            >
              <div className="text-2xl">{icon}</div>
              <h3
                className="text-lg font-semibold"
                style={{ fontFamily: "'Fraunces', serif", color: "#fef3c7" }}
              >
                {title}
              </h3>
              <p
                className="text-stone-400 text-sm leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p
            className="text-stone-500 text-sm"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            CrateMate &middot; Made for vinyl heads
          </p>
          <div className="flex gap-3">
            <Link
              href="/sign-up"
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                background: "#fbbf24",
                color: "#0c0b09",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f59e0b")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#fbbf24")}
            >
              Get started free
            </Link>
            <Link
              href="/sign-in"
              className="px-5 py-2 rounded-lg text-sm font-medium border border-white/[0.12] transition-all hover:bg-white/[0.05]"
              style={{ fontFamily: "'DM Sans', sans-serif", color: "#e8ddd0" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
