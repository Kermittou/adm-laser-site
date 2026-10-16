import { describe, expect, it } from "vitest";
import { calculer, minutesFacturees, tarifs, type Contexte } from "@/lib/devis/moteur";
import { catalogue } from "@/lib/devis/catalogue";
import type { Piece } from "@/lib/devis/types";

/**
 * Invariants de prix, testés en propriété sur des plages de quantités.
 *
 * Note sur l'arrondi à la minute (piège n°2) : il porte sur la commande entière, donc le coût
 * machine par pièce vaut minutes(q) × prix_minute / q, qui n'est pas monotone — passer une
 * minute entamée ajoute d'un coup un prix-minute au total. L'unitaire peut donc remonter de
 * quelques centimes d'une quantité à la suivante, y compris dans l'oracle Python. Les tests
 * ci-dessous bornent cet artefact : toute remontée plus grande que « une minute répartie sur
 * la commande » est un vrai défaut (coût fixe mal réparti, tôle facturée entière…).
 */

const platine36: Piece = { matiere: "acier", nuance: "brut", epaisseur_mm: 3, forme: "rectangle", dimensions: { longueur: 300, largeur: 300 }, quantite: 1 };
const platine63: Piece = { ...platine36, dimensions: { longueur: 300, largeur: 200 } };
const PIECES: [string, Piece][] = [
  ["platine 300×300 (36 par tôle)", platine36],
  ["platine 300×200 (63 par tôle)", platine63],
  ["platine 300×300 acier 8 mm", { ...platine36, epaisseur_mm: 8 }],
  ["cadre Ø250 acier 1 mm", { ...platine36, epaisseur_mm: 1, forme: "cadre_coupe_circulaire", dimensions: { longueur: 300, largeur: 300, diametre_interieur: 250 } }],
  ["disque Ø400 inox 4 mm", { ...platine36, matiere: "inox", epaisseur_mm: 4, forme: "disque", dimensions: { diametre: 400 } }],
];

// Le plus cher des taux de coupe (€/min) : borne de l'artefact d'arrondi, quelle que soit la pièce.
const PRIX_MINUTE = Math.max(...tarifs.taux_coupe_eur_min.flatMap((g) => g.tranches.map((t) => t.eur_min)));
const unitaire = (p: Piece, q: number, ctx?: Contexte) => calculer({ ...p, quantite: q }, ctx).prix_unitaire_ht;
const total = (p: Piece, q: number, ctx?: Contexte) => calculer({ ...p, quantite: q }, ctx).total_ht;
const plage = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe("pièces de référence", () => {
  it("les platines ont bien 36 et 63 pièces par tôle", () => {
    expect(calculer(platine36).pieces_par_tole).toBe(36);
    expect(calculer(platine63).pieces_par_tole).toBe(63);
  });
});

describe("1. le prix unitaire décroît quand la quantité monte", () => {
  it.each(PIECES)("%s : strictement décroissant sur les paliers 1, 5, 10, 25, 50, 100, 250", (_, p) => {
    const u = [1, 5, 10, 25, 50, 100, 250].map((q) => unitaire(p, q));
    for (let i = 1; i < u.length; i++) expect(u[i]).toBeLessThan(u[i - 1]);
  });

  it.each(PIECES)("%s : de 1 à 400, aucune remontée au-delà de l'artefact d'arrondi minute", (_, p) => {
    for (const q of plage(1, 399)) {
      const hausse = unitaire(p, q + 1) - unitaire(p, q);
      expect(hausse, `quantité ${q} → ${q + 1}`).toBeLessThanOrEqual(PRIX_MINUTE / (q + 1) + 0.01);
    }
  });

  it.each(PIECES)("%s : l'unitaire à 400 pièces est inférieur à l'unitaire à toute quantité ≤ 200", (_, p) => {
    const u400 = unitaire(p, 400);
    for (const q of plage(1, 200)) expect(u400).toBeLessThan(unitaire(p, q));
  });

  // Version stricte du brief (CLAUDE.md, invariant 1). Incompatible avec l'arrondi minute sur
  // la commande entière : elle échoue aussi sur l'oracle Python calibré (ex. 300×200 : 15 pces
  // 6,09 € → 16 pces 6,10 €). Désactivée en attendant l'arbitrage d'ADM — ne pas « corriger »
  // en touchant aux coefficients.
  it.skip("[À ARBITRER] strictement décroissant pour chaque quantité de 1 à 400", () => {
    for (const [, p] of PIECES) for (const q of plage(1, 399)) expect(unitaire(p, q + 1)).toBeLessThanOrEqual(unitaire(p, q));
  });
});

