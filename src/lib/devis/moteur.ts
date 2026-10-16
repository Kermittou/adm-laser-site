/**
 * Moteur de devis ADM Laser — port TypeScript de reference/moteur_devis.py (l'oracle).
 *
 * TypeScript pur, sans dépendance : il tourne dans le navigateur (prix en direct) comme côté
 * serveur (devis envoyé par mail). Aucun prix, aucune durée en dur : tout vient de
 * data/tarifs.json et data/catalogue.json.
 *
 * Réglages du logiciel de devis ADM (15/10/2026) :
 *   total = max(pièces + frais de plan, minimum de commande)
 *   pièce = matière + découpe, majorées pour les grandes pièces
 *
 *   matière : la bande d'imbrication consommée (colonne pleine hauteur de tôle, écart entre
 *             pièces et marge de bord), au prix au kg de la nuance ;
 *   découpe : minutes arrondies sur la COMMANDE entière × taux €/min selon matière et épaisseur ;
 *   frais de plan (ajoutés) et minimum de commande (plancher) restent deux choses distinctes.
 *
 * L'ancien modèle calibré (taux horaire unique, rectangle englobant, tarif de base) est
 * archivé dans archives/calibrage-2026-09-29.
 */
import tarifsJson from "@data/tarifs.json";
import { catalogue as catalogueParDefaut, listeEpaisseurs, mm, type Catalogue, type Matiere, type Nuance } from "./catalogue";
import { DevisImpossible } from "./erreurs";
import { geometrie } from "./geometrie";
import type { Devis, Feature, Geometrie, Piece, ResultatDevis } from "./types";

export { DevisImpossible } from "./erreurs";

export type Tarifs = {
  /** Frais de plan, ajoutés une fois par commande. */
  frais_plan_eur: number;
  tarif_de_base_cout_eur?: number;
  /** Taux de coupe en €/min : par groupe de matières, première tranche dont max_mm ≥ épaisseur. */
  taux_coupe_eur_min: { matieres: string[]; tranches: { max_mm: number; eur_min: number }[] }[];
  /** Majoration des pièces dont le plus grand côté dépasse le seuil. */
  grande_piece?: { seuil_mm: number; majoration: number };
  marge_bord_tole_mm?: number;
  /** Coupe de chute : écart à la dernière colonne de pièces, et si son temps est facturé. */
  ecart_coupe_chute_mm?: number;
  coupe_chute?: boolean;
  /** Dès 2 pièces, chaque pièce prend ce pourcentage du prix d'une pièce seule. */
  attenuation_degressivite_pct?: number;
  /** Total HT des pièces arrondi à ce pas au-dessus (1 = l'euro supérieur). */
  arrondi_total_ht_eur?: number;
  /** Frais d'envoi et supplément du délai arrondis à ce pas au-dessus. */
  arrondi_livraison_eur?: number;
  marge_matiere?: number;
  marge_machine?: number;
  temps_chargement_tole_s?: number;
  temps_tri_par_piece_s?: number;
  marge_entre_pieces_mm?: number;
  remise_commerciale_pct?: number;
  marge_minimum_pct?: number;
  tva_taux: number;
  prix_kg_eur: Record<string, Record<string, number>>;
  temps_percage_s: Record<string, number>;
  tarif_trou_eur: Record<string, { petit: number; moyen: number; grand: number }>;
  tarif_arrondi_eur: Record<string, number>;
  matiere_mode: "bande" | "bounding_box" | "net";
  prix_minimum_eur?: number;
  /** Options d'expédition des commandes payées en ligne (prix HT, une fois par commande). */
  livraison_options?: { cle: string; libelle: string; delai_jours?: number; prix_eur_ht: number; pourcentage_commande?: number; retrait?: boolean; transport?: boolean; offerte?: boolean }[];
};

export const tarifs = tarifsJson as unknown as Tarifs;

/** Données du moteur. Injectables pour les tests (ex. activer une remise). */
export type Contexte = { catalogue: Catalogue; tarifs: Tarifs };
const DEFAUT: Contexte = { catalogue: catalogueParDefaut, tarifs };

