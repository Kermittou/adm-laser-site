/** Une pièce telle que le client la décrit dans le configurateur. */
export type Piece = {
  matiere: string;
  nuance: string;
  epaisseur_mm: number;
  forme: string;
  /** Cotes de la forme, en mm (clés de catalogue.json → formes[forme].parametres). */
  dimensions: Record<string, number>;
  quantite: number;
  features?: Feature[];
};

/** Petites features à tarif fixe (trou, arrondi). */
export type Feature = { type: "trou"; diametre_mm: number } | { type: "arrondi" };

export type Geometrie = {
  surface_nette_mm2: number;
  perimetre_mm: number;
  encombrement_mm: [number, number];
  surface_englobante_mm2: number;
  percages: number;
};

export type ResultatDevis = {
  /** Taux de coupe appliqué (€/min), selon matière et épaisseur. */
  taux_coupe_eur_min: number;
  /** Surface de tôle facturée par pièce (m²), bande d'imbrication comprise. */
  surface_facturee_m2: number;
  /** Majoration grande pièce appliquée (0 ou ex. 0,15). */
  majoration_grande_piece_pct: number;
  /** Temps de la coupe de chute (s), compté une fois dans le temps machine de la commande. */
  coupe_chute_s: number;
  geometrie: {
    surface_nette_mm2: number;
    perimetre_mm: number;
    encombrement_mm: [number, number];
    surface_englobante_mm2: number;
    percages: number;
  };
  masse_nette_kg: number;
  masse_facturee_kg: number;
  vitesse_mm_s: number;
  temps_coupe_s: number;
  minutes_facturees: number;
  pieces_par_tole: number;
  nombre_de_toles: number;
  detail_unitaire: { matiere: number; decoupe: number; majoration: number; features: number; toles: number; frais_plan: number; chute: number; attenuation: number; arrondi: number };
  prix_unitaire_ht: number;
  cout_unitaire_ht: number;
  cout_marginal_ht: number;
  prix_marginal_ht: number;
  prix_plancher_ht: number;
  marge_realisee_pct: number;
  remise_commerciale_pct: number;
  remise_bridee_par_marge_min: boolean;
  quantite: number;
  epaisseur_mm: number;
  prix_minimum_applique: boolean;
  total_ht: number;
  total_ttc: number;
};

/**
 * Raison d'un refus. Un refus n'est pas une erreur : c'est un devis à faire à la main.
 * Le message est destiné au client final.
 */
export type CodeRefus =
  | "matiere_inconnue"
  | "devis_manuel"
  | "nuance_inconnue"
  | "epaisseur_indisponible"
  | "vitesse_inconnue"
  | "taux_inconnu"
  | "forme_inconnue"
  | "forme_sur_contact"
  | "dimension_invalide"
  | "quantite_invalide"
  | "trou_trop_petit"
  | "hors_format"
  | "decoupe_trop_grande"
  | "feature_inconnue";

export type Devis = ({ ok: true } & ResultatDevis) | { ok: false; code: CodeRefus; message: string };
