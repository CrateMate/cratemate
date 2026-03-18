import { supabase } from "@/lib/supabase";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";
import { logEvent } from "@/lib/analytics";

const JOB_TABLE = "wantlist_import_jobs";

export async function createWantlistImportJob(userId: string) {
  const { data, error } = await supabase
    .from(JOB_TABLE)
    .insert({ user_id: userId, status: "pending", page: 1, imported: 0, total: 0 })
    .select()
    .single();
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as { id: string; user_id: string; status: string };
}

export async function getWantlistImportJob(jobId: string, userId: string) {
  const { data } = await supabase
    .from(JOB_TABLE)
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  return data;
}

export async function runWantlistImportJob(jobId: string) {
  const { data: job } = await supabase.from(JOB_TABLE).select("*").eq("id", jobId).single();
  if (!job) return;

  await supabase
    .from(JOB_TABLE)
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const { data: tokenData } = await supabase
      .from("discogs_tokens")
      .select("*")
      .eq("user_id", job.user_id)
      .single();

    if (!tokenData) throw new Error("Discogs not connected");

    const { access_token, access_token_secret, discogs_username } = tokenData;
    if (!discogs_username) throw new Error("Discogs username missing — re-link Discogs");

    // Load all user's master_ids once upfront for cross-referencing
    const { data: userRecords } = await supabase
      .from("records")
      .select("id, master_id")
      .eq("user_id", job.user_id)
      .not("master_id", "is", null);

    const masterIdToRecordId = new Map<number, string>();
    for (const r of userRecords || []) {
      if (r.master_id) masterIdToRecordId.set(Number(r.master_id), r.id);
    }

    let page = 1;
    let totalPages = 1;
    let imported = 0;
    let total = 0;

    do {
      const url = `${DISCOGS_API}/users/${encodeURIComponent(discogs_username)}/wants?per_page=100&page=${page}`;
      const res = await discogsRequest("GET", url, { tokenKey: access_token, tokenSecret: access_token_secret });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Discogs wants fetch error ${res.status}${text ? `: ${text}` : ""}`);
      }

      const data = await res.json();
      totalPages = data.pagination?.pages || 1;
      total = data.pagination?.items || 0;
      const wants = Array.isArray(data.wants) ? data.wants : [];

      // Map all wants on this page into rows — no per-item DB calls
      const rows = [];
      for (const want of wants) {
        const basic = want.basic_information || {};
        const releaseId = Number(basic.id || want.id);
        if (!Number.isFinite(releaseId)) continue;

        const masterId = basic.master_id ? Number(basic.master_id) : null;
        const artists = Array.isArray(basic.artists) ? basic.artists : [];
        const artist = artists.map((a: { name?: string }) => a.name || "").filter(Boolean).join(", ");
        const formats = Array.isArray(basic.formats) ? basic.formats : [];
        const labels = Array.isArray(basic.labels) ? basic.labels : [];

        const foundRecordId = masterId ? (masterIdToRecordId.get(masterId) ?? null) : null;

        rows.push({
          user_id: job.user_id,
          release_id: releaseId,
          master_id: masterId,
          artist,
          title: basic.title || "",
          year_pressed: basic.year ? Number(basic.year) : null,
          label: labels.map((l: { name?: string }) => l.name || "").filter(Boolean).join(", "),
          format: formats.map((f: { name?: string }) => f.name || "").filter(Boolean).join(", "),
          thumb: basic.thumb || basic.cover_image || "",
          genres: Array.isArray(basic.genres) ? basic.genres.join(", ") : "",
          styles: Array.isArray(basic.styles) ? basic.styles.join(", ") : "",
          notes: want.notes || "",
          added_at: want.date_added || null,
          found: foundRecordId !== null,
          found_record_id: foundRecordId,
        });
      }

      // One batch upsert for the entire page
      if (rows.length > 0) {
        await supabase.from("wantlist").upsert(rows, { onConflict: "user_id,release_id" });
        imported += rows.length;
      }

      await supabase
        .from(JOB_TABLE)
        .update({ page, total_pages: totalPages, imported, total, updated_at: new Date().toISOString() })
        .eq("id", jobId);

      page++;
    } while (page <= totalPages);

    await supabase
      .from(JOB_TABLE)
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    logEvent(job.user_id, "wantlist_import_complete", { imported, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wantlist import failed";
    await supabase
      .from(JOB_TABLE)
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }
}
