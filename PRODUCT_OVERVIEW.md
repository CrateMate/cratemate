# CrateMate — Product Overview

> A web app for vinyl collectors to track, visualize, discover, and share their record collections.

---

## What It Is

CrateMate connects to a user's Discogs account and turns their vinyl collection into a living, visual experience. Users can see their records in an interactive honeycomb or grid, log every time they spin something, get AI-powered recommendations based on their Spotify listening, and share a public version of their collection with anyone — no account required to view.

The core emotional hook: vinyl collecting is a deeply personal hobby, but it's been stuck in spreadsheets and database exports. CrateMate makes the collection feel alive — visual, playful, social, and useful for everyday decisions like "what should I put on tonight?"

---

## Pages

### Landing Page — `/`

Public-facing marketing page, not behind auth. First impression for new users.

- Hero headline: *"Rediscover your crate"*
- Subheading: "Track what you spin. Discover what's next. Share your collection with the world."
- Two CTAs: "Get started free" and "Sign in"
- Animated screenshot marquee cycling through 9 real app screenshots: Crate, Wants, Hearts, History, Recommendations, Stats, Collection breakdown, Discover (social), Honeycomb view — gives visitors a real feel for the product before signing up
- Four feature cards explaining the main value props:
  1. Your whole collection — search 60M+ Discogs records, no separate Discogs account required
  2. Track every spin — plays, streaks, session history
  3. Discover what's next — AI + Spotify-powered recommendations from your own collection
  4. Share your crate — public profiles, discoverable by shared artists
- Footer with copyright and repeat CTAs

### Sign In / Sign Up — `/sign-in`, `/sign-up`

Auth pages powered by Clerk. Warm light-themed UI consistent with the brand. Users who are already signed in are redirected straight to `/app` — no unnecessary friction.

### Main App — `/app`

The full authenticated experience. All core features live here under a tab-based layout. Described in detail in the section below.

### Public Crate — `/crate/[username]`

A publicly shareable, read-only view of any user's collection. No account needed to visit. This is one of the primary growth surfaces — visitors arrive from a shared link and see a beautifully visualized collection before they've ever heard of the app.

- Shows the owner's collection (for-sale records excluded from the public view)
- Three view modes: Honeycomb, Grid, Tiles — toggle in the top right corner
- Honeycomb and Grid views support zoom controls (0.4x – 1.8x) so visitors can explore large collections
- Tap any record to open a detail card showing cover art, title, artist, year, and genre
- Header shows the owner's username, total record count, and a subtle CTA: *"Build your own crate — it's free →"*
- URL carries a `?view=` parameter matching the view the sender was in when they shared, so recipients land in the exact same layout — honeycomb link lands in honeycomb, tiles link lands in tiles, etc.
- Page is statically rendered and revalidates every 60 seconds (fast loads, always fresh)

### Artist Page — `/artist/[id]`

Requires login. A deep-dive page for any individual artist in the user's collection. Accessible by tapping an artist name from within the app.

- **Two-phase load**: instantly shows the records by that artist the user already owns, then fetches and overlays the artist's full Discogs discography in the background — so the page is immediately useful while it enriches
- **Discography overview**: releases are categorized into Studio Albums, EPs & Singles, and Live records
- **Ownership progress bar**: shows *"X of Y studio albums owned (Z%)"* — gamifies the collecting experience and gives completionists a clear target
- **Fan rankings — one of CrateMate's most distinctive features**: because CrateMate aggregates data across all users, it can rank every user who owns records by a given artist. The page shows:
  - Your rank by records owned (e.g. *"#3 fan by records"*) — how many of this artist's releases you own compared to every other CrateMate user
  - Your rank by plays (e.g. *"#1 fan by plays"*) — how many times you've logged spins of this artist's records compared to everyone else
  - This gives collectors a real sense of where they stand in a community of equally passionate fans — whether you're a casual listener or the definitive superfan of an obscure jazz artist on the platform
- Owned records are tappable and link back to the main crate view

---

## Main App Features (all within `/app`)

The app uses a tab bar at the bottom. Tabs: Crate, Wants, Hearts, History, Reco, Stats, Discover.

### Crate Tab — Visual Collection Views

The heart of the app. Three ways to visualize the collection, all sourced from the same record pool (for-sale records are always excluded from visual views):

