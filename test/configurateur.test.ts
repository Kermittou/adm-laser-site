import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/devis/catalogue";
import { bornes, dimensionsEffectives, dimensionsParDefaut, epaisseurProche } from "@/lib/devis/configurateur";
import { dessiner } from "@/lib/devis/dessin";
import { geometrie } from "@/lib/devis/geometrie";
import { devis } from "@/lib/devis/moteur";

const FORMES = Object.keys(catalogue.formes).filter((f) => f !== "personnalisee");

// Générateur pseudo-aléatoire déterministe : le test rejoue toujours les mêmes cas.
function alea(graine: number) {
  let s = graine;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

describe("configurateur — ne jamais proposer un choix que le moteur refusera", () => {
  it("toute combinaison matière × nuance × épaisseur × forme proposée est chiffrable", () => {
    const refus: string[] = [];
    const r = alea(42);
    for (const [mk, m] of Object.entries(catalogue.matieres)) {
      if (!m.devis_automatique) continue;
      for (const [nk, n] of Object.entries(m.nuances)) {
        for (const ep of n.epaisseurs) {
          for (const forme of FORMES) {
            // cotes par défaut, puis 15 tirages au hasard dans les bornes des curseurs
            const essais = [dimensionsParDefaut(forme)];
            for (let i = 0; i < 15; i++) {
              const brut = Object.fromEntries(catalogue.formes[forme].parametres.map((p) => [p.cle, Math.round(p.min + r() * (p.max - p.min))]));
              essais.push(brut);
            }
            for (const dims of essais) {
              const eff = dimensionsEffectives(forme, dims, ep);
              for (const b of bornes(forme, eff, ep)) {
                expect(eff[b.cle]).toBeGreaterThanOrEqual(b.minEffectif);
                expect(eff[b.cle]).toBeLessThanOrEqual(b.maxEffectif);
              }
              const res = devis({ matiere: mk, nuance: nk, epaisseur_mm: ep, forme, dimensions: eff, quantite: 1 + Math.floor(r() * 200) });
              if (!res.ok) refus.push(`${mk}.${nk} ${ep} mm ${forme} ${JSON.stringify(eff)} → ${res.message}`);
            }
          }
        }
      }
    }
    expect(refus.slice(0, 5)).toEqual([]);
  });

  it("le changement de nuance garde l'épaisseur la plus proche", () => {
    expect(epaisseurProche([1, 2, 3], 5)).toBe(3);
    expect(epaisseurProche([0.5, 1, 1.5], 1.2)).toBe(1);
  });
});

describe("dessin technique", () => {
  it.each(FORMES)("%s : le dessin a l'encombrement du moteur et une cote par paramètre", (forme) => {
    const d = dimensionsParDefaut(forme);
    const dessin = dessiner(forme, d)!;
    const geo = geometrie(forme, d);
    expect(dessin.path.length).toBeGreaterThan(0);
    expect(dessin.largeur).toBeCloseTo(geo.encombrement_mm[0], 6);
    expect(dessin.hauteur).toBeCloseTo(geo.encombrement_mm[1], 6);
    // chaque cote saisie par le client apparaît sur le dessin
    const labels = dessin.cotes.map((c) => c.label).join(" | ");
    for (const p of catalogue.formes[forme].parametres) {
      expect(labels).toContain(d[p.cle].toLocaleString("fr-FR"));
    }
  });

  it("les découpes intérieures sont des sous-chemins (fill-rule evenodd)", () => {
    for (const forme of ["cadre_coupe_circulaire", "cadre_coupe_rectangle"]) {
      expect(dessiner(forme, dimensionsParDefaut(forme))!.path.match(/M/g)!.length).toBeGreaterThanOrEqual(2);
    }
  });
});
