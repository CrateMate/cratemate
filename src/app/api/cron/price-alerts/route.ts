export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";

const COOLDOWN_HOURS = 24;
const PRICE_DROP_THRESHOLD = 0.20; // 20% drop from rolling average
const PRICE_DROP_MIN_DAYS = 7;     // need 7+ days of history before alerting on drops

async function fetchLowestPrice(
  releaseId: number,
  tokenKey: string,
  tokenSecret: string
): Promise<number | null> {
  try {
    const res = await discogsRequest(
      "GET",
      `${DISCOGS_API}/marketplace/stats/${releaseId}?curr=USD&condition=Very+Good+Plus+(VG%2B)`,
      { tokenKey, tokenSecret }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.lowest_price && typeof data.lowest_price.value === "number") {
      return data.lowest_price.value;
    }
  } catch {}
  return null;
}

async function recordPriceHistory(releaseId: number, priceUsd: number) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("wantlist_price_history").upsert(
    { release_id: releaseId, price_usd: priceUsd, recorded_at: today },
    { onConflict: "release_id,recorded_at" }
  );
}

async function getRollingAverage(releaseId: number): Promise<{ avg: number; days: number } | null> {
  const { data } = await supabase
    .from("wantlist_price_history")
    .select("price_usd")
    .eq("release_id", releaseId)
    .gte("recorded_at", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10))
    .order("recorded_at", { ascending: false });

  if (!data || data.length === 0) return null;
  const avg = data.reduce((s, r) => s + Number(r.price_usd), 0) / data.length;
  return { avg, days: data.length };
}

async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  tag: string
): Promise<boolean> {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return false;

  const payload = JSON.stringify({ title, body, url: "/app", tag, renotify: true });
  let sent = false;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        payload
      );
      sent = true;
    } catch (err: unknown) {
      if ((err as { statusCode?: number })?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return sent;
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

  // Load all enabled alert settings (new system: per master_id)
  const { data: alerts, error: aErr } = await supabase
    .from("wantlist_alert_settings")
    .select("*")
    .eq("enabled", true);

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  if (!alerts || alerts.length === 0) return NextResponse.json({ checked: 0, notified: 0 });

  // Only process Pro users
  const userIds = [...new Set(alerts.map(a => a.user_id))];
  const { data: proProfiles } = await supabase
    .from("user_profiles")
    .select("user_id")
    .in("user_id", userIds)
    .eq("is_pro", true);
  const proUserIds = new Set((proProfiles || []).map(p => p.user_id));

  let checked = 0;
  let notified = 0;
  const details: Record<string, unknown>[] = [];

  for (const alert of alerts) {
    checked++;
    const entry: Record<string, unknown> = { master_id: alert.master_id, target_price_usd: alert.target_price_usd };

    if (!proUserIds.has(alert.user_id)) {
      entry.skip = "not Pro";
      details.push(entry);
      continue;
    }

    // Cooldown check
    if (alert.last_notified_at) {
      const hoursSince = (Date.now() - new Date(alert.last_notified_at).getTime()) / 3_600_000;
      if (hoursSince < COOLDOWN_HOURS) {
        entry.skip = `cooldown (${Math.round(hoursSince)}h ago)`;
        details.push(entry);
        continue;
      }
    }

    try {
      // Get user's Discogs tokens
      const { data: tokenData } = await supabase
        .from("discogs_tokens")
        .select("access_token, access_token_secret")
        .eq("user_id", alert.user_id)
        .single();

      if (!tokenData) { entry.skip = "no Discogs token"; details.push(entry); continue; }

      // Find all releases under this master
      const { data: releases } = await supabase
        .from("wantlist")
        .select("release_id, title, artist")
        .eq("user_id", alert.user_id)
        .eq("master_id", alert.master_id);

      if (!releases || releases.length === 0) {
        entry.skip = "no releases for master";
        details.push(entry);
        continue;
      }

      // Check each release, find the cheapest
      let cheapest: { release_id: number; price: number; title: string; artist: string } | null = null;

      for (const rel of releases) {
        const price = await fetchLowestPrice(rel.release_id, tokenData.access_token, tokenData.access_token_secret);
        if (price != null) {
          await recordPriceHistory(rel.release_id, price);
          if (!cheapest || price < cheapest.price) {
            cheapest = { release_id: rel.release_id, price, title: rel.title || "Unknown", artist: rel.artist || "" };
          }
        }
      }

      if (!cheapest) {
        entry.skip = "no price data for any release";
        details.push(entry);
        continue;
      }

      entry.cheapest_price = cheapest.price;
      entry.cheapest_release = cheapest.release_id;

      let reason: string | null = null;

      // Check 1: Price target — is it under the user's max price?
      if (alert.target_price_usd && cheapest.price <= Number(alert.target_price_usd)) {
        reason = `${cheapest.artist} — ${cheapest.title} is now $${cheapest.price.toFixed(2)}, under your $${Number(alert.target_price_usd).toFixed(2)} target.`;
        entry.trigger = "price_target";
      }

      // Check 2: Price drop — is it significantly below rolling average?
      if (!reason) {
        const rolling = await getRollingAverage(cheapest.release_id);
        if (rolling && rolling.days >= PRICE_DROP_MIN_DAYS) {
          const dropPct = (rolling.avg - cheapest.price) / rolling.avg;
          entry.rolling_avg = rolling.avg;
          entry.drop_pct = Math.round(dropPct * 100);
          if (dropPct >= PRICE_DROP_THRESHOLD) {
            reason = `${cheapest.artist} — ${cheapest.title} dropped to $${cheapest.price.toFixed(2)}, ${Math.round(dropPct * 100)}% below its recent average of $${rolling.avg.toFixed(2)}.`;
            entry.trigger = "price_drop";
          }
        }
      }

      if (!reason) {
        entry.skip = "no trigger met";
        details.push(entry);
        continue;
      }

      const sent = await sendPushNotification(
        alert.user_id,
        "CrateMate Price Alert",
        reason,
        `price-alert-${alert.master_id}`
      );

      if (sent) {
        notified++;
        entry.result = "notified";
        entry.reason = reason;
        await supabase.from("wantlist_alert_settings").update({ last_notified_at: new Date().toISOString() }).eq("id", alert.id);
      } else {
        entry.skip = "no push subscriptions";
      }
    } catch (err) {
      entry.error = String(err);
    }
    details.push(entry);
  }

  return NextResponse.json({ checked, notified, details });
}
