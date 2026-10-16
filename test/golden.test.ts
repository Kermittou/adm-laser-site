import { describe, expect, it } from "vitest";
import golden from "@data/golden.json";
import { calculer, tarifs, type Contexte } from "@/lib/devis/moteur";
import { catalogue } from "@/lib/devis/catalogue";
import type { Piece } from "@/lib/devis/types";
import oracle from "./fixtures/moteur_oracle.json";

/**
 * Tests d'acceptation : les 9 devis réels du logiciel ADM (data/golden.json).
 * Tolérance 0,01 € sur les montants, 0,1 sur les grandeurs physiques ; pieces_par_tole et
 * minutes_facturees sont des entiers EXACTS — ce sont eux qui révèlent un piège mal porté.
 */
type Golden = {
  cle: string;
  ajuste_sur_ce_devis: boolean;
  entree: Omit<Piece, "features">;
  prix_logiciel_adm_ht: number;
  attendu: {
    perimetre_mm: number;
    surface_englobante_mm2: number;
    surface_facturee_m2: number;
    masse_facturee_kg: number;
    vitesse_mm_s: number;
    temps_par_piece_s: number;
    taux_coupe_eur_min: number;
    pieces_par_tole: number;
    minutes_facturees: number;
    majoration_grande_piece_pct: number;
    prix_unitaire_ht: number;
    total_ht: number;
  };
};

const SANS_ATTENUATION: Contexte = { catalogue, tarifs: { ...tarifs, attenuation_degressivite_pct: 0 } };
// Pour mesurer l'atténuation seule, sans l'arrondi du total à l'euro.
const SANS_ARRONDI: Contexte = { catalogue, tarifs: { ...tarifs, arrondi_total_ht_eur: 0 } };
const SANS_ARRONDI_NI_ATTENUATION: Contexte = { catalogue, tarifs: { ...tarifs, arrondi_total_ht_eur: 0, attenuation_degressivite_pct: 0 } };

const proche = (reel: number, attendu: number, tol: number) => expect(Math.abs(reel - attendu)).toBeLessThanOrEqual(tol + 1e-9);

describe("golden.json — les 9 devis réels du logiciel ADM", () => {
  it.each((golden as unknown as Golden[]).map((g) => [g.cle, g] as const))("%s", (_, g) => {
    const r = calculer(g.entree);
    const a = g.attendu;

    expect(r.pieces_par_tole).toBe(a.pieces_par_tole);
    expect(r.minutes_facturees).toBe(a.minutes_facturees);
    expect(r.taux_coupe_eur_min).toBe(a.taux_coupe_eur_min);
    expect(r.majoration_grande_piece_pct).toBe(a.majoration_grande_piece_pct);

    proche(r.geometrie.perimetre_mm, a.perimetre_mm, 0.1);
    proche(r.geometrie.surface_englobante_mm2, a.surface_englobante_mm2, 0.1);
    proche(r.surface_facturee_m2, a.surface_facturee_m2, 0.0001);
    proche(r.masse_facturee_kg, a.masse_facturee_kg, 0.1);
    proche(r.vitesse_mm_s, a.vitesse_mm_s, 0.1);
    proche(r.temps_coupe_s, a.temps_par_piece_s, 0.1);

    proche(r.prix_unitaire_ht, a.prix_unitaire_ht, 0.01);
    proche(r.total_ht, a.total_ht, 0.01);
  });

  /**
   * Réglages du logiciel ADM (15/10/2026) : le moteur reste au-dessus du logiciel sur les
   * platines (imbrication en bande plus prudente) et sous lui de 3 % sur les grands cadres.
   * Ces bornes figent l'état accepté : un changement qui les dépasse doit être expliqué.
   * Mesurées SANS l'atténuation de dégressivité, choix commercial ajouté par-dessus (voir plus bas).
   */
  it.each([
    ["cadre-1300-8mm-9", -5, 0],
    ["alu-5mm-50", -1, 1],
    ["acier-3mm-45", 0, 10],
    ["inox-8mm-50", 0, 10],
    ["acier-3mm-5", 0, 20],
    ["acier-10mm-200-1", -2, 2], // la coupe de chute : bande facturée, temps de coupe non
    ["acier-10mm-200-10", -2, 2],
    ["acier-10mm-200-100", -1, 1], // perçage 10 mm à 6 s
  ] as const)("%s : écart au logiciel ADM entre %d %% et %d %%", (cle, min, max) => {
    const g = (golden as unknown as Golden[]).find((x) => x.cle === cle)!;
    const ecart = ((calculer(g.entree, SANS_ATTENUATION).total_ht - g.prix_logiciel_adm_ht) / g.prix_logiciel_adm_ht) * 100;
    expect(ecart).toBeGreaterThanOrEqual(min);
    expect(ecart).toBeLessThanOrEqual(max);
  });
});

