# CrateMate Product Backlog

> Synthesized from two detailed product critiques. Goal: stay lean, prove product-market fit fast, and defer expensive work until there are real users willing to pay.

---

## Guiding Principles

1. **Sharp chef's knife, not a Swiss Army knife.** Ship one thing that collectors and DJs reach for every day. Defer everything else.
2. **Heuristics before AI.** Weighted dot-product recommendations (genre + decade + BPM bucket) ship in hours. Claude costs money per token — gate it behind a paid feature.
3. **Cache everything.** Discogs + Spotify + iTunes + MusicBrainz data lives in Supabase after the first fetch. Never call the same external API twice for the same record.
4. **PWA / offline-first is non-negotiable.** The app lives in the living room, next to the turntable. Network is unreliable. Plays must log offline and sync later.
5. **Anonymous before social.** Shareable crate links and anonymous crate comparison give the "social" feel without moderation overhead, notifications, or cold-start problems.
6. **Log 5 core events from day one** so you have real data before making roadmap bets: `import_complete`, `play_logged`, `session_saved`, `reco_clicked`, `discover_optin`.

---

## Priority A — Must-Have MVP
*Low effort, proves the core loop: import → play → stats → recommendations*

| # | Feature | Notes |
|---|---------|-------|
| A1 | **Discogs import** — full crate sync with progress indicator | Cache raw response in Supabase; never re-fetch unless user forces refresh |
| A2 | **Play logger** — tap to log a play, timestamp + record ID | Works offline; syncs on reconnect |
| A3 | **Session save** — group plays into a listening session | Minimum viable: start/end time + list of records played |
| A4 | **Heuristic recommendations** — "Play next" based on genre + decade + BPM bucket | Weighted dot-product, no external API needed |
| A5 | **Honeycomb / Drift view** — visual crate explorer | Make this the default **public crate URL** — it's the shareable "wow" moment |
| A6 | **Wantlist tab** — surface Discogs wantlist items with price context | High utility for collectors and DJs, low implementation effort |
| A7 | **PWA shell** — installable, offline play logging, background sync | Service worker + IndexedDB for queued plays |
| A8 | **Shareable crate link** — public read-only URL, no account required to view | Drives organic growth without building a full social layer |

---

## Priority B — High Value, Low/Medium Effort
*Add after Priority A is solid and users are returning*

| # | Feature | Notes |
|---|---------|-------|
| B1 | **Play history & stats dashboard** — plays per record, most-played genres, listening streaks | Query from Supabase; no new data needed |
| B2 | **Wantlist price alerts** — notify when a wantlist item drops below a threshold | Supabase edge function + cron; no paid worker needed |
| B3 | **Anonymous crate comparison** — "Your crate vs. theirs" overlap score | No accounts needed; compare by public crate URL |
| B4 | **BPM / key display** — show stored BPM and key on record cards | Pull from cached Discogs/MusicBrainz data; display only |
| B5 | **Session export** — export a session as a plain-text or PDF tracklist | Zero backend cost; client-side PDF generation |
| B6 | **Decade / genre filter in recommendations** — let users constrain the suggestion space | UI filter over the existing heuristic engine |
| B7 | **Deferred audio enrichment** — fetch Spotify audio features only when user taps "Analyze my crate" | Keep audio features nullable in schema; never block the main flow |

---

## Priority C — Deferred / Paid-Tier
*Ship only after there are real users and a revenue signal*

| # | Feature | Notes |
|---|---------|-------|
| C1 | **Claude-powered recommendations** — "Why this record?" natural-language explanations | Compact payload only: `{id, genre, decade, bpm_estimate, plays}`. Gate behind paid plan |
| C2 | **Social / Discover feed** — follow other collectors, see what they're playing | Expensive: moderation, notifications, critical mass. Pivot to anonymous comparison first (B3) |
| C3 | **Physics / infinite canvas crate view** | Beautiful but costly to build and maintain. Validate demand before investing |
| C4 | **Label / pressing detail enrichment** — full Discogs release page data per record | High API cost; only valuable to serious collectors. Good paid-tier feature |
| C5 | **DJ set builder** — drag-and-drop set planning with BPM/key transitions | Significant scope. Validate with power users first |
| C6 | **Mobile native app** (iOS/Android) | PWA covers 90% of the use case. Revisit after PMF |

---

## Recently Added

- **Apple Music + Tidal streaming match** — "From your Apple Music / Tidal" section in reco tab. OAuth connect, pull recent listening history, cross-reference against owned vinyl, surface what you stream but don't own. No audio features needed. YouTube Music has no viable public API — skip.
- **Blurred session UI** — free users see 3 blurred album art slots in trail view with Deep Cuts lock overlay
- **Blurred sound profile in detail card** — frosted overlay on audio radar for free users
- **Stripe paywall** — subscriptions table, webhook, checkout flow, customer portal

---

## Monetization Ideas

- **Free tier:** import up to 100 records, basic play logging, public crate link, heuristic recommendations
- **Collector tier (~$4/mo):** unlimited records, session history, wantlist price alerts, audio enrichment
- **DJ / Power tier (~$8/mo):** Claude recommendations, set builder, advanced stats, CSV/PDF exports
- **One-time tip:** "Buy me a record" button on the public crate page — low friction, brand-aligned

---

## Key Metrics to Watch from Day One

| Metric | Why it matters |
|--------|---------------|
| Imports completed | Top-of-funnel health |
| Plays logged per active user / week | Core loop engagement |
| Sessions saved | Depth of use — are people actually listening? |
| Reco clicked → play logged | Recommendation quality signal |
| Discover opt-in rate | Social / growth readiness signal |
| D7 / D30 retention | Whether the app is habit-forming |
| API cache hit rate | Cost control — should be > 90% after week 1 |

---

## Architecture / Cost Guardrails

- **Supabase as the single source of truth.** All external API responses (Discogs, Spotify, MusicBrainz) are cached on first fetch. TTL: 7 days for wantlist prices, 30 days for release metadata, indefinite for audio features.
- **No paid background workers.** Use Supabase edge functions + pg_cron for queued jobs (price alerts, sync retries).
- **Audio features are nullable.** Never block render or recommendations on Spotify data. Fetch lazily on user action only.
- **Compact Claude payloads.** If/when Claude is used: send `{id, genre, decade, bpm_estimate, plays}` only. Never send full release objects.
- **Rate-limit external calls per user.** Prevent a single power user from exhausting API quotas. Enforce in edge functions, not just the client.
- **IndexedDB for offline plays.** Queue locally, flush to Supabase on reconnect. Conflict resolution: last-write-wins on `played_at` timestamp.
