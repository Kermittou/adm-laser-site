import { after, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { annulerEnvoi, notifierClient, traiterCommande } from "@/lib/traitement-commande";

export const runtime = "nodejs";

/**
 * Webhook Stripe.
 *  - checkout.session.completed : commande payée (montant bloqué) → expédition Boxtal + bordereau,
 *    mail à l'atelier (DXF + bordereau), confirmation au client.
 *  - payment_intent.succeeded : l'atelier a capturé le paiement → mail « commande validée » au client.
 *  - payment_intent.canceled : l'atelier a annulé le paiement → l'expédition Boxtal est annulée et
 *    le client reçoit « commande annulée ».
 * Événements à cocher dans Stripe (Développeurs → Webhooks) : les trois ci-dessus.
 *
 * On répond à Stripe immédiatement ; le travail (Boxtal, mails) se fait ensuite, avec after().
 */
export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ ok: false }, { status: 503 });

  let evenement: Stripe.Event;
  try {
    evenement = s.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ ok: false, message: "signature invalide" }, { status: 400 });
  }

  if (evenement.type === "checkout.session.completed") {
    const session = evenement.data.object as Stripe.Checkout.Session;
    after(() => traiterCommande(s, session).catch((e) => console.error(`[webhook] commande ${session.id} :`, e)));
  } else if (evenement.type === "payment_intent.succeeded") {
    const pi = evenement.data.object as Stripe.PaymentIntent;
    after(() => notifierClient(s, pi, "validee").catch((e) => console.error(`[webhook] validation ${pi.id} :`, e)));
  } else if (evenement.type === "payment_intent.canceled") {
    const pi = evenement.data.object as Stripe.PaymentIntent;
    after(async () => {
      await annulerEnvoi(pi).catch((e) => console.error(`[webhook] annulation ${pi.id} :`, e));
      await notifierClient(s, pi, "annulee").catch((e) => console.error(`[webhook] mail d'annulation ${pi.id} :`, e));
    });
  }

  return NextResponse.json({ ok: true });
}