describe("2. le total croît strictement quand la quantité monte", () => {
  it.each(PIECES.slice(0, 3))("%s : de 1 à 400", (_, p) => {
    for (const q of plage(1, 399)) expect(total(p, q + 1), `quantité ${q} → ${q + 1}`).toBeGreaterThan(total(p, q));
  });

  // Pièces légères : le minimum de commande (plancher) aplatit le total sur les toutes premières
  // quantités — c'est sa fonction. Hors plancher, le total doit croître strictement.
  it.each(PIECES.slice(3))("%s : jamais en baisse, et strictement croissant dès que le minimum ne s'applique plus", (_, p) => {
    for (const q of plage(1, 399)) {
      const a = calculer({ ...p, quantite: q });
      const b = calculer({ ...p, quantite: q + 1 });
      expect(b.total_ht, `quantité ${q} → ${q + 1}`).toBeGreaterThanOrEqual(a.total_ht);
      if (!b.prix_minimum_applique) expect(b.total_ht, `quantité ${q} → ${q + 1}`).toBeGreaterThan(a.total_ht);
    }
  });
});

describe("3. pas de dent de scie aux bascules de tôle", () => {
  it.each([
    ["63 par tôle", platine63, [61, 62, 63, 64, 65, 126, 127]],
    ["36 par tôle", platine36, [35, 36, 37, 38, 71, 72, 73, 74]],
  ] as const)("%s : à la bascule, aucune remontée au-delà de l'artefact d'arrondi minute", (_, p, qs) => {
    for (let i = 1; i < qs.length; i++) {
      const hausse = unitaire(p, qs[i]) - unitaire(p, qs[i - 1]);
      expect(hausse, `quantité ${qs[i - 1]} → ${qs[i]}`).toBeLessThanOrEqual(PRIX_MINUTE / qs[i] + 0.01);
    }
  });

  it("le chargement de tôle est réparti au prorata, jamais par tôle entière", () => {
    // Chargement démesuré (5 h) : facturé par tôle entière, la 64e pièce coûterait ~9,50 € de plus.
    const ctx: Contexte = { catalogue, tarifs: { ...tarifs, temps_chargement_tole_s: 5 * 3600 } };
    for (const q of [62, 63, 64, 65, 126, 127]) {
      const hausse = unitaire(platine63, q + 1, ctx) - unitaire(platine63, q, ctx);
      expect(hausse, `quantité ${q} → ${q + 1}`).toBeLessThanOrEqual(PRIX_MINUTE / (q + 1) + 0.01);
    }
  });

  // Version stricte du brief (invariant 3) : 62 → 63 pièces passe de 5,14 € à 5,16 €, déjà dans
  // l'oracle Python. Même cause que l'invariant 1 : l'arrondi minute, pas la tôle.
  it.skip("[À ARBITRER] unitaire jamais en hausse de 61 à 65 et de 126 à 127", () => {
    const qs = [61, 62, 63, 64, 65, 126, 127];
    for (let i = 1; i < qs.length; i++) expect(unitaire(platine63, qs[i])).toBeLessThanOrEqual(unitaire(platine63, qs[i - 1]));
  });
});

