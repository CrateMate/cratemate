export const runtime = "nodejs";

import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";
import { getPriceCache, upsertPriceCache, isPriceCacheFresh } from "@/lib/discogs/cache";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";

// Stats endpoint returns the absolute lowest listing price across all conditions

async function fetchLivePrice(
  releaseId: number,
  tokenKey: string,
  tokenSecret: string
): Promise<{ lowest_listing: number | null; min_price: number | null; currency: string | null }> {
  const suggestionsRes = await discogsRequest(
    "GET",
    `${DISCOGS_API}/marketplace/price_suggestions/${releaseId}`,
    { tokenKey, tokenSecret }
  );

  let minPrice: number | null = null;
  let currency: string | null = null;

  if (suggestionsRes.ok) {
    const data = await suggestionsRes.json();
    const ORDERED = ["Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)"];
    for (const cond of ORDERED) {
      const entry = data[cond];
      if (entry && typeof entry.value === "number") {
        if (minPrice === null || entry.value < minPrice) {
          minPrice = entry.value;
          currency = entry.currency || "USD";
        }
      }
    }
  }

  let lowestListing: number | null = null;
  try {
    const statsRes = await discogsRequest(
      "GET",
      `${DISCOGS_API}/marketplace/stats/${releaseId}`,
      { tokenKey, tokenSecret }
    );
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      if (statsData.lowest_price && typeof statsData.lowest_price.value === "number") {
        lowestListing = statsData.lowest_price.value;
      }
    }
  } catch { /* best-effort */ }

  await upsertPriceCache(releaseId, {
    min_price: minPrice,
    currency,
    condition: null,
    ships_from: null,
    lowest_listing: lowestListing,
    num_for_sale: null,
  });

  return { lowest_listing: lowestListing, min_price: minPrice, currency };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:hello@cratemate.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data: thresholds, error: tErr } = await supabase
    .from("wantlist_price_thresholds")
    .select("*")
    .eq("enabled", true);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!thresholds || thresholds.length === 0) return NextResponse.json({ checked: 0, notified: 0 });

  let checked = 0;
  let notified = 0;
  const COOLDOWN_HOURS = 24;
  const details: Record<string, unknown>[] = [];

  for (const threshold of thresholds) {
    checked++;
    const entry: Record<string, unknown> = { release_id: threshold.release_id, threshold_deal_pct: threshold.threshold_deal_pct };
    try {
      // Get user's Discogs tokens
      const { data: tokenData } = await supabase
        .from("discogs_tokens")
        .select("access_token, access_token_secret")
        .eq("user_id", threshold.user_id)
        .single();

      if (!tokenData) { entry.skip = "no Discogs token"; details.push(entry); continue; }

      // Get or refresh price
      let priceData: { lowest_listing: number | null; min_price: number | null; currency: string | null };
      const cached = await getPriceCache(threshold.release_id);
      if (cached && isPriceCacheFresh(cached) && cached.lowest_listing != null) {
        priceData = { lowest_listing: cached.lowest_listing ?? null, min_price: cached.min_price ?? null, currency: cached.currency ?? null };
        entry.price_source = "cache";
      } else {
        priceData = await fetchLivePrice(threshold.release_id, tokenData.access_token, tokenData.access_token_secret);
        entry.price_source = "live";
      }

      const { lowest_listing, min_price, currency } = priceData;
      entry.min_price = min_price;
      entry.lowest_listing = lowest_listing;

      if (lowest_listing == null || min_price == null || min_price === 0) {
        entry.skip = "no price data";
        details.push(entry);
        continue;
      }

      const dealPct = Math.round((min_price - lowest_listing) / min_price * 100);
      entry.deal_pct = dealPct;

      if (dealPct < threshold.threshold_deal_pct) {
        entry.skip = `deal ${dealPct}% < threshold ${threshold.threshold_deal_pct}%`;
        details.push(entry);
        continue;
      }

      // Check cooldown
      if (threshold.last_notified_at) {
        const hoursSince = (Date.now() - new Date(threshold.last_notified_at).getTime()) / 3_600_000;
        if (hoursSince < COOLDOWN_HOURS) {
          entry.skip = `cooldown (notified ${Math.round(hoursSince)}h ago)`;
          details.push(entry);
          continue;
        }
      }

      // Get user's push subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", threshold.user_id);

      if (!subs || subs.length === 0) {
        entry.skip = "no push subscriptions";
        details.push(entry);
        continue;
      }

      entry.subscriptions = subs.length;
      const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
      const payload = JSON.stringify({
        title: "CrateMate Price Alert",
        body: `A record on your wantlist is ${dealPct}% below market at ${currencySymbol}${lowest_listing.toFixed(2)} — you set an alert at ≥${threshold.threshold_deal_pct}% off.`,
        url: "/app",
        tag: `price-alert-${threshold.release_id}`,
      });

      let sentOne = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } }, payload);
          sentOne = true;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
          entry.send_error = String(err);
        }
      }

      if (sentOne) {
        notified++;
        entry.result = "notified";
        await supabase.from("wantlist_price_thresholds").update({ last_notified_at: new Date().toISOString() }).eq("id", threshold.id);
      }
    } catch (err) {
      entry.error = String(err);
      console.error(`Price alert failed for threshold ${threshold.id}:`, err);
    }
    details.push(entry);
  }

  return NextResponse.json({ checked, notified, details });
}
