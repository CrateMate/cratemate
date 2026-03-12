import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { discogsRequest, mapCollectionRelease, DISCOGS_API } from "@/lib/discogs";

function stripThumb<T extends Record<string, unknown>>(row: T): Omit<T, "thumb"> {
  const { thumb: _thumb, ...rest } = row as T & { thumb?: unknown };
  return rest;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tokenData, error: tokenError } = await supabase
    .from("discogs_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (tokenError) {
    console.error("Supabase select discogs_tokens error:", JSON.stringify(tokenError));
    return NextResponse.json({ error: "Failed to load Discogs connection" }, { status: 500 });
  }
  if (!tokenData) return NextResponse.json({ error: "Discogs not connected" }, { status: 400 });

  const { access_token, access_token_secret } = tokenData;
  let { discogs_username } = tokenData;

  // Ensure we have a username; older rows might not have it populated.
  if (!discogs_username) {
    const identityRes = await discogsRequest("GET", `${DISCOGS_API}/oauth/identity`, {
      tokenKey: access_token,
      tokenSecret: access_token_secret,
    });
    if (!identityRes.ok) {
      const text = await identityRes.text().catch(() => "");
      console.error("Discogs identity error:", identityRes.status, text);
      return NextResponse.json({ error: "Discogs connection is stale. Re-link Discogs." }, { status: 400 });
    }
    const identity = await identityRes.json();
    discogs_username = identity?.username || null;
    if (!discogs_username) {
      return NextResponse.json({ error: "Could not determine Discogs username. Re-link Discogs." }, { status: 400 });
    }
    await supabase.from("discogs_tokens").update({ discogs_username }).eq("user_id", userId);
  }

  // Look up the user's actual collection field IDs for Media/Sleeve Condition.
  // Discogs field IDs are not universally 1 and 2 — they depend on the order
  // the user created their custom collection fields.
  let mediaFieldId = 1;
  let sleeveFieldId = 2;
  try {
    const fieldsRes = await discogsRequest("GET", `${DISCOGS_API}/users/${encodeURIComponent(discogs_username)}/collection/fields`, {
      tokenKey: access_token,
      tokenSecret: access_token_secret,
    });
    if (fieldsRes.ok) {
      const fieldsData = await fieldsRes.json();
      const fields = Array.isArray(fieldsData?.fields) ? fieldsData.fields : [];
      for (const f of fields) {
        const name = (f.name || "").toLowerCase();
        if (name.includes("media")) mediaFieldId = Number(f.id) || mediaFieldId;
        else if (name.includes("sleeve") || name.includes("cover")) sleeveFieldId = Number(f.id) || sleeveFieldId;
      }
    }
  } catch { /* fall back to defaults */ }
  console.log("[import] condition field IDs — media:", mediaFieldId, "sleeve:", sleeveFieldId);

  const { data: existing, error: existingError } = await supabase
    .from("records")
    .select("id, discogs_id, discogs_instance_id, artist, title, thumb, condition")
    .eq("user_id", userId);
  if (existingError) {
    console.error("Supabase select records error:", JSON.stringify(existingError));
    return NextResponse.json({ error: "Failed to load existing records" }, { status: 500 });
  }

  const normalizeKey = (artist?: string | null, title?: string | null) => {
    const a = (artist || "").trim().toLowerCase();
    const t = (title || "").trim().toLowerCase();
    if (!a && !t) return "";
    return `${a}|${t}`;
  };

  // instance_ids already in DB — the source of truth for "already imported this copy"
  // Also track id + condition so we can backfill missing conditions on existing records
  const existingInstanceMap = new Map<number, { id: number; condition?: string | null }>();
  // discogs_id → list of DB rows without an instance_id yet (migration: link them on next import)
  const unlinkedByDiscogsId = new Map<number, Array<{ id: number; thumb?: string | null; condition?: string | null }>>();
  // manually added records (no discogs_id) — match by artist+title
  const manualByKey = new Map<string, { id: number; thumb?: string | null; condition?: string | null }>();

  for (const row of existing || []) {
    if (row.discogs_instance_id) {
      existingInstanceMap.set(row.discogs_instance_id, { id: row.id, condition: row.condition as string | null });
    } else if (row.discogs_id) {
      const arr = unlinkedByDiscogsId.get(row.discogs_id) || [];
      arr.push({ id: row.id, thumb: row.thumb as string | null, condition: row.condition as string | null });
      unlinkedByDiscogsId.set(row.discogs_id, arr);
    } else {
      const key = normalizeKey(row.artist, row.title);
      if (key) manualByKey.set(key, { id: row.id, thumb: row.thumb as string | null, condition: row.condition as string | null });
    }
  }

  async function fetchCollectionPage(url: string) {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await discogsRequest("GET", url, {
        tokenKey: access_token,
        tokenSecret: access_token_secret,
      });
      if (res.ok) return res;

      // Retry on transient errors/rate limiting.
      if (attempt < maxAttempts && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504)) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const delayMs = Number.isFinite(retryAfterSeconds)
          ? Math.min(10_000, Math.max(500, retryAfterSeconds * 1000))
          : 500 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return res;
    }
    // Should be unreachable, but keeps TS happy.
    return discogsRequest("GET", url, {
      tokenKey: access_token,
      tokenSecret: access_token_secret,
    });
  }

  // Fetch all collection pages (max 10 pages = 1000 records)
  const releases: Record<string, unknown>[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${DISCOGS_API}/users/${encodeURIComponent(discogs_username)}/collection/folders/0/releases?per_page=100&page=${page}`;
    const res = await fetchCollectionPage(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Discogs collection fetch error:", res.status, text);
      let message = "Failed to fetch Discogs collection";
      if (res.status === 401 || res.status === 403) {
        message = "Discogs auth failed. Re-link your Discogs account.";
      } else if (res.status === 404) {
        message = "Discogs user not found. Re-link your Discogs account.";
      } else if (res.status === 429) {
        message = "Discogs rate limited. Try again in a minute.";
      } else if (text) {
        message = `Discogs error ${res.status}: ${text}`;
      }
      return NextResponse.json({ error: message }, { status: 502 });
    }
    const data = await res.json();
    totalPages = data.pagination?.pages || 1;
    releases.push(...(data.releases || []));
    page++;
  } while (page <= totalPages && page <= 10);

  const mapped = releases.map((r) => mapCollectionRelease(r, mediaFieldId, sleeveFieldId));

  // Delete records whose instance_id is no longer in the Discogs collection.
  // Only touches records that have an instance_id — manually added records are never deleted.
  const collectionInstanceIds = new Set(mapped.map((r) => r.discogs_instance_id).filter(Boolean));
  const toDelete = (existing || [])
    .filter((row) => row.discogs_instance_id != null && !collectionInstanceIds.has(row.discogs_instance_id))
    .map((row) => row.id);

  let deleted = 0;
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("records")
      .delete()
      .in("id", toDelete)
      .eq("user_id", userId);
    if (deleteError) {
      console.error("Supabase delete records error:", JSON.stringify(deleteError));
    } else {
      deleted = toDelete.length;
    }
  }

  const toInsert: Record<string, unknown>[] = [];
  let updatedExisting = 0;
  // Collect condition backfills for existing records grouped by value (to batch by condition string)
  const conditionBackfill = new Map<string, number[]>(); // condition value → [db row ids]

  for (const record of mapped) {
    // Already have this exact copy (matched by instance_id) — backfill condition if missing, then skip.
    if (record.discogs_instance_id && existingInstanceMap.has(record.discogs_instance_id)) {
      const existingRow = existingInstanceMap.get(record.discogs_instance_id)!;
      if (!existingRow.condition && record.condition) {
        const ids = conditionBackfill.get(record.condition) || [];
        ids.push(existingRow.id);
        conditionBackfill.set(record.condition, ids);
      }
      continue;
    }

    // Migration: DB row has discogs_id but no instance_id yet — link it.
    if (record.discogs_id) {
      const unlinked = unlinkedByDiscogsId.get(record.discogs_id);
      if (unlinked && unlinked.length > 0) {
        const match = unlinked.shift()!;
        const patch: Record<string, unknown> = { discogs_instance_id: record.discogs_instance_id };
        if (!match.thumb && record.thumb) patch.thumb = record.thumb;
        if (!match.condition && record.condition) patch.condition = record.condition;
        const { error: updateError } = await supabase
          .from("records")
          .update(patch)
          .eq("id", match.id)
          .eq("user_id", userId);
        if (!updateError) { updatedExisting++; continue; }
      }
    }

    // Manually added record with matching artist+title — link it.
    const key = normalizeKey(record.artist, record.title);
    const manual = key ? manualByKey.get(key) : undefined;
    if (manual) {
      const patch: Record<string, unknown> = {
        discogs_id: record.discogs_id,
        discogs_instance_id: record.discogs_instance_id,
      };
      if (!manual.thumb && record.thumb) patch.thumb = record.thumb;
      if (!manual.condition && record.condition) patch.condition = record.condition;
      const { error: updateError } = await supabase
        .from("records")
        .update(patch)
        .eq("id", manual.id)
        .eq("user_id", userId);
      if (!updateError) { manualByKey.delete(key); updatedExisting++; continue; }
    }

    toInsert.push({ ...record, user_id: userId });
  }

  // Backfill missing conditions on existing records — one update per unique condition value
  for (const [condition, ids] of conditionBackfill) {
    const { error: condErr } = await supabase
      .from("records")
      .update({ condition })
      .in("id", ids)
      .eq("user_id", userId);
    if (!condErr) updatedExisting += ids.length;
  }

  if (toInsert.length === 0 && updatedExisting === 0) {
    return NextResponse.json({ imported: 0, total: releases.length, deleted });
  }

  let imported = 0;
  const CHUNK = 50;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    let { error } = await supabase.from("records").insert(chunk);
    if (error) {
      const msg = (error as { message?: string })?.message || "";
      if (msg.toLowerCase().includes("thumb") && msg.toLowerCase().includes("column")) {
        const stripped = chunk.map(stripThumb);
        ({ error } = await supabase.from("records").insert(stripped));
      }
      if (error) {
        console.error("Supabase insert records error:", JSON.stringify(error));
        return NextResponse.json({ error: (error as { message?: string })?.message || "Failed to save imported records" }, { status: 500 });
      }
    }
    imported += Math.min(CHUNK, toInsert.length - i);
  }

  // Clean up orphans: records that have a discogs_id but no instance_id after migration.
  // These are accidental duplicates from before instance_id support — the real copy got
  // its instance_id stamped above; the leftover copies couldn't be matched.
  const { data: orphans } = await supabase
    .from("records")
    .select("id")
    .eq("user_id", userId)
    .not("discogs_id", "is", null)
    .is("discogs_instance_id", null);

  let deduped = 0;
  if (orphans && orphans.length > 0) {
    const orphanIds = orphans.map((r) => r.id);
    const { error: orphanError } = await supabase
      .from("records")
      .delete()
      .in("id", orphanIds)
      .eq("user_id", userId);
    if (!orphanError) deduped = orphanIds.length;
  }

  return NextResponse.json({ imported, updated: updatedExisting, total: releases.length, deleted, deduped });
}
