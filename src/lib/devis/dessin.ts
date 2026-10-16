/**
 * Dessin technique coté d'une forme du catalogue, en coordonnées pièce (mm, y vers le bas).
 * Les découpes intérieures sont des sous-chemins : à tracer avec fill-rule="evenodd".
 */
import { nb } from "./configurateur";

export type Cote = {
  /** Segment mesuré. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Où placer la ligne de cote par rapport au segment. */
  cote: "bas" | "haut" | "gauche" | "dedans";
  /** Pour une cote « dedans » verticale : côté du libellé (droite par défaut). */
  libelleAGauche?: boolean;
  label: string;
};

export type Dessin = { path: string; largeur: number; hauteur: number; cotes: Cote[] };

const mm = (v: number) => `${nb(v)} mm`;
const cercle = (cx: number, cy: number, r: number) => `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;

export function dessiner(forme: string, d: Record<string, number>): Dessin | null {
  switch (forme) {
    case "rectangle": {
      const { longueur: L, largeur: l } = d;
      return {
        path: `M0,0 H${L} V${l} H0 Z`,
        largeur: L,
        hauteur: l,
        cotes: [
          { x1: 0, y1: l, x2: L, y2: l, cote: "bas", label: mm(L) },
          { x1: 0, y1: 0, x2: 0, y2: l, cote: "gauche", label: mm(l) },
        ],
      };
    }
    case "triangle": {
      const { base: b, hauteur: h } = d;
      return {
        path: `M0,0 V${h} H${b} Z`,
        largeur: b,
        hauteur: h,
        cotes: [
          { x1: 0, y1: h, x2: b, y2: h, cote: "bas", label: mm(b) },
          { x1: 0, y1: 0, x2: 0, y2: h, cote: "gauche", label: mm(h) },
        ],
      };
    }
    case "disque": {
      const D = d.diametre;
      const r = D / 2;
      return {
        path: cercle(r, r, r),
        largeur: D,
        hauteur: D,
        cotes: [{ x1: 0, y1: r, x2: D, y2: r, cote: "dedans", label: `Ø ${mm(D)}` }],
      };
    }
    case "rectangle_coupe_coin": {
      const { longueur: L, largeur: l, coupe_x: cx, coupe_y: cy } = d;
      return {
        path: `M0,0 H${L} V${l} H${cx} V${l - cy} H0 Z`,
        largeur: L,
        hauteur: l,
        cotes: [
          { x1: 0, y1: 0, x2: L, y2: 0, cote: "haut", label: mm(L) },
          { x1: 0, y1: 0, x2: 0, y2: l, cote: "gauche", label: mm(l) },
          { x1: 0, y1: l, x2: cx, y2: l, cote: "bas", label: mm(cx) },
          // sur le bord intérieur de l'encoche, libellé dans le vide de la découpe
          { x1: cx, y1: l - cy, x2: cx, y2: l, cote: "dedans", libelleAGauche: true, label: mm(cy) },
        ],
      };
    }
    case "cadre_coupe_circulaire": {
      const { longueur: L, largeur: l, diametre_interieur: di } = d;
      return {
        path: `M0,0 H${L} V${l} H0 Z ${cercle(L / 2, l / 2, di / 2)}`,
        largeur: L,
        hauteur: l,
        cotes: [
          { x1: 0, y1: l, x2: L, y2: l, cote: "bas", label: mm(L) },
          { x1: 0, y1: 0, x2: 0, y2: l, cote: "gauche", label: mm(l) },
          { x1: L / 2 - di / 2, y1: l / 2, x2: L / 2 + di / 2, y2: l / 2, cote: "dedans", label: `Ø ${mm(di)}` },
        ],
      };
    }
    case "cadre_coupe_rectangle": {
      const { longueur: L, largeur: l, longueur_interieure: Li, largeur_interieure: li } = d;
      const x0 = (L - Li) / 2;
      const y0 = (l - li) / 2;
      return {
        path: `M0,0 H${L} V${l} H0 Z M${x0},${y0} H${x0 + Li} V${y0 + li} H${x0} Z`,
        largeur: L,
        hauteur: l,
        cotes: [
          { x1: 0, y1: l, x2: L, y2: l, cote: "bas", label: mm(L) },
          { x1: 0, y1: 0, x2: 0, y2: l, cote: "gauche", label: mm(l) },
          { x1: x0, y1: y0 + li / 2, x2: x0 + Li, y2: y0 + li / 2, cote: "dedans", label: `${mm(Li)} × ${mm(li)}` },
        ],
      };
    }
    case "demi_disque_allonge": {
      const { largeur: w, hauteur: h } = d;
      const r = w / 2;
      return {
        path: `M0,${h} V${r} A${r},${r} 0 0,1 ${w},${r} V${h} Z`,
        largeur: w,
        hauteur: h,
        cotes: [
          { x1: 0, y1: h, x2: w, y2: h, cote: "bas", label: mm(w) },
          { x1: 0, y1: 0, x2: 0, y2: h, cote: "gauche", label: mm(h) },
        ],
      };
    }
    case "trapeze": {
      // Le sommet peut être plus long que la base (trapèze inversé) : on centre les deux.
      const { base: b, sommet: s, hauteur: h } = d;
      const W = Math.max(b, s);
      const ob = (W - b) / 2;
      const os = (W - s) / 2;
      return {
        path: `M${os},0 H${os + s} L${ob + b},${h} H${ob} Z`,
        largeur: W,
        hauteur: h,
        cotes: [
          { x1: ob, y1: h, x2: ob + b, y2: h, cote: "bas", label: mm(b) },
          { x1: os, y1: 0, x2: os + s, y2: 0, cote: "haut", label: mm(s) },
          { x1: 0, y1: 0, x2: 0, y2: h, cote: "gauche", label: mm(h) },
        ],
      };
    }
    default:
      return null;
  }
}
