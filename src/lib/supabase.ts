import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client using service role key (bypasses RLS — safe since
// all callers are Clerk-authenticated API routes that filter by user_id)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
