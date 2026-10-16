/**
 * Boxtal API v3 — création des expéditions Colissimo et récupération du bordereau PDF.
 *
 * Documentation : https://developer.boxtal.com/fr/fr/apiv3/documentation
 *   POST   /shipping/v3.1/shipping-order                    créer et commander une expédition
 *   GET    /shipping/v3.1/shipping-order/{id}/shipping-document   documents (bordereau)
 *   DELETE /shipping/v3.1/shipping-order/{id}               annuler
 * Authentification : les clés (accès:secrète, en basic auth) servent UNIQUEMENT à obtenir un jeton
 * temporaire (POST /iam/account-app/token) ; tous les autres appels passent ce jeton en Bearer.
 * Les clés de test ne marchent qu'avec le serveur de test (https://api.boxtal.build), celles de
 * production qu'avec https://api.boxtal.com.
 *
 * Les fonctions « construire… » sont pures et testées ; les appels réseau sont à part.
 */
import config from "@data/expedition.json";
import grille from "@data/grille-livraison.json";
import type { ResultatDevis } from "@/lib/devis/types";

export type ConfigBoxtal = Omit<typeof config, "categorie_contenu"> & { categorie_contenu: string | null };
export const CONFIG_BOXTAL: ConfigBoxtal = config;

/* ------------------------------------------------------------------ construction de la requête */

export type Colis = { length: number; width: number; height: number; weight: number };

/**
 * Dimensions d'un colis (cm, entiers) : pièces empilées + marge d'emballage de chaque côté.
 * Poids : poids facturé de la grille ADM (pièces × coef_poids_emballage), au gramme.
 * `quantite` = pièces dans CE colis.
 */
export function dimensionsColis(r: ResultatDevis, epaisseurMm: number, quantite = r.quantite, cfg = CONFIG_BOXTAL): Colis {
  const marge = 2 * cfg.emballage_marge_cm;
  const [a, b] = [...r.geometrie.encombrement_mm].sort((x, y) => y - x);
  const pile = epaisseurMm * quantite;
  return {
    length: Math.ceil(a / 10) + marge,
    width: Math.ceil(b / 10) + marge,
    height: Math.max(1, Math.ceil(pile / 10)) + marge,
    weight: Math.round(r.masse_nette_kg * quantite * grille._calcul.coef_poids_emballage * 1000) / 1000,
  };
}

/** « Jean-Pierre Dupont » → prénom « Jean-Pierre », nom « Dupont ». Un seul mot : prénom = nom. */
export function separerNom(complet: string): { firstName: string; lastName: string } {
  const mots = complet.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return { firstName: "Client", lastName: "Client" };
  if (mots.length === 1) return { firstName: mots[0], lastName: mots[0] };
  return { firstName: mots.slice(0, -1).join(" "), lastName: mots[mots.length - 1] };
}

/** « 12 bis rue X » → numéro « 12 bis », rue « rue X ». */
export function separerAdresse(ligne: string): { number?: string; street: string } {
  const m = ligne.trim().match(/^(\d+\s*(?:bis|ter|quater|[a-d])?)[\s,]+(.+)$/i);
  return m ? { number: m[1].replace(/\s+/g, " "), street: m[2] } : { street: ligne.trim() };
}

/** Téléphone au format +33XXXXXXXXX attendu par Boxtal. */
export function telephoneInternational(tel: string | null | undefined, pays = "FR"): string | null {
  if (!tel) return null;
  const chiffres = tel.replace(/[^\d+]/g, "");
  if (chiffres.startsWith("+")) return chiffres;
  if (chiffres.startsWith("00")) return `+${chiffres.slice(2)}`;
  if (pays === "FR" && /^0\d{9}$/.test(chiffres)) return `+33${chiffres.slice(1)}`;
  return null;
}

export type Destinataire = {
  nom: string;
  societe?: string | null;
  email: string;
  telephone?: string | null;
  ligne1: string;
  ligne2?: string | null;
  codePostal: string;
  ville: string;
  pays: string;
};

export type DemandeExpedition = {
  reference: string;
  resultat: ResultatDevis;
  epaisseurMm: number;
  valeurHt: number;
  /** Pièces dans ce colis, et position du colis (1 sur n) : un envoi Boxtal par colis. */
  colis?: { quantite: number; numero: number; total: number };
  destinataire: Destinataire;
  /** Date de remise au transporteur (AAAA-MM-JJ). */
  dateRemise: string;
};

