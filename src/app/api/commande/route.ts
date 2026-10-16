import { NextResponse } from "next/server";
import { ipDe, tropDEnvois } from "@/lib/anti-abus";
import { construireCommande } from "@/lib/commande";
import { libelleCotes, libellePiece } from "@/lib/devis/resume";
import type { Piece } from "@/lib/devis/types";
import { adresseUneLigne, SITE_URL, site } from "@/lib/site";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

const erreur = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });
const repli = `Demandez votre devis, écrivez-nous à ${site.email} ou appelez le ${site.telephone}.`;

/**
 * Crée une session Stripe Checkout pour la configuration reçue.
 * Paiement en deux temps : le montant est BLOQUÉ à la commande (capture manuelle), puis encaissé
 * par ADM depuis le tableau de bord Stripe après validation de la pièce par l'atelier.
 */
export async function POST(req: Request) {
  let corps: { piece?: Partial<Piece>; livraison?: string; envoi?: string; cgv?: boolean };
  try {
    corps = await req.json();
  } catch {
    return erreur("La commande n'a pas pu être lue. Réessayez.");
  }
  if (corps.cgv !== true) return erreur("Merci d'accepter les conditions générales de vente pour commander.");

  const p = corps.piece ?? {};
  const piece: Piece = {
    matiere: String(p.matiere ?? ""),
    nuance: String(p.nuance ?? ""),
    epaisseur_mm: Number(p.epaisseur_mm),
    forme: String(p.forme ?? ""),
    dimensions: Object.fromEntries(Object.entries(p.dimensions ?? {}).map(([k, v]) => [k, Number(v)])),
    quantite: Number(p.quantite),
  };

  // Montants recalculés ici : le navigateur n'envoie que la configuration, jamais un prix.
  const envoi = corps.envoi === "colis" || corps.envoi === "palette" ? corps.envoi : undefined;
  const commande = construireCommande(piece, String(corps.livraison ?? ""), envoi);
  if (!commande.ok) return erreur(commande.message);

  const s = stripe();
  if (!s) {
    console.error("[commande] STRIPE_SECRET_KEY absente : paiement en ligne indisponible.");
    return erreur(`Le paiement en ligne est momentanément indisponible. ${repli}`, 503);
  }
  if (tropDEnvois(`commande:${ipDe(req)}`)) return erreur(`Trop de tentatives en peu de temps. ${repli}`, 429);

  const origine = process.env.NODE_ENV === "production" ? SITE_URL : new URL(req.url).origin;
  const r = commande.resultat;
  const libelle = `${piece.quantite} × ${libellePiece(piece)}`;
  const metadata = {
    piece: JSON.stringify(piece).slice(0, 500),
    total_pieces_ht: r.total_ht.toFixed(2),
    livraison: commande.livraison.libelle,
    livraison_cle: commande.livraison.cle,
    envoi: commande.livraison.envoi?.type ?? "",
    expedition: commande.livraison.retrait
      ? `retrait à l'atelier — ${commande.expedition.poids_kg} kg — pièce la plus longue ${commande.expedition.longueur_mm} mm`
      : commande.livraison.envoi?.type === "palette"
        ? `palette (${commande.livraison.envoi.transporteur}) — ${commande.expedition.poids_facture_kg} kg facturés — pièce la plus longue ${commande.expedition.longueur_mm} mm`
        : `${commande.expedition.colis.length} colis (${commande.expedition.colis.map((c) => c.quantite).join(" + ")} pièces) — ${commande.expedition.poids_facture_kg} kg facturés — pièce la plus longue ${commande.expedition.longueur_mm} mm`,
    livraison_ht: commande.livraison.prix_ht.toFixed(2),
    total_ht: commande.total_ht.toFixed(2),
  };

  try {
    const session = await s.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      allowed_payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: commande.centimes.pieces,
            product_data: {
              name: libelle,
              description: libelleCotes(piece),
            },
          },
        },
      ],
      // Retrait à l'atelier : pas d'adresse de livraison ni de frais d'expédition.
      ...(commande.livraison.retrait
        ? {}
        : {
            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount" as const,
                  display_name: [
                    commande.livraison.libelle,
                    commande.livraison.envoi?.type === "palette" ? "sur palette" : `${commande.expedition.colis.length} colis`,
                  ].join(" — "),
                  fixed_amount: { amount: commande.centimes.livraison, currency: "eur" },
                },
              },
            ],
            shipping_address_collection: { allowed_countries: ["FR" as const] },
          }),
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      tax_id_collection: { enabled: true },
      customer_creation: "always",
      payment_intent_data: {
        capture_method: "manual",
        description: `Commande en ligne — ${libelle}`,
        metadata,
      },
      metadata,
      custom_text: {
        submit: {
          message: commande.livraison.retrait
            ? `Retrait gratuit à l'atelier : ${adresseUneLigne}. Le montant est bloqué sur votre carte, puis débité seulement après validation de votre commande ; nous vous prévenons dès qu'elle est prête.`
            : "Livraison en France métropolitaine continentale (hors Corse et DOM-TOM). Le montant est bloqué sur votre carte, puis débité seulement après validation de votre commande par notre atelier.",
        },
      },
      success_url: `${origine}/commande/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origine}/devis`,
    });
    if (!session.url) throw new Error("session sans URL");
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error("[commande] création de session Stripe impossible", e);
    return erreur(`Le paiement en ligne n'a pas pu démarrer. ${repli}`, 502);
  }
}