**Honeycomb View**
- Records displayed as hexagonal cells arranged in a circular honeycomb pattern radiating from the center
- The layout is intentionally non-linear — it feels like looking at a physical crate from above rather than scrolling a list
- Sorted by genre cluster (the genre with the most records anchors the center) then by year within each genre
- Each genre gets a consistent color so the collection's musical shape is immediately readable at a glance
- Fully pannable by dragging and zoomable from 0.4x to 1.8x
- Toggle between the classic staggered honeycomb and a straight square grid layout

**Grid View**
- Same hexagonal cells as honeycomb but arranged in strict rows and columns with no offset — a more structured alternative for users who prefer order
- Same zoom and pan behavior as honeycomb

**Tile View**
- Records shown as rectangular album-art tiles where size reflects play count — records you spin more take up more visual space
- A record you've played 30 times dominates the screen; a record you've never touched stays small
- Max tile size is 3×3 units so no single record can overwhelm the layout
- A lookahead packing algorithm fills rows edge-to-edge: if a large tile leaves a gap, it finds a smaller tile that fits rather than leaving whitespace
- The result is a visual portrait of listening habits, not just ownership

**All visual views share:**
- Tap a record → detail sheet slides up showing full info, cover art, tracklist (if available), play history
- Long-press (500ms hold) → an action pill appears offering "Log a play" or "Start a session" without opening the full detail sheet — fast logging while browsing
- Sort controls: genre, year, play count, recently added, alphabetical
- A 👁 toggle that hides all controls for a clean full-screen view — useful for showing off the collection

### List View (within Crate Tab)

A traditional scrollable list for users who want to search and filter rather than browse visually.

- Search bar filters by title and artist in real time
- Genre filter pills for narrowing to a specific genre
- Sort options matching the visual views
- Each row shows: cover art, title, artist, play count, BPM (if Spotify connected), genre badge
- Long-press on any row → same action pill as the visual views
- For-sale records appear separately at the very bottom, under a *"📋 For Sale · N"* divider, so they're accessible but don't clutter the main browsing experience

### Wants Tab

The user's Discogs wantlist brought into CrateMate and enriched with live market data.

- Records grouped by master release to avoid showing 12 different pressings of the same album as 12 separate entries
- For each item: lowest current marketplace listing, Discogs price suggestion for that condition, and the percentage discount relative to market value
- **Price alert system**: users can set a deal threshold per record (e.g. "alert me when a copy appears ≥20% below the market average"). When the daily price check finds a qualifying listing, a push notification fires. This removes the need to manually check Discogs for deals — CrateMate watches the market on the user's behalf.
- Import wantlist from Discogs with one tap; stays in sync

### Hearts Tab

A curated view of the user's most beloved records and tracks.

- Records marked as favorites surface here
- Individual tracks within an album can be hearted from the detail sheet — those also appear here
- Acts as a quick-access "best of" view without having to search the full collection

### History Tab

A chronological log of every play session ever logged in the app.

- Each session shows the date, which records were played, and the total duration
- Sessions can be deleted if logged by mistake
- **Session story export**: any session can be exported as a set of shareable story cards (Spotify Wrapped-style). Three cards are generated:
  - Card 1 — "The Session": a mosaic of all the album art played, with the total count and duration
  - Card 2 — "Your Sound": dominant genre rendered as a vivid gradient with a decade badge (e.g. "Mostly 70s")
  - Card 3 — "Favorites": hearted tracks from the session, if any
  - Cards share via the native OS share sheet (Instagram Stories, WhatsApp, iMessage, etc.) — on desktop they download as PNGs

### Recommendations Tab (Reco)

Surfaces records from the user's own collection that are worth putting on, based on what they've been listening to lately.

- **Spotify-powered** (requires Spotify connection): analyzes the user's top 50 tracks (last 4 weeks) and 50 most recently played tracks, scores records in the collection that match the current listening mood, and returns up to 15 recommendations — with wantlist items flagged separately
- **Collection-based**: for users without Spotify, surfaces underplayed records from the crate — records owned but rarely or never spun
- For-sale records are excluded entirely from recommendations so the suggestions are always actionable

### Stats Tab

Two sub-sections giving the user a data portrait of their collection and habits:

**Session Stats**
- Most played records with play counts and streaks
- Listening activity over time
- Personal records (longest streak, most played in a day, etc.)

**Collection Stats**
- Genre breakdown showing the distribution of the collection by genre
- Decade breakdown — what era does the collection skew toward
- Format breakdown — LPs vs. 7"s vs. 12"s etc.
- Top artists by record count
- **Audio fingerprint** (if Spotify is connected): CrateMate fetches audio feature data (energy, valence, danceability, tempo) for records in the collection and averages them into a personality profile. The profile maps to plain-English descriptors — e.g. "High Energy", "Melancholic", "Danceable" — giving the user a concise read on what their collection actually sounds like as a whole
- For-sale records are excluded from all stats so the numbers reflect the active collection

