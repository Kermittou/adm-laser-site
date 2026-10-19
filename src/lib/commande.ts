/**
 * Commande en ligne : envoi (colis ou palette), options d'expédition et montants à encaisser.
 *
 * Pur et testable : le même calcul sert à l'affichage (navigateur) et à la session Stripe
 * (serveur). Le serveur ne fait JAMAIS confiance à un montant ni à une option venus du
 * navigateur : il recalcule tout à partir de la configuration de la pièce.
 *
 * Règles (data/grille-livraison.json, grille ADM) :
 *   - poids facturé = poids net des pièces × coef_poids_emballage (1,15) ;
 *   - colis Colissimo : 30 kg facturés ; dimensions du colis emballé selon La Poste — standard
 *     si longueur ≤ 100 cm et L+l+h ≤ 150 cm, volumineux (tarif grand format) jusqu'à
 *     L+l+h = 200 cm, au-delà pas de colis ; autant de colis que nécessaire (découpage le moins
 *     cher), un envoi et un bordereau par colis ;
 *   - prix d'envoi et supplément du délai arrondis à l'euro supérieur (tarifs.json) ;
 *   - palette : proposée quand la commande dépasse un colis (> 30 kg) ou qu'une pièce ne passe
 *     pas en colis (> 150 cm ou > 30 kg) ; le client choisit alors entre colis et palette ;
 *   - le retrait gratuit à l'atelier est toujours proposé, y compris quand la livraison est sur devis.
 */
import configExpedition from "@data/expedition.json";
import grilleJson from "@data/grille-livraison.json";
import { arrondi, devis, tarifs } from "@/lib/devis/moteur";
import type { Piece, ResultatDevis } from "@/lib/devis/types";

/** Frais HT = prix_eur_ht + pourcentage_commande × total HT des pièces (voir tarifs.json). */
export type OptionLivraison = {
  cle: string;
  libelle: string;
  delai_jours?: number;
  prix_eur_ht: number;
  pourcentage_commande?: number;
  /** Retrait à l'atelier : pas d'expédition, toujours proposé. */
  retrait?: boolean;
  /** Ajoute les frais d'envoi (colis ou palette). */
  transport?: boolean;
  /** Livraison offerte au client : ADM prend le transport à sa charge. */
  offerte?: boolean;
};

export type Tranche = { max_kg: number; prix_std_HT: number; prix_gf_HT: number };

export type GrilleLivraison = {
  transporteur_colis: string;
  transporteur_lourd: string;
  limite_colis: { poids_kg: number };
  hors_zone: string[];
  tranches: Tranche[];
  palette: { prix_HT: number };
  _calcul: {
    coef_poids_emballage: number;
    palette_poids_max_kg: number | null;
    palette_longueur_max_cm: number | null;
    palette_largeur_max_cm: number | null;
    colissimo: { standard_longueur_max_cm: number; standard_somme_max_cm: number; volumineux_somme_max_cm: number };
  };
};

export type ConfigExpedition = {
  options: OptionLivraison[];
  grille: GrilleLivraison;
  /** Marge d'emballage de chaque côté des pièces (cm). */
  margeEmballageCm: number;
  /** Arrondi au-dessus des frais d'envoi et du supplément du délai (1 = l'euro). */
  arrondiEur: number;
};

const valide = (n: number | undefined | null) => n === undefined || (typeof n === "number" && Number.isFinite(n) && n >= 0);

export const GRILLE: GrilleLivraison = grilleJson as unknown as GrilleLivraison;

export const EXPEDITION: ConfigExpedition = {
  options: (tarifs.livraison_options ?? []).filter((o) => o.cle && valide(o.prix_eur_ht) && valide(o.pourcentage_commande)),
  grille: GRILLE,
  margeEmballageCm: configExpedition.emballage_marge_cm ?? 0,
  arrondiEur: tarifs.arrondi_livraison_eur ?? 0,
};

/** Arrondi au pas supérieur (1 → l'euro au-dessus), sans erreur de virgule flottante. */
function auDessus(x: number, pas: number): number {
  return (pas ? Math.ceil(arrondi(x, 2) / pas - 1e-9) * pas : arrondi(x, 2)) + 0; // + 0 : jamais « -0 »
}

