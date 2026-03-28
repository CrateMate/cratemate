import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: return all alert settings for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("wantlist_alert_settings")
    .select("*")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST: create or update an alert setting for a master_id
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { master_id, target_price_usd, enabled } = await request.json();
  if (!master_id) return NextResponse.json({ error: "Missing master_id" }, { status: 400 });

  // Check Pro status
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_pro")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.is_pro) {
    return NextResponse.json({ error: "Pro required" }, { status: 403 });
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    master_id,
    enabled: enabled ?? true,
  };
  if (target_price_usd != null) row.target_price_usd = target_price_usd;

  const { data: existing } = await supabase
    .from("wantlist_alert_settings")
    .select("id")
    .eq("user_id", userId)
    .eq("master_id", master_id)
    .maybeSingle();

  let data, error;
  if (existing) {
    ({ data, error } = await supabase
      .from("wantlist_alert_settings")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from("wantlist_alert_settings")
      .insert(row)
      .select()
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: remove an alert setting
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { master_id } = await request.json();
  if (!master_id) return NextResponse.json({ error: "Missing master_id" }, { status: 400 });

  const { error } = await supabase
    .from("wantlist_alert_settings")
    .delete()
    .eq("user_id", userId)
    .eq("master_id", master_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
