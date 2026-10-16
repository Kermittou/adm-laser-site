/**
 * Logique pure du configurateur : cascade matière → nuance → épaisseur, bornes des curseurs.
 * Règle : ne jamais proposer un choix que le moteur refusera ensuite.
 */
import { catalogue, type ParametreForme } from "./catalogue";

/** Épaisseur disponible la plus proche de celle demandée (garde le choix du client au plus près). */
export function epaisseurProche(dispo: number[], voulue: number): number {
  return dispo.reduce((meilleure, e) => (Math.abs(e - voulue) < Math.abs(meilleure - voulue) ? e : meilleure), dispo[0]);
}

export function dimensionsParDefaut(forme: string): Record<string, number> {
  return Object.fromEntries(catalogue.formes[forme].parametres.map((p) => [p.cle, p.defaut]));
}

export type Borne = ParametreForme & { minEffectif: number; maxEffectif: number };

/**
 * Bornes des curseurs : celles du catalogue, resserrées par les contraintes entre cotes
 * (découpe intérieure < pièce, trou ≥ épaisseur, coupe en coin < pièce, demi-disque).
 */
export function bornes(forme: string, dims: Record<string, number>, epaisseur: number): Borne[] {
  const d = dims;
  return catalogue.formes[forme].parametres.map((p) => {
    let min = p.min;
    let max = p.max;
    switch (`${forme}.${p.cle}`) {
      case "cadre_coupe_circulaire.diametre_interieur":
        min = Math.max(min, epaisseur);
        max = Math.min(max, Math.min(d.longueur, d.largeur) - 1);
        break;
      case "cadre_coupe_rectangle.longueur_interieure":
        min = Math.max(min, epaisseur);
        max = Math.min(max, d.longueur - 1);
        break;
      case "cadre_coupe_rectangle.largeur_interieure":
        min = Math.max(min, epaisseur);
        max = Math.min(max, d.largeur - 1);
        break;
      case "rectangle_coupe_coin.coupe_x":
        max = Math.min(max, d.longueur - 1);
        break;
      case "rectangle_coupe_coin.coupe_y":
        max = Math.min(max, d.largeur - 1);
        break;
      case "demi_disque_allonge.hauteur":
        min = Math.max(min, Math.ceil(d.largeur / 2));
        break;
    }
    return { ...p, minEffectif: min, maxEffectif: Math.max(min, max) };
  });
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Cotes ramenées dans leurs bornes (après qu'une cote extérieure a été réduite, par exemple). */
export function dimensionsEffectives(forme: string, dims: Record<string, number>, epaisseur: number): Record<string, number> {
  const out = { ...dims };
  // Deux passes : les bornes d'une cote dépendent des autres.
  for (let passe = 0; passe < 2; passe++) {
    for (const b of bornes(forme, out, epaisseur)) {
      const v = out[b.cle];
      if (Number.isFinite(v)) out[b.cle] = borner(v, b.minEffectif, b.maxEffectif);
    }
  }
  return out;
}

/** Pas des boutons − / + : fin sur les petites cotes, plus large sur les grandes. */
export function pas(v: number): number {
  return v >= 500 ? 25 : v >= 100 ? 10 : 5;
}

/** Formats d'affichage français. */
export const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const nb = (n: number, dec = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: dec });