export type Envoi = "colis" | "palette";

/** Un colis : nombre de pièces, poids facturé (pièces × coefficient d'emballage) et dimensions emballé. */
export type Colis = { quantite: number; poids_kg: number; dimensions_cm: [number, number, number]; volumineux: boolean };

export type OffreEnvoi = { type: Envoi; libelle: string; transporteur: string; prix_ht: number };

export type Expedition = {
  /** Envoi le moins cher, ou « sur_devis » quand aucun envoi n'est chiffrable en ligne. */
  mode: Envoi | "sur_devis";
  /** Poids des pièces (nettes, hors emballage). */
  poids_kg: number;
  /** Poids facturé : pièces × coefficient d'emballage. */
  poids_facture_kg: number;
  /** Plus grande dimension d'une pièce. */
  longueur_mm: number;
  /** Au moins un colis volumineux au sens Colissimo (tarif grand format). */
  grand_format: boolean;
  /** Répartition en colis (vide si les pièces ne passent pas en colis). */
  colis: Colis[];
  /** Envois proposés au client, du moins cher au plus cher. */
  envois: OffreEnvoi[];
  /** Options proposées au client : délais de livraison et/ou retrait à l'atelier. */
  options: OptionLivraison[];
  /** Pourquoi le colis (ou la livraison) n'est pas possible, en clair pour le client. */
  raison: string | null;
};

const kg = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Répartit q pièces en n colis les plus égaux possible : 45 en 4 → 12, 11, 11, 11. */
export function repartir(q: number, n: number): number[] {
  const base = Math.floor(q / n);
  return Array.from({ length: n }, (_, i) => base + (i < q % n ? 1 : 0));
}

/** Prix client HT d'un colis selon son poids facturé (première tranche qui le contient). */
export function prixColisHt(poidsKg: number, grandFormat: boolean, grille: GrilleLivraison = GRILLE): number | null {
  const tranche = [...grille.tranches].sort((a, b) => a.max_kg - b.max_kg).find((t) => poidsKg <= t.max_kg + 1e-9);
  return tranche ? (grandFormat ? tranche.prix_gf_HT : tranche.prix_std_HT) : null;
}

/** Corse et DOM-TOM : hors de la zone couverte par la grille (codes postaux 20…, 97…, 98…). */
export function horsZone(codePostal: string | null | undefined): boolean {
  return /^\s*(20|97|98)/.test(codePostal ?? "");
}

/**
 * Dimensions (cm, entiers) d'un colis de `q` pièces empilées, emballage compris — même calcul
 * que le bordereau Boxtal (boxtal.ts, dimensionsColis) : longueur, largeur, hauteur.
 */
export function dimensionsColisCm(r: ResultatDevis, q: number, margeCm = EXPEDITION.margeEmballageCm): [number, number, number] {
  const [a, b] = [...r.geometrie.encombrement_mm].sort((x, y) => y - x);
  const pile = Math.max(1, Math.ceil((r.epaisseur_mm * q) / 10));
  return [Math.ceil(a / 10) + 2 * margeCm, Math.ceil(b / 10) + 2 * margeCm, pile + 2 * margeCm];
}

/** Format Colissimo d'un colis emballé : standard, volumineux, ou null s'il dépasse les limites. */
export function formatColissimo([L, l, h]: [number, number, number], grille: GrilleLivraison = GRILLE): "standard" | "volumineux" | null {
  const c = grille._calcul.colissimo;
  const somme = L + l + h;
  if (somme > c.volumineux_somme_max_cm) return null;
  return L > c.standard_longueur_max_cm || somme > c.standard_somme_max_cm ? "volumineux" : "standard";
}

