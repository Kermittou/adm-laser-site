import { describe, expect, it } from "vitest";
import { devis } from "@/lib/devis/moteur";
import type { CodeRefus, Piece } from "@/lib/devis/types";

/** Ce que le moteur doit REFUSER : un devis à faire à la main, avec un message lisible par un client. */
const base: Piece = { matiere: "acier", nuance: "brut", epaisseur_mm: 3, forme: "rectangle", dimensions: { longueur: 300, largeur: 200 }, quantite: 1 };

const cas: [string, Piece, CodeRefus, RegExp][] = [
  ["galvanisé en 5 mm", { ...base, nuance: "galvanise", epaisseur_mm: 5 }, "epaisseur_indisponible", /1, 2 et 3 mm/],
  ["inox brossé en 10 mm", { ...base, matiere: "inox", nuance: "brosse", epaisseur_mm: 10 }, "epaisseur_indisponible", /1, 2, 3 et 4 mm/],
  ["trou Ø6 dans 10 mm", { ...base, epaisseur_mm: 10, features: [{ type: "trou", diametre_mm: 6 }] }, "trou_trop_petit", /Ø10 mm/],
  [
    "cadre avec Ø intérieur 5 mm en 10 mm",
    { ...base, epaisseur_mm: 10, forme: "cadre_coupe_circulaire", dimensions: { longueur: 300, largeur: 300, diametre_interieur: 5 } },
    "trou_trop_petit",
    /Ø10 mm/,
  ],
  [
    "cadre avec découpe 4 × 50 en 8 mm",
    { ...base, epaisseur_mm: 8, forme: "cadre_coupe_rectangle", dimensions: { longueur: 300, largeur: 300, longueur_interieure: 50, largeur_interieure: 4 } },
    "trou_trop_petit",
    /Ø8 mm/,
  ],
  ["pièce 3500 × 1200", { ...base, dimensions: { longueur: 3500, largeur: 1200 } }, "hors_format", /dépasse notre format de tôle/],
  ["cuivre", { ...base, matiere: "cuivre", nuance: "brut", epaisseur_mm: 2 }, "devis_manuel", /mail/],
  ["laiton", { ...base, matiere: "laiton", nuance: "brut", epaisseur_mm: 2 }, "devis_manuel", /mail/],
  [
    "découpe intérieure plus grande que la pièce",
    { ...base, forme: "cadre_coupe_circulaire", dimensions: { longueur: 200, largeur: 200, diametre_interieur: 250 } },
    "decoupe_trop_grande",
    /plus petit que la pièce/,
  ],
  [
    "découpe rectangulaire plus grande que la pièce",
    { ...base, forme: "cadre_coupe_rectangle", dimensions: { longueur: 300, largeur: 200, longueur_interieure: 300, largeur_interieure: 100 } },
    "decoupe_trop_grande",
    /plus petite que la pièce/,
  ],
  ["coupe en coin trop grande", { ...base, forme: "rectangle_coupe_coin", dimensions: { longueur: 300, largeur: 200, coupe_x: 300, coupe_y: 50 } }, "decoupe_trop_grande", /coupe/],
  ["quantité nulle", { ...base, quantite: 0 }, "quantite_invalide", /quantité/],
  ["cote sous le minimum", { ...base, dimensions: { longueur: 5, largeur: 200 } }, "dimension_invalide", /au moins 20 mm/],
];

describe("garde-fous", () => {
  it.each(cas)("refuse : %s", (_, piece, code, motif) => {
    const r = devis(piece);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe(code);
    expect(r.message).toMatch(motif);
    // Message pour le client : en français, sans clé technique entre guillemets.
    expect(r.message).not.toMatch(/'[a-z_]+'/);
  });

  it("accepte le plus petit trou possible (Ø = épaisseur)", () => {
    for (const e of [1, 2, 3, 5, 8, 10]) {
      expect(devis({ ...base, epaisseur_mm: e, quantite: 10, features: [{ type: "trou", diametre_mm: e }] }).ok).toBe(true);
    }
  });

  it("chaque refus propose une issue au client", () => {
    for (const [, piece] of cas) {
      const r = devis(piece);
      if (!r.ok && !["quantite_invalide", "dimension_invalide", "decoupe_trop_grande"].includes(r.code)) {
        expect(r.message).toMatch(/contact|écrivez|mail/i);
      }
    }
  });
});
