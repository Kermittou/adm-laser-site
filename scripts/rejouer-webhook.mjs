/**
 * Rejoue en local un webhook Stripe — DÉVELOPPEMENT, MODE TEST.
 *
 * Sans le Stripe CLI, Stripe ne peut pas joindre http://localhost. Ce script récupère le vrai
 * événement chez Stripe (clé de test), le signe avec STRIPE_WEBHOOK_SECRET (.env.local) et le
 * poste au site local, exactement comme Stripe le ferait.
 *
 *   npm run webhook:rejouer                 → dernière commande payée (checkout.session.completed)
 *   npm run webhook:rejouer -- cs_test_…    → une session précise
 *   npm run webhook:rejouer -- annulation   → dernier paiement annulé (payment_intent.canceled) :
 *                                             le site annule les envois Boxtal et prévient le client
 *   npm run webhook:rejouer -- validation   → dernier paiement capturé (payment_intent.succeeded) :
 *                                             le site envoie « commande validée » au client
 *
 * Variable optionnelle : WEBHOOK_URL (défaut http://localhost:3000/api/stripe/webhook).
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import Stripe from "stripe";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2")]),
);

const cle = env.STRIPE_SECRET_KEY ?? "";
if (!cle.startsWith("sk_test_")) {
  console.error("Ce script ne fonctionne qu'avec une clé Stripe de TEST (sk_test_…) dans .env.local.");
  process.exit(1);
}
const secret = env.STRIPE_WEBHOOK_SECRET;
if (!secret) {
  console.error("STRIPE_WEBHOOK_SECRET est vide dans .env.local : le site refuserait l'événement.");
  process.exit(1);
}

const stripe = new Stripe(cle);
const arg = process.argv[2];
const annulation = arg === "annulation";
const validation = arg === "validation";
const sessionVoulue = annulation || validation ? undefined : arg;
const type = annulation ? "payment_intent.canceled" : validation ? "payment_intent.succeeded" : "checkout.session.completed";
const { data } = await stripe.events.list({ type, limit: 20 });
const evenement = sessionVoulue ? data.find((e) => e.data.object.id === sessionVoulue) : data[0];
if (!evenement) {
  console.error(
    annulation
      ? "Aucun paiement annulé trouvé : annulez d'abord le paiement dans le tableau de bord Stripe (mode test)."
      : validation
        ? "Aucun paiement capturé trouvé : capturez d'abord un paiement dans le tableau de bord Stripe (mode test)."
        : sessionVoulue
        ? `Aucun paiement trouvé pour ${sessionVoulue}.`
        : "Aucune commande payée trouvée chez Stripe (mode test).",
  );
  process.exit(1);
}

const corps = JSON.stringify(evenement);
const t = Math.floor(Date.now() / 1000);
const signature = createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex");
const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/stripe/webhook";

const reponse = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${signature}` },
  body: corps,
});
const objet = evenement.data.object;
const montant = (objet.amount_total ?? objet.amount ?? 0) / 100;
console.log(`Événement ${evenement.type} ${evenement.id} (${objet.id}, ${montant} € TTC) → ${url}`);
console.log(`Réponse du site : ${reponse.status} ${await reponse.text()}`);
