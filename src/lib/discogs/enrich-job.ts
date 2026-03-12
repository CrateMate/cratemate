import { supabase } from "@/lib/supabase";
import { enrichPage } from "@/lib/discogs/enrich";

type EnrichJobStatus = "pending" | "running" | "completed" | "failed";
type EnrichJobRow = {
  id: string;
  user_id: string;
  mode: "full" | "thumb";
  force: boolean;
  batch_limit: number;
  batch_offset: number | null;
  status: EnrichJobStatus;
  processed: number;
  updated: number;
  considered: number;
  warning?: string | null;
  error?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

const JOB_TABLE = "discogs_sync_jobs";

export async function createEnrichJob({
  userId,
  mode = "full",
  limit = 200,
  force = false,
}: {
  userId: string;
  mode?: "full" | "thumb";
  limit?: number;
  force?: boolean;
}) {
  const { data, error } = await supabase.from(JOB_TABLE).insert({
    user_id: userId,
    mode,
    force,
    batch_limit: limit,
    batch_offset: 0,
    status: "pending",
    processed: 0,
    updated: 0,
    considered: 0,
  }).select();

  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }
  return (data || [])[0] as EnrichJobRow;
}

export async function getEnrichJob(jobId: string, userId: string) {
  const { data } = await supabase.from(JOB_TABLE).select("*").eq("id", jobId).eq("user_id", userId).single();
  return data as EnrichJobRow | null;
}

export async function runEnrichJob(jobId: string) {
  const { data: job } = await supabase.from(JOB_TABLE).select("*").eq("id", jobId).single();
  if (!job) return;

  const userId = job.user_id;
  const mode: "full" | "thumb" = job.mode === "thumb" ? "thumb" : "full";
  const limit = job.batch_limit || 200;
  const force = !!job.force;
  let offset = job.batch_offset ?? 0;
  let processed = job.processed || 0;
  let updated = job.updated || 0;
  let considered = job.considered || 0;

  await supabase
    .from(JOB_TABLE)
    .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    while (true) {
      const page = await enrichPage({ userId, mode, limit, offset, force });
      processed += page.processed;
      updated += page.updated;
      considered += page.considered;
      offset = page.next_offset ?? null;

      await supabase.from(JOB_TABLE).update({
        processed,
        updated,
        considered,
        warning: page.warning,
        batch_offset: offset,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      if (!offset) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    await supabase.from(JOB_TABLE).update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    await supabase.from(JOB_TABLE).update({
      status: "failed",
      error: message,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}