export function expedition(r: ResultatDevis, config: ConfigExpedition = EXPEDITION): Expedition {
  const g = config.grille;
  const coef = g._calcul.coef_poids_emballage;
  const poidsPiece = r.masse_nette_kg * coef;
  const poids_kg = arrondi(r.masse_nette_kg * r.quantite, 1);
  const poids_facture_kg = arrondi(poidsPiece * r.quantite, 1);
  const longueur_mm = Math.max(...r.geometrie.encombrement_mm);
  const largeur_mm = Math.min(...r.geometrie.encombrement_mm);
  const maxKg = g.limite_colis.poids_kg;
  const sommeMax = g._calcul.colissimo.volumineux_somme_max_cm;

  // --- colis : découpage le moins cher qui respecte poids et dimensions Colissimo
  const faireColis = (quantite: number): Colis | null => {
    const dimensions_cm = dimensionsColisCm(r, quantite, config.margeEmballageCm);
    const format = formatColissimo(dimensions_cm, g);
    const poids = arrondi(quantite * poidsPiece, 2);
    if (!format || poids > maxKg + 1e-9) return null;
    return { quantite, poids_kg: poids, dimensions_cm, volumineux: format === "volumineux" };
  };
  let colis: Colis[] = [];
  let prixColis: number | null = null;
  let raisonColis: string | null = null;
  const unSeul = dimensionsColisCm(r, 1, config.margeEmballageCm);
  if (poidsPiece > maxKg + 1e-9) {
    raisonColis = `une pièce pèse ${kg(poidsPiece)} kg emballée (colis jusqu'à ${kg(maxKg)} kg)`;
  } else if (!formatColissimo(unSeul, g)) {
    raisonColis = `colis de ${unSeul.join(" × ")} cm, plus de ${sommeMax} cm cumulés (limite Colissimo)`;
  } else {
    const parPoids = Math.max(1, Math.floor(maxKg / poidsPiece + 1e-9));
    const hauteurDispo = sommeMax - unSeul[0] - unSeul[1] - 2 * config.margeEmballageCm; // cm de pile possibles
    const parHauteur = Math.max(1, Math.floor((hauteurDispo * 10) / r.epaisseur_mm + 1e-9));
    const nMin = Math.ceil(r.quantite / Math.min(parPoids, parHauteur));
    for (let n = nMin; n <= Math.min(r.quantite, nMin + 12); n++) {
      const essai = repartir(r.quantite, n).map(faireColis);
      if (essai.some((c) => c === null)) continue;
      const liste = essai as Colis[];
      const prix = liste.reduce<number | null>((s, c) => {
        const p = prixColisHt(c.poids_kg, c.volumineux, g);
        return s === null || p === null ? null : s + p;
      }, 0);
      if (prix !== null && (prixColis === null || prix < prixColis - 1e-9)) {
        colis = liste;
        prixColis = prix;
      }
    }
    if (!colis.length) raisonColis = "dimensions ou poids hors limites Colissimo";
  }
  const grand_format = colis.some((c) => c.volumineux);

  const envois: OffreEnvoi[] = [];
  if (colis.length && prixColis !== null) {
    envois.push({ type: "colis", libelle: `${colis.length} colis`, transporteur: g.transporteur_colis, prix_ht: auDessus(prixColis, config.arrondiEur) });
  }

  // --- palette : dès que la commande ne tient pas dans un seul colis
  const besoinPalette = colis.length !== 1;
  const { palette_poids_max_kg: pMax, palette_longueur_max_cm: lMax, palette_largeur_max_cm: laMax } = g._calcul;
  const paletteTropLourde = pMax !== null && poids_facture_kg > pMax;
  const paletteTropLongue = lMax !== null && longueur_mm > lMax * 10;
  const paletteTropLarge = laMax !== null && largeur_mm > laMax * 10;
  if (besoinPalette && !paletteTropLourde && !paletteTropLongue && !paletteTropLarge) {
    envois.push({ type: "palette", libelle: "1 palette", transporteur: g.transporteur_lourd, prix_ht: auDessus(g.palette.prix_HT, config.arrondiEur) });
  }
  envois.sort((a, b) => a.prix_ht - b.prix_ht);

  const retraits = config.options.filter((o) => o.retrait);
  if (!envois.length) {
    const pourquoi = paletteTropLongue
      ? `pièce de ${kg(longueur_mm / 1000)} m, trop longue pour une palette`
      : paletteTropLarge
        ? `pièce de ${kg(largeur_mm / 1000)} m de large, trop large pour une palette`
        : paletteTropLourde
          ? `${kg(poids_facture_kg)} kg, trop lourd pour une palette`
          : (raisonColis ?? "envoi impossible à chiffrer");
    return { mode: "sur_devis", poids_kg, poids_facture_kg, longueur_mm, grand_format, colis: [], envois, options: retraits, raison: `Livraison sur devis : ${pourquoi}.` };
  }
  return {
    mode: envois[0].type,
    poids_kg,
    poids_facture_kg,
    longueur_mm,
    grand_format,
    colis,
    envois,
    options: config.options,
    raison: raisonColis ? `Envoi sur palette : ${raisonColis}.` : null,
  };
}

