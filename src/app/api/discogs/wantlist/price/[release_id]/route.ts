import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";
import { getPriceCache, upsertPriceCache, isPriceCacheFresh } from "@/lib/discogs/cache";

// Conditions that count as "acceptable" for deal detection (VG+ minimum)
const QUALIFYING_CONDITIONS = new Set(["Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)"]);

function conditionLabel(cond: string | undefined): string | null {
  if (!cond) return null;
  if (cond === "Very Good Plus (VG+)") return "VG+";
  if (cond === "Near Mint (NM or M-)") return "NM";
  if (cond === "Mint (M)") return "M";
  return null;
}

/** How far below the market suggestion the cheapest qualifying listing is (0–100, or null). */
function computeDealPct(suggested: number | null | undefined, lowestListing: number | null | undefined): number | null {
  if (!suggested || !lowestListing || lowestListing >= suggested) return null;
  return Math.round((suggested - lowestListing) / suggested * 100);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ release_id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { release_id } = await params;
  const releaseId = parseInt(release_id, 10);
  if (!Number.isFinite(releaseId)) return NextResponse.json({ error: "Invalid release_id" }, { status: 400 });

  // Return from cache if fresh and already has listing data
  const cached = await getPriceCache(releaseId);
  if (cached && isPriceCacheFresh(cached) && cached.lowest_listing !== undefined) {
    return NextResponse.json({
      min_price: cached.min_price,
      currency: cached.currency,
      condition: cached.condition,
      ships_from: cached.ships_from,
      lowest_listing: cached.lowest_listing,
      num_for_sale: cached.num_for_sale,
      deal_pct: computeDealPct(cached.min_price, cached.lowest_listing),
    });
  }

  // Fetch user tokens
  const { data: tokenData } = await supabase
    .from("discogs_tokens")
    .select("access_token, access_token_secret")
    .eq("user_id", userId)
    .single();

  if (!tokenData) return NextResponse.json({ error: "Discogs not connected" }, { status: 400 });

  const { access_token, access_token_secret } = tokenData;

  try {
    // --- Step 1: price suggestions (market rate per condition) ---
    const suggestionsRes = await discogsRequest(
      "GET",
      `${DISCOGS_API}/marketplace/price_suggestions/${releaseId}`,
      { tokenKey: access_token, tokenSecret: access_token_secret }
    );

    if (!suggestionsRes.ok) {
      await upsertPriceCache(releaseId, { min_price: null, currency: null, condition: null, ships_from: null, lowest_listing: null, num_for_sale: null });
      return NextResponse.json({ min_price: null });
    }

    const suggestionsData = await suggestionsRes.json();

    // Lowest suggested price among VG+ and above (= our market rate baseline)
    const ORDERED = ["Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)"];
    let minPrice: number | null = null;
    let currency: string | null = null;
    let condition: string | null = null;

    for (const cond of ORDERED) {
      const entry = suggestionsData[cond];
      if (entry && typeof entry.value === "number") {
        if (minPrice === null || entry.value < minPrice) {
          minPrice = entry.value;
          currency = entry.currency || "USD";
          condition = conditionLabel(cond);
        }
      }
    }

    // --- Step 2: cheapest active VG+ or better listing (condition-aware deal detection) ---
    let lowestListing: number | null = null;
    let numForSale: number | null = null;

    try {
      const listingsRes = await discogsRequest(
        "GET",
        `${DISCOGS_API}/marketplace/search?release_id=${releaseId}&sort=price&sort_order=asc&per_page=100`,
        { tokenKey: access_token, tokenSecret: access_token_secret }
      );

      if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        const allListings: Array<{ condition?: string; price?: { value?: number } }> = listingsData.results || [];
        const qualifying = allListings.filter(
          (l) => l.condition && QUALIFYING_CONDITIONS.has(l.condition) && typeof l.price?.value === "number"
        );
        numForSale = qualifying.length;
        if (qualifying.length > 0) {
          lowestListing = Math.min(...qualifying.map((l) => l.price!.value as number));
        }
      }
    } catch { /* fall through — deal detection is best-effort */ }

    const deal_pct = computeDealPct(minPrice, lowestListing);

    await upsertPriceCache(releaseId, {
      min_price: minPrice,
      currency,
      condition,
      ships_from: null,
      lowest_listing: lowestListing,
      num_for_sale: numForSale,
    });

    return NextResponse.json({ min_price: minPrice, currency, condition, ships_from: null, lowest_listing: lowestListing, num_for_sale: numForSale, deal_pct });
  } catch {
    return NextResponse.json({ min_price: null });
  }
}
