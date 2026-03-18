import { supabase } from "@/lib/supabase";

export async function logEvent(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {}
) {
  try {
    await supabase.from("analytics_events").insert({ user_id: userId, event, properties });
  } catch {
    // fire-and-forget — never block user actions
  }
}
