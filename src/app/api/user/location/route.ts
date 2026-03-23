import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_profiles")
    .select("city_name, latitude, longitude")
    .eq("user_id", userId)
    .single();

  return NextResponse.json(data ?? { city_name: null, latitude: null, longitude: null });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { city_name, latitude, longitude } = await request.json();
  if (!city_name || latitude == null || longitude == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, city_name, latitude, longitude },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