### Discover Tab

Social layer for finding other collectors on the platform.

- Lists other CrateMate users who have opted into discoverability, sorted by how many artists they share with the current user — so the most relevant people appear first
- Tap any user → see the full overlap in detail: which artists you both own, which specific records, and a side-by-side audio profile comparison (if both users have Spotify data)
- Users control their own visibility via a discoverability toggle in their profile — opt in to appear, opt out to stay private

---

## Settings Menu (In-App)

Accessed via the ⚙ button in the app header. Foundation for app preferences.

- **Hide for-sale records** — when enabled, removes for-sale records from all visual views, the list view, recommendations, and stats. They become entirely invisible unless you turn this off. When disabled (default), for-sale records appear at the bottom of the list view under their own "For Sale" section, clearly separated from the main collection. Preference persists across sessions.

---

## Sharing

### Share Your Crate (Link)

The "↗ Share" button in the app header copies a URL to the clipboard. The link encodes the current view so recipients land in the exact layout the sender was using:
- `cratemate.app/crate/[username]?view=honeycomb`
- `cratemate.app/crate/[username]?view=grid`
- `cratemate.app/crate/[username]?view=tiles`

No account required to view. The page is fast-loading and works on any device.

### Share as Story Image

From the History tab, any play session can be turned into a swipeable multi-card story for social media. See the History Tab section above for card details.

---

## Integrations

### Discogs
Discogs is the world's largest vinyl marketplace and database (60M+ releases). CrateMate uses it as the source of truth for collection data.
- OAuth connection — users authorize CrateMate to read their Discogs account
- Full collection import with smart deduplication (handles multiple pressings of the same album)
- Auto-backfills condition, genre, and style metadata for records that are missing it
- Wantlist sync
- Live marketplace price data for wantlist items

### Spotify
- OAuth connection (read-only access: top tracks and recently played)
- Powers the Recommendations tab by analyzing recent listening patterns
- Fetches audio features per record (BPM, energy, valence, danceability) for the Stats audio fingerprint and the BPM column in list view
- No Spotify account required to use CrateMate — it enhances the experience but isn't mandatory

### Claude AI
- Used internally for recommendation scoring and collection analysis logic

---

## Push Notifications

Web Push — no native app download required. Works natively on desktop browsers and Android Chrome. On iOS, the user must add CrateMate to their Home Screen first (iOS 16.4+), and the app shows a banner explaining this for iOS Safari users.

- Per-wantlist-item price alerts with a user-set percentage threshold
- A daily automated job checks current Discogs marketplace prices against each user's thresholds
- Sends a push notification when a qualifying deal is found: *"A record on your wantlist is 23% below market at $18.50"*
- 24-hour cooldown per record to prevent repeated alerts for the same listing
- Expired or unsubscribed endpoints are cleaned up automatically

---

## PWA (Progressive Web App)

CrateMate is installable as a standalone app on both mobile and desktop — it behaves like a native app without going through an app store.

- Add to Home Screen on iOS and Android, or install from browser on desktop
- **Offline support**: if the user loses connectivity mid-session, play logs are queued locally (IndexedDB) and automatically synced to the server when the connection returns — no plays are lost
- Background sync ensures the queue drains reliably even if the user navigates away
- Full app icons, splash screens, and standalone display mode (no browser chrome)

---

## Themes

Four themes, cycling via a button in the app header. Preference persists in localStorage.

- **Dark** (default) — deep warm blacks, amber gold accents
- **Light** — warm beige backgrounds, dark amber/brown accents for readability
- **System** — follows the OS light/dark preference automatically
- **Personal** — user-defined accent color applied across the interface

---

## Tech Stack (for reference)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Auth | Clerk |
| Database | Supabase (Postgres) |
| Records data | Discogs API |
| Music features | Spotify API |
| AI | Claude (Anthropic) |
| Push notifications | Web Push (VAPID) |
| Hosting | Vercel (with Vercel Cron for daily price alerts) |
| Fonts | Cormorant Garamond (headings), DM Sans (body) |

---

## URL Structure Summary

| URL | Auth required | Description |
|---|---|---|
| `/` | No | Landing page |
| `/sign-in` | No | Login |
| `/sign-up` | No | Registration |
| `/app` | Yes | Main app (all tabs) |
| `/crate/[username]` | No | Public collection view |
| `/artist/[id]` | Yes | Artist detail + fan rankings |
