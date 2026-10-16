/**
 * Géométrie des formes du catalogue — port exact de geometrie() dans reference/moteur_devis.py.
 *
 * Deux subtilités :
 *  - rectangle_coupe_coin : le créneau ajoute autant de trajet qu'il en retire, le périmètre
 *    reste 2(L+l). Seule la surface change.
 *  - les deux cadre_* comptent 2 perçages (contour extérieur + amorçage intérieur).
 */
import { DevisImpossible } from "./erreurs";
import type { Geometrie } from "./types";

function geo(surface: number, perimetre: number, bx: number, by: number, percages: number): Geometrie {
  return {
    surface_nette_mm2: surface,
    perimetre_mm: perimetre,
    encombrement_mm: [bx, by],
    surface_englobante_mm2: bx * by,
    percages,
  };
}

export function geometrie(forme: string, d: Record<string, number>): Geometrie {
  switch (forme) {
    case "rectangle": {
      const { longueur: L, largeur: l } = d;
      return geo(L * l, 2 * (L + l), L, l, 1);
    }

    case "triangle": {
      const { base: b, hauteur: h } = d;
      return geo((b * h) / 2, b + h + Math.hypot(b, h), b, h, 1);
    }

    case "disque": {
      const dia = d.diametre;
      return geo((Math.PI * dia ** 2) / 4, Math.PI * dia, dia, dia, 1);
    }

    case "rectangle_coupe_coin": {
      const { longueur: L, largeur: l, coupe_x: cx, coupe_y: cy } = d;
      if (cx >= L || cy >= l) {
        throw new DevisImpossible(
          "decoupe_trop_grande",
          "La coupe en coin doit rester plus petite que la pièce : réduisez la coupe X ou la coupe Y.",
        );
      }
      // le créneau ajoute autant de trajet qu'il en retire : périmètre inchangé
      return geo(L * l - cx * cy, 2 * (L + l), L, l, 1);
    }

    case "cadre_coupe_circulaire": {
      const { longueur: L, largeur: l, diametre_interieur: di } = d;
      if (di >= Math.min(L, l)) {
        throw new DevisImpossible(
          "decoupe_trop_grande",
          "Le diamètre intérieur doit rester plus petit que la pièce : réduisez le Ø intérieur ou agrandissez le cadre.",
        );
      }
      return geo(L * l - (Math.PI * di ** 2) / 4, 2 * (L + l) + Math.PI * di, L, l, 2);
    }

    case "cadre_coupe_rectangle": {
      const { longueur: L, largeur: l, longueur_interieure: Li, largeur_interieure: li } = d;
      if (Li >= L || li >= l) {
        throw new DevisImpossible(
          "decoupe_trop_grande",
          "La découpe intérieure doit rester plus petite que la pièce : réduisez la découpe ou agrandissez le cadre.",
        );
      }
      return geo(L * l - Li * li, 2 * (L + l) + 2 * (Li + li), L, l, 2);
    }

    case "demi_disque_allonge": {
      const { largeur: w, hauteur: h } = d;
      if (h < w / 2) {
        throw new DevisImpossible(
          "dimension_invalide",
          `La hauteur totale doit valoir au moins la moitié de la largeur (${w / 2} mm ici) pour former le demi-disque.`,
        );
      }
      const droit = h - w / 2; // partie rectangulaire sous le demi-disque
      return geo(w * droit + (Math.PI * w ** 2) / 8, w + 2 * droit + (Math.PI * w) / 2, w, h, 1);
    }

    case "trapeze": {
      const { base: b, sommet: s, hauteur: h } = d;
      const cote = Math.hypot((b - s) / 2, h);
      return geo(((b + s) * h) / 2, b + s + 2 * cote, Math.max(b, s), h, 1);
    }

    case "personnalisee": {
      // l'éditeur de tracé en ligne fournira directement la géométrie (hors périmètre de cette itération)
      const s = d.surface_mm2;
      return geo(s, d.perimetre_mm, d.encombrement_x ?? Math.sqrt(s), d.encombrement_y ?? Math.sqrt(s), d.percages ?? 1);
    }

    default:
      throw new DevisImpossible("forme_inconnue", "Cette forme n'est pas disponible en ligne. Envoyez-nous votre plan, nous la chiffrons.");
  }
}
