import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";
import { getPriceCache, upsertPriceCache, isPriceCacheFresh } from "@/lib/discogs/cache";

function conditionLabel(cond: string | undefined): string | null {
  if (!cond) return null;
  if (cond === "Very Good Plus (VG+)") return "VG+";
  if (cond === "Near Mint (NM or M-)") return "NM";
  if (cond === "Mint (M)") return "M";
  return null;
}

function computeDealPct(suggested: number | null | undefined, lowestListing: number | null | undefined): number | null {
  if (!suggested || !lowestListing || lowestListing >= suggested) return null;
  // Sanity check: if the deal seems too good (>80%), the data is probably unreliable
  const pct = Math.round((suggested - lowestListing) / suggested * 100);
  if (pct > 80) return null;
  return pct;
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

  // Return from cache if fresh
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
    // Step 1: price suggestions (market rate per condition) — force USD
    const suggestionsRes = await discogsRequest(
      "GET",
      `${DISCOGS_API}/marketplace/price_suggestions/${releaseId}?curr=USD`,
      { tokenKey: access_token, tokenSecret: access_token_secret }
    );

    let minPrice: number | null = null;
    const currency = "USD";
    let condition: string | null = null;

    if (suggestionsRes.ok) {
      const suggestionsData = await suggestionsRes.json();
      const ORDERED = ["Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)"];
      for (const cond of ORDERED) {
        const entry = suggestionsData[cond];
        if (entry && typeof entry.value === "number") {
          if (minPrice === null || entry.value < minPrice) {
            minPrice = entry.value;
            condition = conditionLabel(cond);
          }
        }
      }
    }

    // Step 2: lowest listing price from marketplace stats — force USD
    let lowestListing: number | null = null;
    let numForSale: number | null = null;

    try {
      const statsRes = await discogsRequest(
        "GET",
        `${DISCOGS_API}/marketplace/stats/${releaseId}?curr=USD`,
        { tokenKey: access_token, tokenSecret: access_token_secret }
      );
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.lowest_price && typeof statsData.lowest_price.value === "number") {
          lowestListing = statsData.lowest_price.value;
        }
        if (typeof statsData.num_for_sale === "number") {
          numForSale = statsData.num_for_sale;
        }
      }
    } catch { /* best-effort */ }

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
