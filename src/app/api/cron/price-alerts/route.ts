export const runtime = "nodejs";

import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";
import { getPriceCache, upsertPriceCache, isPriceCacheFresh } from "@/lib/discogs/cache";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";

const QUALIFYING_CONDITIONS = new Set(["Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)"]);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:hello@cratemate.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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
    const listingsRes = await discogsRequest(
      "GET",
      `${DISCOGS_API}/marketplace/search?release_id=${releaseId}&sort=price&sort_order=asc&per_page=100`,
      { tokenKey, tokenSecret }
    );
    if (listingsRes.ok) {
      const listingsData = await listingsRes.json();
      const qualifying = (listingsData.results || []).filter(
        (l: { condition?: string; price?: { value?: number } }) =>
          l.condition && QUALIFYING_CONDITIONS.has(l.condition) && typeof l.price?.value === "number"
      );
      if (qualifying.length > 0) {
        lowestListing = Math.min(...qualifying.map((l: { price: { value: number } }) => l.price.value));
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

  const { data: thresholds, error: tErr } = await supabase
    .from("wantlist_price_thresholds")
    .select("*")
    .eq("enabled", true);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!thresholds || thresholds.length === 0) return NextResponse.json({ checked: 0, notified: 0 });

  let checked = 0;
  let notified = 0;
  const COOLDOWN_HOURS = 24;

  for (const threshold of thresholds) {
    checked++;
    try {
      // Get user's Discogs tokens
      const { data: tokenData } = await supabase
        .from("discogs_tokens")
        .select("access_token, access_token_secret")
        .eq("user_id", threshold.user_id)
        .single();

      if (!tokenData) continue;

      // Get or refresh price
      let priceData: { lowest_listing: number | null; min_price: number | null; currency: string | null };
      const cached = await getPriceCache(threshold.release_id);
      if (cached && isPriceCacheFresh(cached) && cached.lowest_listing !== undefined) {
        priceData = {
          lowest_listing: cached.lowest_listing ?? null,
          min_price: cached.min_price ?? null,
          currency: cached.currency ?? null,
        };
      } else {
        priceData = await fetchLivePrice(
          threshold.release_id,
          tokenData.access_token,
          tokenData.access_token_secret
        );
      }

      const { lowest_listing, currency } = priceData;
      if (lowest_listing == null) continue;
      if (lowest_listing >= threshold.threshold_price) continue;

      // Check cooldown
      if (threshold.last_notified_at) {
        const hoursSince = (Date.now() - new Date(threshold.last_notified_at).getTime()) / 3_600_000;
        if (hoursSince < COOLDOWN_HOURS) continue;
      }

      // Get user's push subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", threshold.user_id);

      if (!subs || subs.length === 0) continue;

      const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
      const payload = JSON.stringify({
        title: "CrateMate Price Alert",
        body: `A record on your wantlist dropped to ${currencySymbol}${lowest_listing.toFixed(2)} — below your ${currencySymbol}${threshold.threshold_price} threshold.`,
        url: "/app",
        tag: `price-alert-${threshold.release_id}`,
      });

      let sentOne = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
            },
            payload
          );
          sentOne = true;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410) {
            // Subscription expired — clean up
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }

      if (sentOne) {
        notified++;
        await supabase
          .from("wantlist_price_thresholds")
          .update({ last_notified_at: new Date().toISOString() })
          .eq("id", threshold.id);
      }
    } catch (err) {
      console.error(`Price alert failed for threshold ${threshold.id}:`, err);
    }
  }

  return NextResponse.json({ checked, notified });
}
