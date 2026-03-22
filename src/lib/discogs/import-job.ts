import { supabase } from "@/lib/supabase";
import { DISCOGS_API, discogsRequest, mapCollectionRelease } from "@/lib/discogs";

// Metadata stored in the job's `warning` column as JSON.
// Using `warning` (existing text column) avoids any schema changes.
type ImportJobMeta = {
  media_field_id: number;
  sleeve_field_id: number;
  discogs_username: string;
  total_pages: number | null;
  // Accumulated instance_ids from all fetched pages — used for deletion at the end.
  seen_instance_ids: number[];
};

const JOB_TABLE = "discogs_sync_jobs";

function parseMeta(warning: string | null): ImportJobMeta {
  try {
    return JSON.parse(warning || "{}") as ImportJobMeta;
  } catch {
    return { media_field_id: 1, sleeve_field_id: 2, discogs_username: "", total_pages: null, seen_instance_ids: [] };
  }
}

export type ImportJob = {
  id: string;
  user_id: string;
  status: "running" | "completed" | "failed";
  batch_offset: number;   // pages fetched so far (0 = not started)
  processed: number;      // records fetched from Discogs (cumulative)
  updated: number;        // records inserted/updated in DB (cumulative)
  considered: number;     // total_pages * 100 (approximate total records)
  current_page: number;   // 1-indexed page being/last fetched
  total_pages: number | null;
  error?: string | null;
  created_at?: string;
  completed_at?: string | null;
};

export async function createImportJob({
  userId,
  discogsUsername,
  mediaFieldId,
  sleeveFieldId,
}: {
  userId: string;
  discogsUsername: string;
  mediaFieldId: number;
  sleeveFieldId: number;
}): Promise<ImportJob> {
  const meta: ImportJobMeta = {
    media_field_id: mediaFieldId,
    sleeve_field_id: sleeveFieldId,
    discogs_username: discogsUsername,
    total_pages: null,
    seen_instance_ids: [],
  };

  const { data, error } = await supabase
    .from(JOB_TABLE)
    .insert({
      user_id: userId,
      type: "import",
      mode: "full",
      force: false,
      batch_limit: 100,
      batch_offset: 0,
      status: "running",
      processed: 0,
      updated: 0,
      considered: 0,
      warning: JSON.stringify(meta),
      started_at: new Date().toISOString(),
    })
    .select();

  if (error) throw new Error(error.message);
  const row = (data || [])[0];
  return rowToJob(row);
}

export async function getImportJob(jobId: string, userId: string): Promise<ImportJob | null> {
  const { data } = await supabase
    .from(JOB_TABLE)
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("type", "import")
    .single();
  if (!data) return null;
  return rowToJob(data);
}

function rowToJob(row: Record<string, unknown>): ImportJob {
  const meta = parseMeta(row.warning as string | null);
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as ImportJob["status"],
    batch_offset: (row.batch_offset as number) || 0,
    processed: (row.processed as number) || 0,
    updated: (row.updated as number) || 0,
    considered: (row.considered as number) || 0,
    current_page: ((row.batch_offset as number) || 0) + 1,
    total_pages: meta.total_pages,
    error: row.error as string | null,
    created_at: row.created_at as string,
    completed_at: row.completed_at as string | null,
  };
}