const CONTACT = "Contactez-nous, nous vous faisons un devis sur mesure.";

/* --------------------------------------------------------------------- utilitaires */

/** Arrondi décimal comme round() en Python (sur la valeur décimale exacte du flottant). */
export function arrondi(x: number, decimales: number): number {
  return Number(x.toFixed(decimales));
}

/** Clé de table au format Python f"{x:g}" : 3 → "3", 1.5 → "1.5". */
const cle = (x: number) => String(x);

/**
 * Division entière des flottants comme `a // b` en Python : exacte sur les valeurs binaires.
 * `Math.floor(a / b)` arrondit d'abord le quotient et peut donner une unité de plus dans les
 * cas d'ajustement exact (ex. 1505 / 60.2) — le Python, qui fait foi, donne l'unité inférieure.
 */
function divEntiere(a: number, b: number): number {
  const reste = a % b; // fmod exact
  const div = (a - reste) / b;
  let f = Math.floor(div);
  if (div - f > 0.5) f += 1;
  return f;
}

/** Premier seuil de la table ≥ valeur, sinon le plus grand. */
function seuil<T>(valeur: number, table: Record<string, T>): string {
  const cles = Object.keys(table).sort((a, b) => Number(a) - Number(b));
  return cles.find((c) => valeur <= Number(c)) ?? cles[cles.length - 1];
}

/* --------------------------------------------------------------------- catalogue */

function matiere(cleMatiere: string, ctx: Contexte): Matiere {
  const m = ctx.catalogue.matieres[cleMatiere];
  if (!m) throw new DevisImpossible("matiere_inconnue", `Cette matière n'est pas proposée en ligne. ${CONTACT}`);
  return m;
}

function nuance(cleMatiere: string, cleNuance: string, ctx: Contexte): Nuance {
  const m = matiere(cleMatiere, ctx);
  if (!m.devis_automatique) {
    throw new DevisImpossible("devis_manuel", m.message_devis ?? `${m.label} : sur devis uniquement. ${CONTACT}`);
  }
  const n = m.nuances[cleNuance];
  if (!n) throw new DevisImpossible("nuance_inconnue", `Cette finition n'est pas proposée en ${m.label.toLowerCase()}. ${CONTACT}`);
  return n;
}

export function epaisseursDisponibles(cleMatiere: string, cleNuance: string, ctx: Contexte = DEFAUT): number[] {
  return [...nuance(cleMatiere, cleNuance, ctx).epaisseurs];
}

function validerEpaisseur(p: Piece, ctx: Contexte): void {
  const dispo = epaisseursDisponibles(p.matiere, p.nuance, ctx);
  if (!dispo.includes(p.epaisseur_mm)) {
    const m = matiere(p.matiere, ctx);
    const n = nuance(p.matiere, p.nuance, ctx);
    throw new DevisImpossible(
      "epaisseur_indisponible",
      `${m.label} ${n.label.toLowerCase()} n'existe qu'en ${listeEpaisseurs(dispo)} (demandé : ${mm(p.epaisseur_mm)} mm). ` +
        `Choisissez l'une de ces épaisseurs, ou contactez-nous pour une autre.`,
    );
  }
}

/** Un trou ne peut pas être plus petit que l'épaisseur de la tôle. Règle d'atelier, sans exception. */
export function diametreTrouMinMm(epaisseur_mm: number): number {
  return epaisseur_mm;
}

function refusTrou(diametre: number, epaisseur: number): DevisImpossible {
  return new DevisImpossible(
    "trou_trop_petit",
    `En ${mm(epaisseur)} mm d'épaisseur, le plus petit trou possible fait Ø${mm(diametreTrouMinMm(epaisseur))} mm ` +
      `(demandé : ${mm(diametre)} mm). Agrandissez la découpe, choisissez une tôle plus fine, ou contactez-nous.`,
  );
}

