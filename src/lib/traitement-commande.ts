import "server-only";
import type Stripe from "stripe";
import { annulerExpedition, boxtalConfigure, CONFIG_BOXTAL, construireExpedition, creerExpedition, recupererBordereau } from "@/lib/boxtal";
import { expedition, EXPEDITION, horsZone } from "@/lib/commande";
import { devis } from "@/lib/devis/moteur";
import type { Piece } from "@/lib/devis/types";
import { envoyerMail, mailPossible } from "@/lib/mail";
import { mailAtelier, mailClient, mailSuiviClient, plusJoursOuvres, referenceCommande, type Adresse as AdresseCommande, type BordereauColis, type DonneesCommande } from "@/lib/mail-commande";
import { site } from "@/lib/site";
import { lienTableauDeBord } from "@/lib/stripe";


/**
 * Traitement d'une commande payée : bordereaux Boxtal, mail à l'atelier (DXF + bordereaux),
 * confirmation au client. Appelé par le webhook Stripe, et en développement par la page
 * « Commande reçue » (Stripe ne peut pas joindre localhost).
 *
 * Une commande n'est traitée qu'une fois : une marque est posée sur le paiement Stripe
 * (metadata.commande_traitee) ; elle est retirée si le traitement échoue, pour pouvoir le rejouer.
 */
type Adresse = { line1?: string | null; line2?: string | null; postal_code?: string | null; city?: string | null; country?: string | null } | null | undefined;
const adresse = (a: Adresse): AdresseCommande | null =>
  a ? { ligne1: a.line1, ligne2: a.line2, codePostal: a.postal_code, ville: a.city, pays: a.country } : null;

/** AAAA-MM-JJ à l'heure de Paris. */
const dateIso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

/** Données d'une commande telles que Stripe les a enregistrées (session de paiement). */
function donneesDepuisSession(session: Stripe.Checkout.Session, bordereau?: DonneesCommande["bordereau"]): DonneesCommande {
  const client = session.customer_details;
  const livraison = session.collected_information?.shipping_details;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const reference = referenceCommande(session.id);
  const date = new Date(session.created * 1000);
  let piece: Piece | null = null;
  try {
    piece = JSON.parse(session.metadata?.piece ?? "") as Piece;
  } catch {
    /* configuration illisible : le mail atelier le signale */
  }
  return {
    reference,
    date,
    piece,
    livraison: { cle: session.metadata?.livraison_cle, libelle: session.metadata?.livraison, prixHt: session.metadata?.livraison_ht, envoi: session.metadata?.envoi },
    montantTtc: (session.amount_total ?? 0) / 100,
    lienPaiement: paymentIntentId ? lienTableauDeBord(paymentIntentId) : undefined,
    client: {
      nom: client?.name,
      societe: client?.business_name,
      email: client?.email,
      telephone: client?.phone,
      tva: client?.tax_ids?.map((t) => t.value).join(", ") || null,
      facturation: adresse(client?.address),
    },
    destinataire: livraison ? { nom: livraison.name, adresse: adresse(livraison.address) } : null,
    bordereau,
  };
}

async function traiterCommandeUneFois(s: Stripe, session: Stripe.Checkout.Session) {
  const client = session.customer_details;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const base = donneesDepuisSession(session);
  const { reference, date, piece } = base;

  // Retrait à l'atelier : pas d'envoi, donc pas de bordereau.
  const retrait = Boolean(EXPEDITION.options.find((o) => o.cle === session.metadata?.livraison_cle)?.retrait);
  const bordereau = retrait ? undefined : await preparerBordereau(s, { session, piece, reference, date, paymentIntentId });
  const donnees: DonneesCommande = { ...base, bordereau };

  if (!mailPossible()) {
    console.error(`[webhook] commande ${reference} reçue mais SMTP non configuré : aucun mail envoyé.`);
    return;
  }

  const atelier = mailAtelier(donnees);
  await envoyerMail({
    sujet: atelier.sujet,
    texte: atelier.texte,
    piecesJointes: atelier.piecesJointes,
    repondreA: client?.email ?? undefined,
    destinataire: process.env.MAIL_COMMANDES || site.emailCommandes,
  });

  if (client?.email) {
    await envoyerMail({
      sujet: mailClient(donnees).sujet,
      repondreA: site.email,
      destinataire: client.email,
      texte: mailClient(donnees).texte,
    });
  }
}

/**
 * Crée un envoi Colissimo chez Boxtal PAR COLIS et récupère chaque bordereau PDF.
 * Ne bloque jamais la commande : en cas d'échec, le mail atelier dit pourquoi.
 * Idempotent : les ids Boxtal sont notés sur le paiement Stripe, un événement rejoué ne recrée rien.
 */
