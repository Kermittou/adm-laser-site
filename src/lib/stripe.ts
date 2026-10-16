import "server-only";
import Stripe from "stripe";

/**
 * Client Stripe côté serveur. Clés par variables d'environnement (voir .env.example) —
 * en développement, uniquement des clés de TEST (sk_test_…).
 */
let client: Stripe | null = null;

export function stripe(): Stripe | null {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return null;
  client ??= new Stripe(cle);
  return client;
}

/** Lien vers le paiement dans le tableau de bord Stripe (mode test ou réel selon la clé). */
export function lienTableauDeBord(paymentIntentId: string): string {
  const test = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "test/" : "";
  return `https://dashboard.stripe.com/${test}payments/${paymentIntentId}`;
}