export function vitesseMmS(cleMatiere: string, epaisseur_mm: number, ctx: Contexte = DEFAUT): number {
  const table = matiere(cleMatiere, ctx).vitesses_m_min ?? {};
  const v = table[cle(epaisseur_mm)];
  if (v === undefined) {
    throw new DevisImpossible("vitesse_inconnue", `Nous n'avons pas de réglage en ligne pour cette épaisseur. ${CONTACT}`);
  }
  return (v * 1000) / 60; // m/min -> mm/s
}

/** Le larmé 3-5 pèse plus qu'une tôle lisse de 3 mm : les larmes ajoutent de la matière. */
function epaisseurMasseMm(p: Piece, ctx: Contexte): number {
  return nuance(p.matiere, p.nuance, ctx).epaisseur_masse_mm ?? p.epaisseur_mm;
}

/** Taux de coupe en €/min pour la matière et l'épaisseur (tarifs.json, taux_coupe_eur_min). */
export function tauxCoupeEurMin(cleMatiere: string, epaisseur_mm: number, ctx: Contexte = DEFAUT): number {
  const groupe = ctx.tarifs.taux_coupe_eur_min.find((g) => g.matieres.includes(cleMatiere));
  if (!groupe) throw new DevisImpossible("taux_inconnu", `Nous n'avons pas de tarif de coupe en ligne pour cette matière. ${CONTACT}`);
  const tranches = [...groupe.tranches].sort((a, b) => a.max_mm - b.max_mm);
  return (tranches.find((t) => epaisseur_mm <= t.max_mm) ?? tranches[tranches.length - 1]).eur_min;
}

/** Format de tôle (longueur, hauteur), le plus grand côté d'abord. */
function formatTole(ctx: Contexte): [number, number] {
  const [fx, fy] = ctx.catalogue.contraintes.format_tole_max_mm;
  return [Math.max(fx, fy), Math.min(fx, fy)];
}

/**
 * Surface de tôle consommée par pièce, imbrication ADM en colonnes : chaque colonne prend
 * toute la hauteur de la tôle sur la largeur de la pièce + l'écart entre pièces, divisée par
 * le nombre de pièces empilées dans la colonne. On garde l'orientation la plus économe.
 */
export function surfaceBandeMm2(geo: Geometrie, ctx: Contexte = DEFAUT): number {
  const [, H] = formatTole(ctx);
  const esp = ctx.tarifs.marge_entre_pieces_mm ?? 10;
  const bord = ctx.tarifs.marge_bord_tole_mm ?? 10;
  const [bx, by] = geo.encombrement_mm;
  let meilleure = Infinity;
  for (const [w, h] of [[bx, by], [by, bx]]) {
    const rangs = Math.max(1, Math.floor((H - 2 * bord + esp) / (h + esp)));
    meilleure = Math.min(meilleure, (H * (w + esp)) / rangs);
  }
  return meilleure;
}

/* --------------------------------------------------------------------- validations */

/** Quantité entière, cotes présentes, finies et au moins égales au minimum du catalogue. */
function validerSaisie(p: Piece, ctx: Contexte): void {
  if (!Number.isInteger(p.quantite) || p.quantite < 1) {
    throw new DevisImpossible("quantite_invalide", "Indiquez une quantité d'au moins une pièce.");
  }
  const forme = ctx.catalogue.formes[p.forme];
  if (!forme) {
    throw new DevisImpossible("forme_inconnue", "Cette forme n'est pas disponible en ligne. Envoyez-nous votre plan, nous la chiffrons.");
  }
  for (const param of forme.parametres) {
    const v = p.dimensions[param.cle];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new DevisImpossible("dimension_invalide", `Indiquez la cote « ${param.label} ».`);
    }
    if (v < param.min) {
      throw new DevisImpossible("dimension_invalide", `La cote « ${param.label} » doit faire au moins ${mm(param.min)} mm.`);
    }
  }
}