export type DetailFrais = {
  /** Frais d'envoi : colis ou palette, prix de la grille ADM. */
  port_ht: number;
  /** Supplément du délai (ex. express = % de la commande) et part fixe éventuelle. */
  supplement_ht: number;
  total_ht: number;
};

/** Frais de livraison HT d'une option : frais d'envoi (si transport) + supplément du délai. */
export function detailFrais(option: OptionLivraison, totalPiecesHt: number, fraisEnvoiHt = 0, arrondiEur = EXPEDITION.arrondiEur): DetailFrais {
  const port_ht = option.transport ? auDessus(fraisEnvoiHt, arrondiEur) : 0;
  const supplement_ht = auDessus(option.prix_eur_ht + (option.pourcentage_commande ?? 0) * totalPiecesHt, arrondiEur);
  return { port_ht, supplement_ht, total_ht: arrondi(port_ht + supplement_ht, 2) };
}

/** Frais de livraison HT (sans le détail). */
export function fraisLivraisonHt(option: OptionLivraison, totalPiecesHt: number, fraisEnvoiHt = 0, arrondiEur = EXPEDITION.arrondiEur): number {
  return detailFrais(option, totalPiecesHt, fraisEnvoiHt, arrondiEur).total_ht;
}

/** Libellé client de la règle de prix : « frais d'envoi + 15 % de la commande ». */
export function libelleTarifLivraison(o: OptionLivraison): string {
  const pct = o.pourcentage_commande ?? 0;
  if (o.offerte) return "livraison offerte";
  const parts = [
    o.transport ? "frais d'envoi" : null,
    o.prix_eur_ht > 0 ? `${o.prix_eur_ht.toLocaleString("fr-FR")} € HT` : null,
    pct > 0 ? `${(pct * 100).toLocaleString("fr-FR")} % de la commande` : null,
  ].filter(Boolean);
  return parts.join(" + ");
}

/**
 * Choix présenté au client avant paiement. Structure VALIDÉE PAR ADM — ne pas la modifier,
 * ne pas masquer une étape (test/commande.test.ts la verrouille) :
 *   1. Retrait à l'atelier — gratuit
 *   2. Livraison — frais de livraison
 *      2.1 envoi : en colis ou sur palette (le choix n'apparaît que si les deux sont possibles)
 *      2.2 choix entre expédition en 2 jours et en 7 jours
 *      2.3 le prix du délai s'ajoute aux frais de livraison
 */
export type EtapesLivraison = {
  retrait: { cle: string; libelle: string; prix_ht: 0 } | null;
  livraison: {
    disponible: boolean;
    /** Pourquoi la livraison est sur devis, ou pourquoi seule la palette est proposée. */
    raison: string | null;
    /** 2.1 : envois possibles et leurs frais HT, du moins cher au plus cher. */
    envois: OffreEnvoi[];
    /** 2.2 : les délais, du plus rapide au plus lent ; 2.3 : total = frais d'envoi + supplément, par envoi. */
    delais: { cle: string; libelle: string; delai_jours?: number; supplement_ht: number | null; totaux: Partial<Record<Envoi, number>> }[];
  };
};

