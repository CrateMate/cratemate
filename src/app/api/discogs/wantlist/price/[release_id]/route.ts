import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";
import { getPriceCache, upsertPriceCache, isPriceCacheFresh } from "@/lib/discogs/cache";

const CONDITIONS = new Set(["Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)"]);

function conditionLabel(cond: string | undefined): string | null {
  if (!cond) return null;
  if (cond === "Very Good Plus (VG+)") return "VG+";
  if (cond === "Near Mint (NM or M-)") return "NM";
  if (cond === "Mint (M)") return "M";
  return null;
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

  // Check cache first
  const cached = await getPriceCache(releaseId);
  if (cached && isPriceCacheFresh(cached)) {
    return NextResponse.json({
      min_price: cached.min_price,
      currency: cached.currency,
      condition: cached.condition,
      ships_from: cached.ships_from,
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
    const res = await discogsRequest(
      "GET",
      `${DISCOGS_API}/marketplace/price_suggestions/${releaseId}`,
      { tokenKey: access_token, tokenSecret: access_token_secret }
    );

    if (!res.ok) {
      await upsertPriceCache(releaseId, { min_price: null, currency: null, condition: null, ships_from: null });
      return NextResponse.json({ min_price: null });
    }

    const data = await res.json();

    // Find lowest price among VG+ and above
    const ORDERED = ["Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)"];
    let minPrice: number | null = null;
    let currency: string | null = null;
    let condition: string | null = null;

    for (const cond of ORDERED) {
      const entry = data[cond];
      if (entry && typeof entry.value === "number") {
        if (minPrice === null || entry.value < minPrice) {
          minPrice = entry.value;
          currency = entry.currency || "USD";
          condition = conditionLabel(cond);
        }
      }
    }

    // ships_from not available from price_suggestions — left null for future enhancement
    await upsertPriceCache(releaseId, { min_price: minPrice, currency, condition, ships_from: null });
    return NextResponse.json({ min_price: minPrice, currency, condition, ships_from: null });
  } catch {
    return NextResponse.json({ min_price: null });
  }
}
