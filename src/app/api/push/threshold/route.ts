import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get("release_id");

  const query = supabase
    .from("wantlist_price_thresholds")
    .select("*")
    .eq("user_id", userId);

  if (releaseId) query.eq("release_id", parseInt(releaseId, 10));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { release_id, threshold_price, currency = "USD" } = body;
  if (!release_id || threshold_price == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("wantlist_price_thresholds")
    .upsert(
      { user_id: userId, release_id, threshold_price, currency, enabled: true },
      { onConflict: "user_id,release_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { release_id } = body;
  if (!release_id) return NextResponse.json({ error: "Missing release_id" }, { status: 400 });

  const { error } = await supabase
    .from("wantlist_price_thresholds")
    .delete()
    .eq("user_id", userId)
    .eq("release_id", release_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