/** Bornes max du catalogue — vérifiées après le format tôle, dont le message est plus parlant. */
function validerBornesMax(p: Piece, ctx: Contexte): void {
  for (const param of ctx.catalogue.formes[p.forme].parametres) {
    if (p.dimensions[param.cle] > param.max) {
      throw new DevisImpossible(
        "dimension_invalide",
        `La cote « ${param.label} » ne peut pas dépasser ${mm(param.max)} mm en ligne. Au-delà, contactez-nous.`,
      );
    }
  }
}

/**
 * Découpes intérieures soumises à la règle du trou minimum.
 * Ajout par rapport à l'oracle Python, qui ne l'appliquait qu'aux features « trou ».
 */
function validerDecoupesInterieures(p: Piece): void {
  const d = p.dimensions;
  if (p.forme === "cadre_coupe_circulaire" && d.diametre_interieur < diametreTrouMinMm(p.epaisseur_mm)) {
    throw refusTrou(d.diametre_interieur, p.epaisseur_mm);
  }
  if (p.forme === "cadre_coupe_rectangle") {
    const plusPetitCote = Math.min(d.longueur_interieure, d.largeur_interieure);
    if (plusPetitCote < diametreTrouMinMm(p.epaisseur_mm)) throw refusTrou(plusPetitCote, p.epaisseur_mm);
  }
}

function validerEncombrement(geo: Geometrie, ctx: Contexte): void {
  const [fx, fy] = ctx.catalogue.contraintes.format_tole_max_mm;
  const [bx, by] = geo.encombrement_mm;
  if (Math.max(bx, by) > Math.max(fx, fy) || Math.min(bx, by) > Math.min(fx, fy)) {
    throw new DevisImpossible(
      "hors_format",
      `Votre pièce (${mm(arrondi(bx, 1))} × ${mm(arrondi(by, 1))} mm) dépasse notre format de tôle ` +
        `(${mm(fx)} × ${mm(fy)} mm). Contactez-nous pour l'étudier.`,
    );
  }
}

/* --------------------------------------------------------------------- postes de prix */

/**
 * Coût matière. En mode « bande », la tôle consommée par l'imbrication ; la chute intérieure
 * d'un cadre est perdue, elle est payée.
 */
function prixMatiere(geo: Geometrie, p: Piece, ctx: Contexte) {
  const epMasse = epaisseurMasseMm(p, ctx);
  const densite = matiere(p.matiere, ctx).densite_kg_dm3;
  const mode = ctx.tarifs.matiere_mode;
  const surfaceFacturee =
    mode === "bande" ? surfaceBandeMm2(geo, ctx) : mode === "bounding_box" ? geo.surface_englobante_mm2 : geo.surface_nette_mm2;
  const masse_facturee_kg = ((surfaceFacturee * epMasse) / 1_000_000) * densite;
  const masse_nette_kg = ((geo.surface_nette_mm2 * epMasse) / 1_000_000) * densite;
  const grille = ctx.tarifs.prix_kg_eur[p.matiere];
  const prix_kg_eur = grille[p.nuance] ?? grille._defaut;
  return { surface_facturee_mm2: surfaceFacturee, masse_nette_kg, masse_facturee_kg, prix_kg_eur, prix_eur: masse_facturee_kg * prix_kg_eur };
}

/** Temps machine PAR PIÈCE : trajet du faisceau + amorçages + tri. Le chargement de tôle est à part. */
function tempsCoupe(geo: Geometrie, p: Piece, ctx: Contexte) {
  const v = vitesseMmS(p.matiere, p.epaisseur_mm, ctx);
  const tPercage = ctx.tarifs.temps_percage_s[seuil(p.epaisseur_mm, ctx.tarifs.temps_percage_s)];
  const trajet_s = geo.perimetre_mm / v;
  const amorcage_s = geo.percages * tPercage;
  const tri_s = ctx.tarifs.temps_tri_par_piece_s ?? 0;
  return { vitesse_mm_s: v, trajet_s, amorcage_s, tri_s, total_s: trajet_s + amorcage_s + tri_s };
}

