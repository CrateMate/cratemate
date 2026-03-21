---
name: C1 Spotify listening history recommendation
description: User wants to elevate C1 - use Spotify listening history to recommend vinyl purchases
type: project
---

User explicitly wants to elevate this idea from C1 deferred to near-term roadmap:
"Hey, you've been listening to X on Spotify — you should get this album on vinyl."

**Why:** High-value personalisation that bridges digital listening with physical collecting. Very on-brand for CrateMate.

**How to apply:** When planning B/C feature work, treat this as a priority B item. Requires Spotify OAuth (user account), not just client credentials. Would need: Spotify OAuth flow, store user tokens, fetch recently played/top tracks, cross-reference with Discogs catalog, surface as a recommendation card in the Reco tab.