/** Corps de POST /shipping/v3.1/shipping-order. Lève une erreur lisible si une donnée manque. */
export function construireExpedition(d: DemandeExpedition, cfg = CONFIG_BOXTAL) {
  if (!cfg.categorie_contenu) throw new Error("catégorie de contenu Boxtal non renseignée (data/expedition.json)");
  const tel = telephoneInternational(d.destinataire.telephone, d.destinataire.pays);
  if (!tel) throw new Error("téléphone du destinataire manquant ou illisible");

  const part = d.colis ?? { quantite: d.resultat.quantite, numero: 1, total: 1 };
  const colis = dimensionsColis(d.resultat, d.epaisseurMm, part.quantite, cfg);
  const ref = part.total > 1 ? `${d.reference}-${part.numero}` : d.reference;
  const valeur = (d.valeurHt * part.quantite) / d.resultat.quantite;
  const { number, street } = separerAdresse(d.destinataire.ligne1);
  const e = cfg.expediteur;

  return {
    insured: false,
    labelType: cfg.format_etiquette,
    shippingOfferCode: cfg.offre_colis,
    expectedTakingOverDate: d.dateRemise,
    shipment: {
      externalId: ref,
      packages: [
        {
          type: "PARCEL",
          value: { value: Math.round(valeur * 100) / 100, currency: "EUR" },
          ...colis,
          content: { id: cfg.categorie_contenu, description: cfg.description_contenu },
          externalId: ref,
        },
      ],
      fromAddress: {
        type: "BUSINESS",
        contact: { email: e.email, phone: e.telephone, company: e.societe, firstName: e.prenom, lastName: e.nom },
        location: { number: e.numero, street: e.rue, postalCode: e.code_postal, city: e.ville, countryIsoCode: e.pays },
      },
      toAddress: {
        type: d.destinataire.societe ? "BUSINESS" : "RESIDENTIAL",
        contact: {
          email: d.destinataire.email,
          phone: tel,
          ...(d.destinataire.societe ? { company: d.destinataire.societe } : {}),
          ...separerNom(d.destinataire.nom),
        },
        location: {
          ...(number ? { number } : {}),
          street,
          postalCode: d.destinataire.codePostal,
          city: d.destinataire.ville,
          countryIsoCode: d.destinataire.pays,
        },
        ...(d.destinataire.ligne2 ? { additionalInformation: d.destinataire.ligne2 } : {}),
      },
    },
  };
}

/* ------------------------------------------------------------------ appels réseau */

const URL_API = () => (process.env.BOXTAL_API_URL ?? "https://api.boxtal.build").replace(/\/$/, "");

export function boxtalConfigure(): boolean {
  return Boolean(process.env.BOXTAL_ACCESS_KEY && process.env.BOXTAL_SECRET_KEY);
}

/** Jeton Bearer en cache, renouvelé une minute avant son expiration. */
let jeton: { valeur: string; expire: number } | null = null;

async function jetonAcces(): Promise<string> {
  if (jeton && Date.now() < jeton.expire) return jeton.valeur;
  const basic = Buffer.from(`${process.env.BOXTAL_ACCESS_KEY}:${process.env.BOXTAL_SECRET_KEY}`).toString("base64");
  const res = await fetch(`${URL_API()}/iam/account-app/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Boxtal ${res.status} : authentification refusée (clés ou serveur de test/production à vérifier)`);
  const r = (await res.json()) as { accessToken: string; expiresIn?: number };
  jeton = { valeur: r.accessToken, expire: Date.now() + Math.max(60, (r.expiresIn ?? 3600) - 60) * 1000 };
  return jeton.valeur;
}

async function entetes(): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await jetonAcces()}`, "Content-Type": "application/json", Accept: "application/json" };
}

async function appel<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
  const res = await fetch(`${URL_API()}${chemin}`, { method: methode, headers: await entetes(), body: corps ? JSON.stringify(corps) : undefined });
  const texte = await res.text();
  const json = texte ? JSON.parse(texte) : {};
  if (!res.ok) {
    const detail = (json.errors ?? [])
      .map((e: { code: string; parameters?: { code: string; field: string }[] | null }) =>
        [e.code, ...(e.parameters ?? []).map((p) => `${p.field} ${p.code}`)].join(" "),
      )
      .join(" ; ");
    throw new Error(`Boxtal ${res.status} ${detail || texte.slice(0, 300)}`);
  }
  return json as T;
}

export type ExpeditionCreee = {
  id: string;
  status: string;
  deliveryPriceExclTax?: { value: number; currency: string };
  estimatedDeliveryDate?: string;
};

export async function creerExpedition(corps: ReturnType<typeof construireExpedition>): Promise<ExpeditionCreee> {
  const r = await appel<{ content: ExpeditionCreee }>("POST", "/shipping/v3.1/shipping-order", corps);
  return r.content;
}

export async function annulerExpedition(id: string): Promise<void> {
  await appel("DELETE", `/shipping/v3.1/shipping-order/${encodeURIComponent(id)}`);
}

export async function listerCategoriesContenu(): Promise<unknown> {
  return appel("GET", "/shipping/v3.1/content-category");
}

/**
 * Bordereau PDF. Boxtal le génère de façon asynchrone : on réessaie quelques secondes tant qu'il
 * répond 422 (NoShippingDocumentException, ou UnexpectedException juste après la création —
 * constaté sur le serveur de test le 15/10/2026). Toute autre erreur remonte tout de suite.
 */
export async function recupererBordereau(id: string, essais = 10, pauseMs = 3000): Promise<Buffer | null> {
  for (let i = 0; i < essais; i++) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, pauseMs));
    try {
      const r = await appel<{ content: { url: string; type: string }[] }>("GET", `/shipping/v3.1/shipping-order/${encodeURIComponent(id)}/shipping-document`);
      const etiquette = r.content.find((d) => d.type === "LABEL") ?? r.content[0];
      if (etiquette?.url) {
        const pdf = await fetch(etiquette.url);
        if (pdf.ok) return Buffer.from(await pdf.arrayBuffer());
      }
    } catch (e) {
      const pasPret = /Boxtal 422|NoShippingDocument/.test(String(e));
      if (!pasPret || i === essais - 1) throw e;
    }
  }
  return null;
}