/**
 * Le temps machine se facture à la minute : au-delà de 10 secondes entamées, on compte la
 * minute suivante (5 min 23 s → 6 min). S'applique à la COMMANDE entière, jamais à chaque pièce.
 */
export function minutesFacturees(totalSecondes: number): number {
  const m = Math.floor(totalSecondes / 60);
  const s = totalSecondes - m * 60;
  return s > 10 ? m + 1 : m;
}

/**
 * Pièces par tôle en imbrication simple : grille de rectangles englobants avec écart entre
 * pièces et marge de bord, pièce testée aussi tournée à 90°. Minimum 1.
 */
export function piecesParTole(geo: Geometrie, ctx: Contexte = DEFAUT): number {
  const [fx, fy] = formatTole(ctx);
  const m = ctx.tarifs.marge_entre_pieces_mm ?? 10;
  const b = ctx.tarifs.marge_bord_tole_mm ?? 0;
  const [bx, by] = geo.encombrement_mm;
  const grille = (px: number, py: number) =>
    Math.max(0, divEntiere(fx - 2 * b + m, px + m)) * Math.max(0, divEntiere(fy - 2 * b + m, py + m));
  return Math.max(1, grille(bx, by), grille(by, bx));
}

/** Petites features à tarif FIXE : pour un trou, l'amorçage domine, pas le trajet. */
function prixFeature(f: Feature, epaisseur_mm: number, ctx: Contexte): number {
  const s = seuil(epaisseur_mm, ctx.tarifs.tarif_arrondi_eur);
  if (f.type === "arrondi") return ctx.tarifs.tarif_arrondi_eur[s];
  if (f.type === "trou") {
    if (f.diametre_mm < diametreTrouMinMm(epaisseur_mm)) throw refusTrou(f.diametre_mm, epaisseur_mm);
    const taille = f.diametre_mm < 10 ? "petit" : f.diametre_mm < 30 ? "moyen" : "grand";
    return ctx.tarifs.tarif_trou_eur[s][taille];
  }
  throw new DevisImpossible("feature_inconnue", `Cette option n'est pas chiffrable en ligne. ${CONTACT}`);
}

/* --------------------------------------------------------------------- le devis */

