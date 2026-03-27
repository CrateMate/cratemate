import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ isPro: false });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_pro")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({ isPro: profile?.is_pro ?? false });
}
