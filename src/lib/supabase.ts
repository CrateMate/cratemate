import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-initialized so the module can be imported at build time
// without crashing when env vars aren't available yet.
let _client: SupabaseClient | null = null;

// Server-side client using service role key (bypasses RLS — safe since
// all callers are Clerk-authenticated API routes that filter by user_id)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }
    return (_client as any)[prop];
  },
});