/** Calcule le devis. Lève DevisImpossible si la pièce doit être chiffrée à la main. */
export function calculer(p: Piece, ctx: Contexte = DEFAUT): ResultatDevis {
  const T = ctx.tarifs;
  validerEpaisseur(p, ctx);
  validerSaisie(p, ctx);
  const geo = geometrie(p.forme, p.dimensions);
  validerDecoupesInterieures(p);
  validerEncombrement(geo, ctx);
  validerBornesMax(p, ctx);

  const margeMat = T.marge_matiere ?? 1;
  const margeMach = T.marge_machine ?? 1;
  const tauxMin = tauxCoupeEurMin(p.matiere, p.epaisseur_mm, ctx);
  const tauxS = tauxMin / 60;
  const features = p.features ?? [];

  // --- niveau PIÈCE ---------------------------------------------------------
  const mat = prixMatiere(geo, p, ctx);
  const tps = tempsCoupe(geo, p, ctx);
  const prixFeatures = features.reduce((s, f) => s + prixFeature(f, p.epaisseur_mm, ctx), 0);

  // Temps machine à la minute arrondie, sur la COMMANDE entière, puis réparti sur les pièces.
  const parTole = piecesParTole(geo, ctx);

  // Coupe de chute, une par commande : à ecart_coupe_chute_mm de la dernière colonne de
  // pièces au lieu de l'écart normal. La bande en plus est facturée une fois, et la coupe
  // (hauteur de tôle + un amorçage) s'ajoute au temps machine de la commande.
  const [, hauteurTole] = formatTole(ctx);
  const surplusMm = Math.max(0, (T.ecart_coupe_chute_mm ?? 0) - (T.marge_entre_pieces_mm ?? 10));
  const surfaceChuteMm2 = T.matiere_mode === "bande" ? hauteurTole * surplusMm : 0;
  const coutChute = (mat.prix_eur / mat.surface_facturee_mm2) * surfaceChuteMm2;
  const prixChute = coutChute * margeMat;
  const tPercage = T.temps_percage_s[seuil(p.epaisseur_mm, T.temps_percage_s)];
  const coupeChuteS = T.coupe_chute ? hauteurTole / tps.vitesse_mm_s + tPercage : 0;

  const tempsTotalS = tps.total_s * p.quantite + coupeChuteS + ((T.temps_chargement_tole_s ?? 0) * p.quantite) / parTole;
  const minutes = minutesFacturees(tempsTotalS);
  const coutDecoupeCommande = minutes * 60 * tauxS;
  const coutDecoupe = coutDecoupeCommande / p.quantite;

  const coutMatiere = mat.prix_eur;
  const prixMat = coutMatiere * margeMat;
  const prixDecoupe = coutDecoupe * margeMach;

  // Grandes pièces (plus grand côté > seuil) : majoration de la matière et de la découpe.
  const gp = T.grande_piece;
  const majorationPct = gp && Math.max(...geo.encombrement_mm) > gp.seuil_mm ? gp.majoration : 0;
  const prixMajoration = (prixMat + prixDecoupe) * majorationPct;

  const coutPiece = coutMatiere + coutDecoupe + prixFeatures;
  const prixPiece = prixMat + prixDecoupe + prixMajoration + prixFeatures;

  // --- niveau TÔLE : au prorata, jamais par tôle entière ----------------------
  // Sinon la 64e pièce, qui ouvre une 2e tôle, coûterait plus cher l'unité que la 63e.
  const tolesFacturees = p.quantite / parTole;
  const nToles = Math.ceil(tolesFacturees);
  const coutTole = 0; // déjà compris dans le temps machine arrondi ci-dessus — voulu
  const prixTole = 0;

  // --- niveau COMMANDE : frais de plan AJOUTÉS, pas un plancher -----------------
  const fixeCommande = T.frais_plan_eur;
  const coutFixeCommande = T.tarif_de_base_cout_eur ?? fixeCommande;

  // Atténuation de la dégressivité (décision ADM) : dès 2 pièces, chaque pièce prend un
  // pourcentage du prix d'une pièce seule — la réduction par rapport à 1 pièce baisse du
  // même nombre de points à toutes les quantités, sans créer de dent de scie.
  const attenuationPct = T.attenuation_degressivite_pct ?? 0;
  const prixAttenuation = attenuationPct && p.quantite > 1 ? attenuationPct * calculer({ ...p, quantite: 1 }, ctx).total_ht : 0;

  const totalBrut = prixPiece * p.quantite + tolesFacturees * prixTole + fixeCommande + prixChute + prixAttenuation * p.quantite;
  const unitaireBrut = totalBrut / p.quantite;

  // coût marginal = ce que coûte VRAIMENT une pièce de plus ; plancher = ce coût + marge minimale
  const coutMarginal = coutPiece + coutTole / parTole;
  const prixMarginal = prixPiece + prixTole / parTole;
  const prixPlancher = coutMarginal * (1 + (T.marge_minimum_pct ?? 0));

  // Remise commerciale explicite, bridée par ce plancher. Levier séparé de la dégressivité.
  const remisePct = T.remise_commerciale_pct ?? 0;
  const unitaireRemise = unitaireBrut * (1 - remisePct);
  const remiseBridee = Boolean(remisePct) && unitaireRemise < prixPlancher;
  let unitaire = remisePct ? Math.max(unitaireRemise, prixPlancher) : unitaireBrut;

  // Minimum de commande : un PLANCHER de facturation, distinct des frais de plan additifs.
  const totalCalcule = unitaire * p.quantite;
  const minimum = T.prix_minimum_eur ?? 0;
  const minimumApplique = totalCalcule < minimum;
  let totalHt = Math.max(totalCalcule, minimum);
  if (minimumApplique) unitaire = totalHt / p.quantite;

  // Arrondi commercial : total HT à l'euro supérieur (arrondi_total_ht_eur), puis unitaire = total / qté.
  const pas = T.arrondi_total_ht_eur ?? 0;
  const totalAvantArrondi = totalHt;
  if (pas) {
    totalHt = Math.ceil(arrondi(totalHt, 2) / pas - 1e-9) * pas;
    unitaire = totalHt / p.quantite;
  }
  const coutUnitaire = coutPiece + coutTole / parTole + (coutFixeCommande + coutChute) / p.quantite;

  return {
    taux_coupe_eur_min: tauxMin,
    surface_facturee_m2: arrondi(mat.surface_facturee_mm2 / 1_000_000, 4),
    majoration_grande_piece_pct: majorationPct,
    coupe_chute_s: arrondi(coupeChuteS, 2),
    geometrie: {
      surface_nette_mm2: arrondi(geo.surface_nette_mm2, 1),
      perimetre_mm: arrondi(geo.perimetre_mm, 1),
      encombrement_mm: [arrondi(geo.encombrement_mm[0], 1), arrondi(geo.encombrement_mm[1], 1)],
      surface_englobante_mm2: arrondi(geo.surface_englobante_mm2, 1),
      percages: geo.percages + features.length,
    },
    masse_nette_kg: arrondi(mat.masse_nette_kg, 3),
    masse_facturee_kg: arrondi(mat.masse_facturee_kg, 3),
    vitesse_mm_s: arrondi(tps.vitesse_mm_s, 1),
    temps_coupe_s: arrondi(tps.total_s, 2),
    minutes_facturees: minutes,
    pieces_par_tole: parTole,
    nombre_de_toles: nToles,
    detail_unitaire: {
      matiere: arrondi(prixMat, 2),
      decoupe: arrondi(prixDecoupe, 2),
      majoration: arrondi(prixMajoration, 2),
      features: arrondi(prixFeatures, 2),
      toles: arrondi((tolesFacturees * prixTole) / p.quantite, 2),
      frais_plan: arrondi(fixeCommande / p.quantite, 2),
      chute: arrondi(prixChute / p.quantite, 2),
      attenuation: arrondi(prixAttenuation, 2),
      arrondi: arrondi((totalHt - totalAvantArrondi) / p.quantite, 2),
    },
    prix_unitaire_ht: arrondi(unitaire, 2),
    cout_unitaire_ht: arrondi(coutUnitaire, 2),
    cout_marginal_ht: arrondi(coutMarginal, 2),
    prix_marginal_ht: arrondi(prixMarginal, 2),
    prix_plancher_ht: arrondi(prixPlancher, 2),
    marge_realisee_pct: arrondi((unitaire / coutUnitaire - 1) * 100, 1),
    remise_commerciale_pct: remisePct,
    remise_bridee_par_marge_min: remiseBridee,
    quantite: p.quantite,
    epaisseur_mm: p.epaisseur_mm,
    prix_minimum_applique: minimumApplique,
    total_ht: arrondi(totalHt, 2),
    total_ttc: arrondi(totalHt * (1 + T.tva_taux), 2),
  };
}

/** Variante sans exception, pour l'interface : un refus est un résultat, pas une erreur. */
export function devis(p: Piece, ctx: Contexte = DEFAUT): Devis {
  try {
    return { ok: true, ...calculer(p, ctx) };
  } catch (e) {
    if (e instanceof DevisImpossible) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}

export const PALIERS = [1, 5, 10, 25, 50, 100];

/** Table de prix par palier — ce qu'on affiche au client pour l'inciter à monter en série. */
export function paliers(p: Piece, quantites: number[] = PALIERS, ctx: Contexte = DEFAUT) {
  return quantites.map((quantite) => {
    const r = calculer({ ...p, quantite }, ctx);
    return { quantite, prix_unitaire_ht: r.prix_unitaire_ht, total_ht: r.total_ht };
  });
}
