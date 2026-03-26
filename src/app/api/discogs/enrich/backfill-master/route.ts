import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { DISCOGS_API, USER_AGENT, discogsRequest } from "@/lib/discogs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get records missing master_id
  const { data: records } = await supabase
    .from("records")
    .select("id, discogs_id")
    .eq("user_id", userId)
    .is("master_id", null)
    .not("discogs_id", "is", null);

  if (!records || records.length === 0) {
    return NextResponse.json({ updated: 0, message: "No records need backfill" });
  }

  const needsIds = new Set(records.map(r => r.discogs_id));

  // Step 1: Try the metadata cache first (free, no API calls)
  const { data: cacheRows } = await supabase
    .from("discogs_metadata_cache")
    .select("release_id, master_id")
    .in("release_id", [...needsIds])
    .not("master_id", "is", null)
    .gt("master_id", 0);

  const masterMap = new Map<number, number>();
  for (const c of cacheRows || []) {
    masterMap.set(c.release_id, c.master_id);
    needsIds.delete(c.release_id);
  }

  // Step 2: For remaining records, fetch from Discogs collection API (returns master_id per release)
  if (needsIds.size > 0) {
    const { data: tokenRow } = await supabase
      .from("discogs_tokens")
      .select("access_token, access_token_secret, discogs_username")
      .eq("user_id", userId)
      .maybeSingle();

    if (tokenRow?.discogs_username) {
      let page = 1;
      const perPage = 100;
      while (needsIds.size > 0) {
        const url = `${DISCOGS_API}/users/${tokenRow.discogs_username}/collection/folders/0/releases?per_page=${perPage}&page=${page}`;
        try {
          const res = await discogsRequest("GET", url, {
            tokenKey: tokenRow.access_token,
            tokenSecret: tokenRow.access_token_secret,
          });
          if (!res.ok) break;
          const data = await res.json();
          const releases = data?.releases || [];
          if (releases.length === 0) break;

          for (const rel of releases) {
            const info = rel.basic_information || {};
            const releaseId = Number(info.id);
            const masterId = Number(info.master_id);
            if (releaseId && masterId > 0 && needsIds.has(releaseId)) {
              masterMap.set(releaseId, masterId);
              needsIds.delete(releaseId);
            }
          }

          if (!data.pagination || page >= data.pagination.pages) break;
          page++;
        } catch {
          break;
        }
      }
    }
  }

  // Step 3: Write master_id to records
  let updated = 0;
  for (const record of records) {
    const masterId = masterMap.get(record.discogs_id);
    if (!masterId) continue;
    const { error } = await supabase
      .from("records")
      .update({ master_id: masterId })
      .eq("id", record.id);
    if (!error) updated++;
  }

  return NextResponse.json({ updated, total: records.length });
}