describe("4. jamais en dessous du coût marginal", () => {
  it.each([0, 0.1, 0.25, 0.5, 0.9])("remise commerciale de %s : bridée par marge_minimum_pct", (remise) => {
    const ctx: Contexte = { catalogue, tarifs: { ...tarifs, remise_commerciale_pct: remise } };
    for (const [, p] of PIECES) {
      for (const q of [1, 10, 50, 200]) {
        const r = calculer({ ...p, quantite: q }, ctx);
        expect(r.prix_unitaire_ht).toBeGreaterThanOrEqual(r.cout_marginal_ht);
        if (remise > 0) expect(r.prix_unitaire_ht).toBeGreaterThanOrEqual(r.prix_plancher_ht - 0.01);
      }
    }
  });

  it("une remise de 90 % est bien bridée", () => {
    const ctx: Contexte = { catalogue, tarifs: { ...tarifs, remise_commerciale_pct: 0.9 } };
    expect(calculer({ ...platine63, quantite: 200 }, ctx).remise_bridee_par_marge_min).toBe(true);
  });

  it("sans remise, aucun prix sous le coût marginal de 1 à 400", () => {
    for (const [, p] of PIECES) {
      for (const q of plage(1, 400)) {
        const r = calculer({ ...p, quantite: q });
        expect(r.prix_unitaire_ht).toBeGreaterThanOrEqual(r.cout_marginal_ht);
      }
    }
  });
});

describe("5. non-régression : le prix ne peut pas être identique pour 1 et 5 pièces", () => {
  it.each(PIECES)("%s", (_, p) => {
    expect(total(p, 5)).toBeGreaterThan(total(p, 1));
    expect(unitaire(p, 5)).toBeLessThan(unitaire(p, 1));
  });

  it("frais de plan et minimum de commande coexistent : total = max(frais de plan + pièces, minimum)", () => {
    // une petite pièce seule : le minimum mord
    const r1 = calculer({ ...platine36, epaisseur_mm: 1, dimensions: { longueur: 50, largeur: 50 }, quantite: 1 });
    expect(r1.prix_minimum_applique).toBe(true);
    expect(r1.total_ht).toBe(tarifs.prix_minimum_eur);
    // deux platines : les frais de plan s'ajoutent, répartis sur la commande
    const r2 = calculer({ ...platine36, quantite: 2 });
    expect(r2.prix_minimum_applique).toBe(false);
    expect(r2.detail_unitaire.frais_plan).toBeCloseTo(tarifs.frais_plan_eur / 2, 2);
    expect(r2.total_ht).toBeCloseTo(2 * (r2.detail_unitaire.matiere + r2.detail_unitaire.decoupe + r2.detail_unitaire.chute + r2.detail_unitaire.attenuation + r2.detail_unitaire.arrondi) + tarifs.frais_plan_eur, 1);
    expect(Number.isInteger(r2.total_ht)).toBe(true); // total arrondi à l'euro supérieur
  });
});

describe("règle d'arrondi minute", () => {
  it.each([
    [0, 0],
    [10, 0],
    [10.01, 1],
    [60, 1],
    [70, 1],
    [71, 2],
    [323, 6], // 5 min 23 s → 6 min
  ])("%s s → %s min", (s, m) => {
    expect(minutesFacturees(s)).toBe(m);
  });
});

describe("le détail par pièce affiché au client retombe sur le prix unitaire", () => {
  it.each(PIECES)("%s", (_, p) => {
    for (const q of [2, 5, 10, 45, 100]) {
      const r = calculer({ ...p, quantite: q });
      if (r.prix_minimum_applique) continue;
      const d = r.detail_unitaire;
      const somme = d.matiere + d.decoupe + d.majoration + d.features + d.toles + d.attenuation + d.chute + d.frais_plan + d.arrondi;
      expect(Math.abs(somme - r.prix_unitaire_ht), `quantité ${q}`).toBeLessThanOrEqual(0.05);
    }
  });
});
