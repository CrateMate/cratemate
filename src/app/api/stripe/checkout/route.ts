import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { returnUrl, interval } = await request.json();
  const origin = new URL(returnUrl || request.headers.get("origin") || "http://localhost:3000").origin;

  const priceId = interval === "year"
    ? process.env.STRIPE_PRICE_ID_ANNUAL!
    : process.env.STRIPE_PRICE_ID_MONTHLY!;

  // Get or create Stripe customer linked to this user
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id, discogs_username")
    .eq("user_id", userId)
    .single();

  let customerId: string = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { userId, discogs_username: profile?.discogs_username ?? "" },
    });
    customerId = customer.id;
    await supabase
      .from("user_profiles")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", userId);
  }

  const trialDays = interval === "year" ? 14 : 7;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?pro=success`,
    cancel_url: `${origin}/?pro=cancel`,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    customer_update: { address: "auto" },
    subscription_data: {
      trial_period_days: trialDays,
    },
  });

  return NextResponse.json({ url: session.url });
}