// Fetches one Discogs collection page and processes it.
// Called once per client poll — stays well within Vercel's 10s function limit.
export async function runImportJobPage(jobId: string, userId: string): Promise<ImportJob> {
  const { data: jobRow } = await supabase
    .from(JOB_TABLE)
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!jobRow) throw new Error("Import job not found");
  if (jobRow.status === "completed" || jobRow.status === "failed") return rowToJob(jobRow);

  const meta = parseMeta(jobRow.warning as string | null);
  const currentPage = (jobRow.batch_offset as number) + 1;

  const { data: tokenData } = await supabase
    .from("discogs_tokens")
    .select("access_token, access_token_secret")
    .eq("user_id", userId)
    .single();

  if (!tokenData) throw new Error("Discogs not connected");

  const { access_token, access_token_secret } = tokenData;

  // Fetch one page from Discogs
  const pageUrl = `${DISCOGS_API}/users/${encodeURIComponent(meta.discogs_username)}/collection/folders/0/releases?per_page=100&page=${currentPage}`;
  const res = await discogsRequest("GET", pageUrl, {
    tokenKey: access_token,
    tokenSecret: access_token_secret,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const errMsg = `Discogs error ${res.status}${text ? `: ${text}` : ""}`;
    await supabase.from(JOB_TABLE).update({ status: "failed", error: errMsg, updated_at: new Date().toISOString() }).eq("id", jobId);
    throw new Error(errMsg);
  }

  const pageData = await res.json();
  const totalPages: number = pageData.pagination?.pages || 1;
  meta.total_pages = totalPages;

  const releases: Record<string, unknown>[] = pageData.releases || [];
  const mapped = releases.map((r) => mapCollectionRelease(r, meta.media_field_id, meta.sleeve_field_id));

  // Accumulate seen instance IDs for deletion cleanup at the end.
  for (const r of mapped) {
    if (r.discogs_instance_id != null) meta.seen_instance_ids.push(r.discogs_instance_id as number);
  }

  // Batch-fetch existing records matching this page's IDs — one query each
  const instanceIds = mapped.map((r) => r.discogs_instance_id).filter((id): id is number => id != null);
  const discogsIds = mapped.map((r) => r.discogs_id).filter((id): id is number => id != null);

  const [{ data: byInstance }, { data: byDiscogsId }] = await Promise.all([
    instanceIds.length > 0
      ? supabase
          .from("records")
          .select("id, discogs_id, discogs_instance_id, thumb, condition, genres, styles, year_pressed, year_original")
          .eq("user_id", userId)
          .in("discogs_instance_id", instanceIds)
      : Promise.resolve({ data: [] }),
    discogsIds.length > 0
      ? supabase
          .from("records")
          .select("id, discogs_id, discogs_instance_id, thumb, condition, year_pressed, year_original")
          .eq("user_id", userId)
          .in("discogs_id", discogsIds)
          .is("discogs_instance_id", null)
      : Promise.resolve({ data: [] }),
  ]);

  type ExRow = {
    id: number;
    discogs_id: number | null;
    discogs_instance_id: number | null;
    thumb?: string | null;
    condition?: string | null;
    genres?: string | null;
    styles?: string | null;
    year_pressed?: number | null;
    year_original?: number | null;
  };

  const instanceMap = new Map<number, ExRow>((byInstance || []).map((r) => [r.discogs_instance_id as number, r as ExRow]));
  const discogsIdMap = new Map<number, ExRow>((byDiscogsId || []).map((r) => [r.discogs_id as number, r as ExRow]));

  const isBadYear = (r: ExRow) =>
    r.year_original != null && r.year_pressed != null && r.year_original === r.year_pressed;

  let importedThisPage = 0;
  let updatedThisPage = 0;

  for (const record of mapped) {
    // Exact match by instance_id → backfill only
    if (record.discogs_instance_id != null && instanceMap.has(record.discogs_instance_id as number)) {
      const ex = instanceMap.get(record.discogs_instance_id as number)!;
      const patch: Record<string, unknown> = {};
      if (!ex.condition && record.condition) patch.condition = record.condition;
      if ((!ex.genres || !ex.styles) && (record.genres || record.styles)) {
        patch.genres = record.genres || "";
        patch.styles = record.styles || "";
      }
      if (record.year_pressed && (!ex.year_pressed || isBadYear(ex))) patch.year_pressed = record.year_pressed;
      if (Object.keys(patch).length > 0) {
        await supabase.from("records").update(patch).eq("id", ex.id).eq("user_id", userId);
        updatedThisPage++;
      }
      continue;
    }

    // Migration: has discogs_id but no instance_id yet → link it
    if (record.discogs_id != null && discogsIdMap.has(record.discogs_id as number)) {
      const ex = discogsIdMap.get(record.discogs_id as number)!;
      const patch: Record<string, unknown> = { discogs_instance_id: record.discogs_instance_id };
      if (!ex.thumb && record.thumb) patch.thumb = record.thumb;
      if (!ex.condition && record.condition) patch.condition = record.condition;
      if (record.year_pressed && (!ex.year_pressed || isBadYear(ex))) patch.year_pressed = record.year_pressed;
      await supabase.from("records").update(patch).eq("id", ex.id).eq("user_id", userId);
      discogsIdMap.delete(record.discogs_id as number);
      updatedThisPage++;
      continue;
    }

    // New record
    const { error: insertError } = await supabase.from("records").insert({
      ...record,
      user_id: userId,
      import_stage: 0,
    });
    if (!insertError) importedThisPage++;
  }

  const isLastPage = currentPage >= totalPages;
  let deleted = 0;
  let deduped = 0;

  if (isLastPage) {
    // Delete records whose instance_id was NOT seen in this import (removed from Discogs collection).
    const seenSet = new Set(meta.seen_instance_ids);
    const { data: allInstanced } = await supabase
      .from("records")
      .select("id, discogs_instance_id")
      .eq("user_id", userId)
      .not("discogs_instance_id", "is", null);

    const toDelete = (allInstanced || [])
      .filter((r) => r.discogs_instance_id != null && !seenSet.has(r.discogs_instance_id as number))
      .map((r) => r.id);

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from("records").delete().in("id", toDelete).eq("user_id", userId);
      if (!delErr) deleted = toDelete.length;
    }

    // Clean orphans: discogs_id set but no instance_id (leftover duplicates from pre-instance_id era)
    const { data: orphans } = await supabase
      .from("records")
      .select("id")
      .eq("user_id", userId)
      .not("discogs_id", "is", null)
      .is("discogs_instance_id", null);

    if (orphans && orphans.length > 0) {
      const { error: orpErr } = await supabase
        .from("records")
        .delete()
        .in("id", orphans.map((r) => r.id))
        .eq("user_id", userId);
      if (!orpErr) deduped = orphans.length;
    }
  }

  const newProcessed = (jobRow.processed as number) + releases.length;
  const newUpdated = (jobRow.updated as number) + importedThisPage + updatedThisPage;
  const newConsidered = totalPages * 100;

  const patch: Record<string, unknown> = {
    batch_offset: currentPage,
    processed: newProcessed,
    updated: newUpdated,
    considered: newConsidered,
    warning: JSON.stringify(meta),
    updated_at: new Date().toISOString(),
  };

  if (isLastPage) {
    patch.status = "completed";
    patch.completed_at = new Date().toISOString();
  }

  await supabase.from(JOB_TABLE).update(patch).eq("id", jobId);

  return {
    id: jobId,
    user_id: userId,
    status: (patch.status || "running") as ImportJob["status"],
    batch_offset: currentPage,
    processed: newProcessed,
    updated: newUpdated,
    considered: newConsidered,
    current_page: currentPage,
    total_pages: totalPages,
    error: null,
    // Extra fields for UI progress
    ...({ imported_this_page: importedThisPage, updated_this_page: updatedThisPage, deleted, deduped } as object),
  } as ImportJob;
}
