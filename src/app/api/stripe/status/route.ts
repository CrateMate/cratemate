import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ isPro: false });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_pro, stripe_subscription_id")
    .eq("user_id", userId)
    .single();

  const result: { isPro: boolean; trialEnd: string | null } = {
    isPro: profile?.is_pro ?? false,
    trialEnd: null,
  };

  // Fetch trial_end from Stripe if user has an active subscription
  if (profile?.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      if (sub.trial_end) {
        result.trialEnd = new Date(sub.trial_end * 1000).toISOString();
      }
    } catch { /* subscription may have been deleted */ }
  }

  return NextResponse.json(result);
}