/**
 * 3 000 pièces aléatoires (toutes formes, matières, nuances, quantités, trous) chiffrées par
 * reference/moteur_devis.py. Le port doit donner les mêmes montants, ou refuser quand le Python refuse.
 */
type CasOracle = {
  entree: Piece;
  sortie:
    | { refus: string }
    | {
        total_ht: number;
        prix_unitaire_ht: number;
        total_ttc: number;
        minutes_facturees: number;
        pieces_par_tole: number;
        nombre_de_toles: number;
        masse_facturee_kg: number;
        temps_coupe_s: number;
        prix_minimum_applique: boolean;
      };
};

// Refus ajoutés au port, que l'oracle Python ne connaissait pas (voir validerDecoupesInterieures).
const REFUS_AJOUTES = new Set(["trou_trop_petit"]);

describe("oracle Python — 3 000 devis aléatoires", () => {
  const cas = oracle as unknown as CasOracle[];

  it("donne les mêmes montants au centime, ou refuse quand le Python refuse", () => {
    const ecarts: string[] = [];
    for (const [i, c] of cas.entries()) {
      let ts: ReturnType<typeof calculer> | { code: string };
      try {
        ts = calculer(c.entree);
      } catch (e) {
        ts = { code: (e as { code: string }).code };
      }
      const py = c.sortie;
      if ("refus" in py) {
        if (!("code" in ts)) ecarts.push(`#${i} le Python refuse (${py.refus}), le TS chiffre`);
        continue;
      }
      if ("code" in ts) {
        if (!REFUS_AJOUTES.has(ts.code)) ecarts.push(`#${i} le TS refuse (${ts.code}), le Python chiffre`);
        continue;
      }
      if (
        ts.pieces_par_tole !== py.pieces_par_tole ||
        ts.minutes_facturees !== py.minutes_facturees ||
        ts.nombre_de_toles !== py.nombre_de_toles ||
        ts.prix_minimum_applique !== py.prix_minimum_applique ||
        Math.abs(ts.total_ht - py.total_ht) > 0.01 + 1e-9 ||
        Math.abs(ts.total_ttc - py.total_ttc) > 0.01 + 1e-9 ||
        Math.abs(ts.prix_unitaire_ht - py.prix_unitaire_ht) > 0.01 + 1e-9 ||
        Math.abs(ts.masse_facturee_kg - py.masse_facturee_kg) > 0.001 + 1e-9 ||
        Math.abs(ts.temps_coupe_s - py.temps_coupe_s) > 0.01 + 1e-9
      ) {
        const { total_ht, prix_unitaire_ht, total_ttc, minutes_facturees, pieces_par_tole, nombre_de_toles, masse_facturee_kg, temps_coupe_s, prix_minimum_applique } = ts;
        ecarts.push(
          `#${i} TS ${JSON.stringify({ total_ht, prix_unitaire_ht, total_ttc, minutes_facturees, pieces_par_tole, nombre_de_toles, masse_facturee_kg, temps_coupe_s, prix_minimum_applique })} / PY ${JSON.stringify(py)}`,
        );
      }
    }
    expect(ecarts.slice(0, 10)).toEqual([]);
  });

  it("le jeu de cas couvre réellement les formes et les refus", () => {
    const formes = new Set(cas.map((c) => c.entree.forme));
    expect(formes.size).toBe(9);
    expect(cas.filter((c) => "refus" in c.sortie).length).toBeGreaterThan(100);
  });
});

describe("atténuation de la dégressivité (choix ADM)", () => {
  const p = (golden as unknown as Golden[]).find((x) => x.cle === "acier-10mm-200-100")!.entree;
  const pct = tarifs.attenuation_degressivite_pct ?? 0;
  const reduction = (q: number, ctx?: Contexte) => 1 - calculer({ ...p, quantite: q }, ctx).prix_unitaire_ht / calculer({ ...p, quantite: 1 }, ctx).prix_unitaire_ht;

  it("est activée", () => expect(pct).toBeGreaterThan(0));

  it.each([5, 10, 25, 50, 100])("%i pièces : la réduction par rapport à 1 pièce baisse de l'atténuation", (q) => {
    expect(reduction(q, SANS_ARRONDI_NI_ATTENUATION) - reduction(q, SANS_ARRONDI)).toBeCloseTo(pct, 3);
  });

  it("ne change pas le prix d'une pièce seule", () => {
    expect(calculer({ ...p, quantite: 1 }).total_ht).toBe(calculer({ ...p, quantite: 1 }, SANS_ATTENUATION).total_ht);
  });
});
