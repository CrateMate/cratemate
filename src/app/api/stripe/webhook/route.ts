import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  async function setProStatus(customerId: string, isPro: boolean, subscriptionId?: string) {
    const patch: Record<string, unknown> = { is_pro: isPro };
    if (subscriptionId !== undefined) patch.stripe_subscription_id = subscriptionId;
    await supabase
      .from("user_profiles")
      .update(patch)
      .eq("stripe_customer_id", customerId);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.customer) {
        await setProStatus(
          session.customer as string,
          true,
          session.subscription as string
        );
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const active = ["active", "trialing"].includes(sub.status);
      await setProStatus(sub.customer as string, active, sub.id);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setProStatus(sub.customer as string, false, sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
