import { supabase } from "@/lib/supabase";
import { discogsRequest, DISCOGS_API } from "@/lib/discogs";
import { getMasterCache, upsertMasterCache, isMasterCacheFresh } from "@/lib/discogs/cache";

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

      for (const want of wants) {
        const basic = want.basic_information || {};
        const releaseId = Number(basic.id || want.id);
        if (!Number.isFinite(releaseId)) continue;

        const masterId = basic.master_id ? Number(basic.master_id) : null;
        const artists = Array.isArray(basic.artists) ? basic.artists : [];
        const artist = artists.map((a: { name?: string }) => a.name || "").filter(Boolean).join(", ");
        const genres = Array.isArray(basic.genres) ? basic.genres.join(", ") : "";
        const styles = Array.isArray(basic.styles) ? basic.styles.join(", ") : "";
        const formats = Array.isArray(basic.formats) ? basic.formats : [];
        const format = formats.map((f: { name?: string }) => f.name || "").filter(Boolean).join(", ");
        const labels = Array.isArray(basic.labels) ? basic.labels : [];
        const label = labels.map((l: { name?: string }) => l.name || "").filter(Boolean).join(", ");

        const row = {
          user_id: job.user_id,
          release_id: releaseId,
          master_id: masterId,
          artist,
          title: basic.title || "",
          year_pressed: basic.year ? Number(basic.year) : null,
          label,
          format,
          thumb: basic.thumb || basic.cover_image || "",
          genres,
          styles,
          notes: want.notes || "",
          added_at: want.date_added || null,
        };

        await supabase.from("wantlist").upsert(row, { onConflict: "user_id,release_id" });
        imported++;

        // Cross-ref with user's records — mark found if master_id matches
        if (masterId) {
          const { data: match } = await supabase
            .from("records")
            .select("id")
            .eq("user_id", job.user_id)
            .eq("master_id", masterId)
            .limit(1)
            .single();

          if (match) {
            await supabase
              .from("wantlist")
              .update({ found: true, found_record_id: match.id })
              .eq("user_id", job.user_id)
              .eq("release_id", releaseId);
          }

          // Cache master if not already cached
          const existingMaster = await getMasterCache(masterId);
          if (!existingMaster || !isMasterCacheFresh(existingMaster)) {
            await upsertMasterCache(masterId, {
              canonical_title: basic.title || "",
              canonical_artist: artist,
              year_original: basic.year ? Number(basic.year) : null,
              thumb: basic.thumb || basic.cover_image || "",
            });
          }
        }
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wantlist import failed";
    await supabase
      .from(JOB_TABLE)
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }
}