async function preparerBordereau(
  s: Stripe,
  c: { session: Stripe.Checkout.Session; piece: Piece | null; reference: string; date: Date; paymentIntentId?: string },
): Promise<DonneesCommande["bordereau"]> {
  if (!boxtalConfigure()) return { raison: "clés Boxtal absentes (BOXTAL_ACCESS_KEY / BOXTAL_SECRET_KEY)" };
  if (!CONFIG_BOXTAL.categorie_contenu) return { raison: "catégorie de contenu Boxtal à renseigner dans data/expedition.json" };
  if (!c.piece) return { raison: "configuration de la pièce illisible" };

  const r = devis(c.piece);
  if (!r.ok) return { raison: `pièce non recalculable (${r.message})` };
  if (c.session.metadata?.envoi === "palette") return { raison: "envoi sur PALETTE (TNT) : à commander sur le compte Boxtal" };
  const exp = expedition(r);
  if (!exp.colis.length) return { raison: exp.raison ?? "transport sur devis" };

  const livraison = c.session.collected_information?.shipping_details;
  const client = c.session.customer_details;
  const a = livraison?.address;
  if (!livraison || !a?.line1 || !a.postal_code || !a.city || !client?.email) return { raison: "adresse de livraison incomplète" };
  if (horsZone(a.postal_code)) return { raison: `adresse HORS ZONE (${a.postal_code}) : la grille ne couvre ni la Corse ni les DOM-TOM — contacter le client avant d'encaisser` };

  // Envois déjà créés pour ce paiement (événement Stripe rejoué) ?
  const pi = c.paymentIntentId ? await s.paymentIntents.retrieve(c.paymentIntentId) : null;
  const dejaCrees = (pi?.metadata?.boxtal_ids ?? "").split(",").filter(Boolean);

  const option = EXPEDITION.options.find((o) => o.cle === c.session.metadata?.livraison_cle);
  const remise = dateIso(plusJoursOuvres(c.date, option?.delai_jours ?? 2));
  const destinataire = {
    nom: livraison.name ?? client.name ?? "Client",
    societe: client.business_name,
    email: client.email,
    telephone: client.phone,
    ligne1: a.line1,
    ligne2: a.line2,
    codePostal: a.postal_code,
    ville: a.city,
    pays: a.country ?? "FR",
  };

  const resultats: BordereauColis[] = [];
  const ids: string[] = [];
  for (const [i, colis] of exp.colis.entries()) {
    try {
      let id = dejaCrees[i];
      let infos: Pick<BordereauColis, "prixHt" | "livraisonEstimee"> = {};
      if (!id) {
        const cree = await creerExpedition(
          construireExpedition({
            reference: c.reference,
            resultat: r,
            epaisseurMm: c.piece.epaisseur_mm,
            valeurHt: r.total_ht,
            colis: { quantite: colis.quantite, numero: i + 1, total: exp.colis.length },
            dateRemise: remise,
            destinataire,
          }),
        );
        id = cree.id;
        infos = { prixHt: cree.deliveryPriceExclTax?.value, livraisonEstimee: cree.estimatedDeliveryDate };
      }
      ids.push(id);
      resultats.push({ idBoxtal: id, pdf: await recupererBordereau(id), ...infos });
    } catch (e) {
      resultats.push({ erreur: `erreur Boxtal : ${(e as Error).message}` });
    }
  }

  if (c.paymentIntentId && ids.length && ids.join(",") !== dejaCrees.join(",")) {
    await s.paymentIntents.update(c.paymentIntentId, { metadata: { boxtal_ids: ids.join(",") } });
  }
  return { colis: resultats };
}

/** Paiement annulé par l'atelier → on annule aussi tous les envois, pour ne pas les payer. */
export async function annulerEnvoi(pi: Stripe.PaymentIntent) {
  const ids = (pi.metadata?.boxtal_ids ?? "").split(",").filter(Boolean);
  if (!ids.length || !boxtalConfigure()) return;
  for (const id of ids) {
    try {
      await annulerExpedition(id);
      console.info(`[webhook] paiement ${pi.id} annulé : envoi Boxtal ${id} annulé.`);
    } catch (e) {
      console.error(`[webhook] paiement ${pi.id} : annulation de l'envoi Boxtal ${id} impossible`, e);
    }
  }
}

export async function traiterCommande(s: Stripe, session: Stripe.Checkout.Session): Promise<void> {
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (paymentIntentId) {
    const pi = await s.paymentIntents.retrieve(paymentIntentId);
    if (pi.metadata?.commande_traitee) {
      console.info(`[commande] ${referenceCommande(session.id)} déjà traitée le ${pi.metadata.commande_traitee} : rien à refaire.`);
      return;
    }
    await s.paymentIntents.update(paymentIntentId, { metadata: { commande_traitee: new Date().toISOString() } });
  }
  try {
    await traiterCommandeUneFois(s, session);
  } catch (e) {
    if (paymentIntentId) await s.paymentIntents.update(paymentIntentId, { metadata: { commande_traitee: "" } }).catch(() => undefined);
    throw e;
  }
}

/**
 * Prévient le client quand l'atelier capture (« validee ») ou annule (« annulee ») le paiement
 * dans Stripe. Seulement pour une commande réellement passée et traitée : Stripe annule aussi les
 * paiements jamais finalisés (client parti de la page de paiement), qui ne doivent rien recevoir.
 * Un seul mail par étape (marque mail_validee / mail_annulee sur le paiement).
 */
export async function notifierClient(s: Stripe, pi: Stripe.PaymentIntent, etape: "validee" | "annulee"): Promise<void> {
  const frais = await s.paymentIntents.retrieve(pi.id);
  if (!frais.metadata?.commande_traitee) return;
  const marque = `mail_${etape}`;
  if (frais.metadata[marque]) return;
  const { data } = await s.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
  const session = data[0];
  const email = session?.customer_details?.email;
  if (!session || !email || !mailPossible()) return;

  const m = mailSuiviClient(donneesDepuisSession(session), etape);
  await envoyerMail({ sujet: m.sujet, texte: m.texte, destinataire: email, repondreA: site.email });
  await s.paymentIntents.update(pi.id, { metadata: { [marque]: new Date().toISOString() } });
}