export function etapesLivraison(piece: Piece, config: ConfigExpedition = EXPEDITION): EtapesLivraison | null {
  const r = devis(piece);
  if (!r.ok) return null;
  const { ok: _ok, ...resultat } = r;
  const exp = expedition(resultat, config);
  const optionRetrait = config.options.find((o) => o.retrait);
  const disponible = exp.envois.length > 0;
  const delais = config.options
    .filter((o) => !o.retrait)
    .sort((a, b) => (a.delai_jours ?? 0) - (b.delai_jours ?? 0))
    .map((o) => {
      const totaux: Partial<Record<Envoi, number>> = {};
      for (const e of exp.envois) totaux[e.type] = detailFrais(o, resultat.total_ht, e.prix_ht, config.arrondiEur).total_ht;
      return { cle: o.cle, libelle: o.libelle, delai_jours: o.delai_jours, supplement_ht: disponible ? detailFrais(o, resultat.total_ht, 0, config.arrondiEur).supplement_ht : null, totaux };
    });
  return {
    retrait: optionRetrait ? { cle: optionRetrait.cle, libelle: optionRetrait.libelle, prix_ht: 0 } : null,
    livraison: { disponible, raison: exp.raison, envois: exp.envois, delais },
  };
}

export const MESSAGE_TRANSPORT_SUR_DEVIS =
  "Le transport de cette commande se chiffre sur devis : demandez votre devis, nous vous répondons rapidement avec le prix livré.";

export type Commande =
  | {
      ok: true;
      resultat: ResultatDevis;
      expedition: Expedition;
      livraison: OptionLivraison & DetailFrais & { envoi: OffreEnvoi | null; prix_ht: number; prix_ttc: number };
      total_ht: number;
      total_ttc: number;
      /** Montants en centimes TTC, tels qu'envoyés à Stripe. */
      centimes: { pieces: number; livraison: number; total: number };
    }
  | { ok: false; message: string; expedition?: Expedition };

/**
 * Commande prête à payer. `envoi` : colis ou palette, choisi par le client quand les deux sont
 * proposés ; à défaut, l'envoi le moins cher.
 */
export function construireCommande(piece: Piece, cleLivraison: string, envoi?: Envoi | "", config: ConfigExpedition = EXPEDITION): Commande {
  const r = devis(piece);
  if (!r.ok) return { ok: false, message: r.message };
  const { ok: _ok, ...resultat } = r;

  const exp = expedition(resultat, config);
  if (exp.options.length === 0) return { ok: false, message: `${exp.raison ?? ""} ${MESSAGE_TRANSPORT_SUR_DEVIS}`.trim(), expedition: exp };

  // Seules les options proposées pour CETTE commande sont acceptées.
  const option = exp.options.find((o) => o.cle === cleLivraison);
  if (!option) return { ok: false, message: "Choisissez la livraison ou le retrait à l'atelier parmi les options proposées.", expedition: exp };

  let offre: OffreEnvoi | null = null;
  if (option.transport) {
    offre = envoi ? (exp.envois.find((e) => e.type === envoi) ?? null) : (exp.envois[0] ?? null);
    if (!offre) {
      return {
        ok: false,
        message: envoi ? "Cet envoi n'est pas proposé pour cette commande : choisissez parmi les envois affichés." : `${exp.raison ?? ""} ${MESSAGE_TRANSPORT_SUR_DEVIS}`.trim(),
        expedition: exp,
      };
    }
  }

  const detail = detailFrais(option, resultat.total_ht, offre?.prix_ht ?? 0, config.arrondiEur);
  const prix_ht = detail.total_ht;
  const prix_ttc = arrondi(prix_ht * (1 + tarifs.tva_taux), 2);
  const centimes = {
    pieces: Math.round(resultat.total_ttc * 100),
    livraison: Math.round(prix_ttc * 100),
    total: 0,
  };
  centimes.total = centimes.pieces + centimes.livraison;

  return {
    ok: true,
    resultat,
    expedition: exp,
    livraison: { ...option, ...detail, envoi: offre, prix_ht, prix_ttc },
    total_ht: arrondi(resultat.total_ht + prix_ht, 2),
    total_ttc: centimes.total / 100,
    centimes,
  };
}
