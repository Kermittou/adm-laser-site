import { describe, expect, it } from "vitest";
import { construireCommande, EXPEDITION, etapesLivraison, expedition, formatColissimo, fraisLivraisonHt, GRILLE, horsZone, prixColisHt, repartir } from "@/lib/commande";
import { calculer, tarifs } from "@/lib/devis/moteur";
import type { Piece } from "@/lib/devis/types";

const petite: Piece = { matiere: "acier", nuance: "brut", epaisseur_mm: 3, forme: "rectangle", dimensions: { longueur: 300, largeur: 200 }, quantite: 10 };
const platines45: Piece = { ...petite, dimensions: { longueur: 300, largeur: 300 }, quantite: 45 };
const cadres1300: Piece = {
  ...petite,
  epaisseur_mm: 8,
  forme: "cadre_coupe_rectangle",
  dimensions: { longueur: 1300, largeur: 1300, longueur_interieure: 56, largeur_interieure: 56 },
  quantite: 9,
};
const longue1300: Piece = { ...petite, epaisseur_mm: 1, dimensions: { longueur: 1300, largeur: 100 }, quantite: 1 };
const longue1600: Piece = { ...petite, epaisseur_mm: 1, dimensions: { longueur: 1600, largeur: 100 }, quantite: 1 };
const lourde: Piece = { ...petite, epaisseur_mm: 15, dimensions: { longueur: 800, largeur: 800 }, quantite: 1 };
const plaque1000: Piece = { ...petite, epaisseur_mm: 1, dimensions: { longueur: 1000, largeur: 1000 }, quantite: 1 };
const plaque1100: Piece = { ...petite, epaisseur_mm: 1, dimensions: { longueur: 1100, largeur: 800 }, quantite: 1 };

describe("tarifs.json — options de livraison", () => {
  it("retrait gratuit, ou livraison (frais d'envoi) + délai : 7 jours sans supplément, 2 jours + 15 %", () => {
    expect(
      EXPEDITION.options.map((o) => [o.cle, o.delai_jours ?? null, o.prix_eur_ht, o.pourcentage_commande ?? 0, Boolean(o.transport), Boolean(o.offerte), Boolean(o.retrait)]),
    ).toEqual([
      ["express", 2, 0, 0.15, true, false, false],
      ["standard", 7, 0, 0, true, false, false],
      ["retrait", null, 0, 0, false, false, true],
    ]);
    // aucune livraison gratuite : toute option hors retrait paie les frais d'envoi
    expect(EXPEDITION.options.filter((o) => !o.retrait && !o.transport)).toEqual([]);
  });
});

describe("grille de livraison ADM (data/grille-livraison.json)", () => {
  it("colis : 30 kg, règles de dimensions La Poste, poids × 1,15", () => {
    expect(GRILLE.limite_colis.poids_kg).toBe(30);
    expect(GRILLE._calcul.colissimo).toEqual({ standard_longueur_max_cm: 100, standard_somme_max_cm: 150, volumineux_somme_max_cm: 200 });
    expect(GRILLE._calcul.coef_poids_emballage).toBe(1.15);
  });

  it("format Colissimo : standard (L ≤ 100 et L+l+h ≤ 150), volumineux jusqu'à 200 cm cumulés, sinon refusé", () => {
    expect(formatColissimo([34, 24, 7])).toBe("standard");
    expect(formatColissimo([100, 40, 10])).toBe("standard");
    expect(formatColissimo([101, 10, 5])).toBe("volumineux"); // trop long
    expect(formatColissimo([90, 40, 25])).toBe("volumineux"); // 155 cm cumulés
    expect(formatColissimo([164, 14, 5])).toBe("volumineux"); // 183 cm
    expect(formatColissimo([104, 104, 5])).toBeNull(); // 213 cm
  });

  it("prix client HT par tranche de poids, standard et grand format", () => {
    expect(prixColisHt(0.5, false)).toBe(12.9);
    expect(prixColisHt(1, false)).toBe(12.9);
    expect(prixColisHt(1.01, false)).toBe(17.9);
    expect(prixColisHt(16.56, false)).toBe(33.9);
    expect(prixColisHt(30, false)).toBe(40.9);
    expect(prixColisHt(30, true)).toBe(60.9);
    expect(prixColisHt(1.2, true)).toBe(27.9);
    expect(prixColisHt(30.5, false)).toBeNull();
  });

  it("palette : 129,90 € HT dans la grille, 130 € une fois arrondie", () => {
    expect(GRILLE.palette.prix_HT).toBe(129.9);
    expect(expedition(calculer(lourde)).envois[0].prix_ht).toBe(130);
  });

  it("hors zone : Corse et DOM-TOM", () => {
    expect(["20000", "20290", "97400", "98800"].map(horsZone)).toEqual([true, true, true, true]);
    expect(["77360", "75001", "02000", "", null].map(horsZone)).toEqual([false, false, false, false, false]);
  });
});

describe("envoi en colis", () => {
  it("répartit les pièces le plus également possible", () => {
    expect(repartir(45, 4)).toEqual([12, 11, 11, 11]);
    expect(repartir(10, 1)).toEqual([10]);
    expect(repartir(7, 7)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it("10 platines 300×200 (14,4 kg nets → 16,56 kg facturés) : un colis standard 34 × 24 × 7 cm, 33,90 → 34 €", () => {
    const e = expedition(calculer(petite));
    expect(e.mode).toBe("colis");
    expect(e.colis).toEqual([{ quantite: 10, poids_kg: 16.56, dimensions_cm: [34, 24, 7], volumineux: false }]);
    expect(e.envois.map((x) => [x.type, x.prix_ht])).toEqual([["colis", 34]]);
  });

  it("pièce de 1,3 m : colis volumineux (longueur > 100 cm) au tarif grand format, 27,90 → 28 €", () => {
    const e = expedition(calculer(longue1300));
    expect(e.colis[0].dimensions_cm).toEqual([134, 14, 5]);
    expect(e.colis[0].volumineux).toBe(true);
    expect(e.grand_format).toBe(true);
    expect(e.envois.map((x) => [x.type, x.prix_ht])).toEqual([["colis", 28]]);
  });

  it("pièce de 1,6 m : encore un colis volumineux (183 cm cumulés ≤ 200)", () => {
    const e = expedition(calculer(longue1600));
    expect(e.colis[0].dimensions_cm).toEqual([164, 14, 5]);
    expect(e.envois.map((x) => x.type)).toEqual(["colis"]);
  });

  it("400 petites pièces : la pile reste dans les dimensions, en 2 colis de 18,4 kg", () => {
    const e = expedition(calculer({ ...petite, epaisseur_mm: 1, dimensions: { longueur: 100, largeur: 100 }, quantite: 400 }));
    expect(e.colis.map((c) => [c.quantite, c.poids_kg, c.dimensions_cm])).toEqual([
      [200, 18.4, [14, 14, 24]],
      [200, 18.4, [14, 14, 24]],
    ]);
    for (const c of e.colis) expect(formatColissimo(c.dimensions_cm)).not.toBeNull();
  });

  it("aucun colis ne dépasse 30 kg facturés, quelle que soit la quantité", () => {
    for (const q of [1, 12, 13, 26, 27, 100, 400]) {
      const e = expedition(calculer({ ...platines45, quantite: q }));
      expect(e.colis.reduce((s, c) => s + c.quantite, 0)).toBe(q);
      for (const c of e.colis) expect(c.poids_kg).toBeLessThanOrEqual(30);
    }
  });
});

describe("plus d'un colis : le client choisit entre colis et palette", () => {
  it("45 platines 300×300 (111,8 kg facturés) : 4 colis à 164 € ou 1 palette à 130 €", () => {
    const e = expedition(calculer(platines45));
    expect(e.colis.map((c) => c.quantite)).toEqual([12, 11, 11, 11]);
    expect(e.colis[0].poids_kg).toBe(29.81); // 12 × 2,16 kg × 1,15
    expect(e.envois.map((x) => [x.type, x.prix_ht])).toEqual([
      ["palette", 130],
      ["colis", 164],
    ]);
    expect(e.mode).toBe("palette"); // le moins cher par défaut
  });

  it("le client peut prendre l'un ou l'autre", () => {
    const colis = construireCommande(platines45, "standard", "colis");
    const palette = construireCommande(platines45, "standard", "palette");
    expect(colis.ok && colis.livraison.port_ht).toBe(164);
    expect(palette.ok && palette.livraison.port_ht).toBe(130);
  });

  it("un envoi non proposé est refusé", () => {
    expect(construireCommande(petite, "standard", "palette").ok).toBe(false);
  });
});

describe("palette seule (la pièce ne passe pas en colis)", () => {
  it("1100 × 800 : hors Colissimo, mais pile sur le plateau de la palette", () => {
    const e = expedition(calculer(plaque1100));
    expect(e.envois.map((x) => x.type)).toEqual(["palette"]);
    expect(e.raison).toMatch(/114 × 84 × 5 cm, plus de 200 cm cumulés/);
  });

  it("une pièce de plus de 30 kg emballée (800×800 en 15 mm)", () => {
    const e = expedition(calculer(lourde));
    expect(e.envois.map((x) => x.type)).toEqual(["palette"]);
    expect(e.raison).toMatch(/88,3 kg/);
  });
});

describe("limites de la palette TNT (120 × 80 cm, 999 kg)", () => {
  it("la grille porte les limites relevées chez Boxtal", () => {
    expect(GRILLE._calcul.palette_longueur_max_cm).toBe(120);
    expect(GRILLE._calcul.palette_largeur_max_cm).toBe(80);
    expect(GRILLE._calcul.palette_poids_max_kg).toBe(999);
  });

  it("plaque 1000 × 1000 : 1 m de large, elle déborde du plateau de 80 cm", () => {
    const e = expedition(calculer(plaque1000));
    expect(e.mode).toBe("sur_devis");
    expect(e.raison).toMatch(/1 m de large, trop large pour une palette/);
    expect(e.options.map((o) => o.cle)).toEqual(["retrait"]);
  });

  it("les cadres 1300×1300 du devis golden : 1,3 m, trop long pour la palette", () => {
    const e = expedition(calculer(cadres1300));
    expect(e.mode).toBe("sur_devis");
    expect(e.raison).toMatch(/1,3 m, trop longue pour une palette/);
    expect(construireCommande(cadres1300, "standard").ok).toBe(false);
    expect(construireCommande(cadres1300, "retrait").ok).toBe(true);
  });

  it("trop lourd pour une palette : livraison sur devis, retrait toujours possible", () => {
    const config = { ...EXPEDITION, grille: { ...GRILLE, _calcul: { ...GRILLE._calcul, palette_poids_max_kg: 50 } } };
    const e = expedition(calculer(lourde), config);
    expect(e.mode).toBe("sur_devis");
    expect(e.raison).toMatch(/88,3 kg, trop lourd pour une palette/);
    expect(e.options.map((o) => o.cle)).toEqual(["retrait"]);
    expect(construireCommande(lourde, "standard", undefined, config).ok).toBe(false);
    expect(construireCommande(lourde, "retrait", undefined, config).ok).toBe(true);
  });

  it("limites à null : le site n'applique aucune limite de palette", () => {
    const _calcul = { ...GRILLE._calcul, palette_poids_max_kg: null, palette_longueur_max_cm: null, palette_largeur_max_cm: null };
    const config = { ...EXPEDITION, grille: { ...GRILLE, _calcul } };
    expect(expedition(calculer(cadres1300), config).mode).toBe("palette");
    expect(expedition(calculer(plaque1000), config).mode).toBe("palette");
  });
});

describe("commande en ligne", () => {
  it("7 jours : frais d'envoi seuls, sans supplément, à l'euro", () => {
    const c = construireCommande(petite, "standard");
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.livraison.envoi?.type).toBe("colis");
    expect(c.livraison.port_ht).toBe(34);
    expect(c.livraison.supplement_ht).toBe(0);
    expect(c.livraison.prix_ht).toBe(34);
    expect(c.centimes.livraison).toBe(4080);
  });

  it("2 jours : frais d'envoi + 15 % de la commande, chacun arrondi à l'euro supérieur", () => {
    const c = construireCommande(petite, "express");
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.resultat.total_ht).toBe(79); // 78,61 → 79
    expect(c.livraison.port_ht).toBe(34);
    expect(c.livraison.supplement_ht).toBe(12); // 15 % × 79 = 11,85 → 12
    expect(c.livraison.prix_ht).toBe(46);
    expect(c.centimes.livraison).toBe(5520);
    expect(c.centimes.total).toBe(Math.round(c.resultat.total_ttc * 100) + 5520);
  });

  it("supplément express une seule fois, quel que soit l'envoi", () => {
    const colis = construireCommande(platines45, "express", "colis");
    const palette = construireCommande(platines45, "express", "palette");
    expect(colis.ok && palette.ok).toBe(true);
    if (!colis.ok || !palette.ok) return;
    expect(colis.resultat.total_ht).toBe(388);
    expect(colis.livraison.supplement_ht).toBe(59); // 15 % × 388 = 58,20 → 59
    expect(colis.livraison.prix_ht).toBe(223);
    expect(palette.livraison.prix_ht).toBe(189);
  });

  it("2 jours coûte toujours plus que 7 jours", () => {
    for (const p of [petite, platines45]) {
      const e = construireCommande(p, "express");
      const s7 = construireCommande(p, "standard");
      expect(e.ok && s7.ok).toBe(true);
      if (e.ok && s7.ok) expect(e.livraison.prix_ht).toBeGreaterThan(s7.livraison.prix_ht);
    }
  });

  it("retrait à l'atelier : gratuit, toujours possible, même pour les grandes pièces", () => {
    for (const p of [petite, platines45, longue1300, longue1600, plaque1000, lourde, cadres1300]) {
      const c = construireCommande(p, "retrait");
      expect(c.ok).toBe(true);
      if (c.ok) {
        expect(c.livraison.envoi).toBeNull();
        expect(c.livraison.prix_ttc).toBe(0);
        expect(c.centimes.livraison).toBe(0);
        expect(c.total_ttc).toBe(c.resultat.total_ttc);
      }
    }
  });

  it("aucun mode choisi : pas de paiement", () => {
    expect(construireCommande(petite, "").ok).toBe(false);
  });

  it("refuse de faire payer une pièce que le moteur refuse", () => {
    const c = construireCommande({ ...petite, matiere: "cuivre" }, "express");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.message).toMatch(/cuivre/i);
  });

  it("une règle de prix mixte reste possible (part fixe + pourcentage)", () => {
    expect(fraisLivraisonHt({ cle: "x", libelle: "x", prix_eur_ht: 10, pourcentage_commande: 0.1, transport: true }, 200, 5)).toBe(35);
  });
});

/**
 * Structure du choix de livraison VALIDÉE PAR ADM — ne pas la modifier :
 *   1. retrait à l'atelier (gratuit)
 *   2. livraison (frais de livraison)
 *      2.1 envoi : en colis ou sur palette
 *      2.2 choix entre expédition en 2 jours et en 7 jours
 *      2.3 le prix du délai s'ajoute aux frais de livraison
 */
describe("structure du choix de livraison (validée par ADM)", () => {
  it("1. retrait à l'atelier, gratuit", () => {
    const e = etapesLivraison(petite)!;
    expect(e.retrait).toMatchObject({ libelle: "Retrait à l'atelier", prix_ht: 0 });
  });

  it("2. livraison avec ses frais ; 2.1 les envois proposés", () => {
    const e = etapesLivraison(petite)!;
    expect(e.livraison.disponible).toBe(true);
    expect(e.livraison.envois.map((x) => [x.type, x.prix_ht])).toEqual([["colis", 34]]);
    expect(etapesLivraison(platines45)!.livraison.envois.map((x) => x.type)).toEqual(["palette", "colis"]);
  });

  it("2.2 choix entre expédition en 2 jours et en 7 jours, dans cet ordre", () => {
    const e = etapesLivraison(petite)!;
    expect(e.livraison.delais.map((d) => [d.libelle, d.delai_jours])).toEqual([
      ["Expédition en 2 jours", 2],
      ["Expédition en 7 jours", 7],
    ]);
  });

  it("2.3 le prix du délai s'ajoute aux frais de livraison, pour chaque envoi", () => {
    for (const p of [petite, platines45]) {
      const e = etapesLivraison(p)!;
      for (const d of e.livraison.delais) {
        for (const env of e.livraison.envois) {
          expect(d.totaux[env.type]).toBeCloseTo(env.prix_ht + d.supplement_ht!, 2);
          const c = construireCommande(p, d.cle, env.type);
          expect(c.ok && c.livraison.prix_ht).toBe(d.totaux[env.type]);
        }
      }
    }
  });

  it("livraison sur devis : le retrait reste proposé, les délais ne sont pas chiffrés", () => {
    const config = { ...EXPEDITION, grille: { ...GRILLE, _calcul: { ...GRILLE._calcul, palette_poids_max_kg: 500 } } };
    const e = etapesLivraison(cadres1300, config)!;
    expect(e.retrait).not.toBeNull();
    expect(e.livraison.disponible).toBe(false);
    expect(e.livraison.envois).toEqual([]);
    expect(e.livraison.delais.every((d) => d.supplement_ht === null && Object.keys(d.totaux).length === 0)).toBe(true);
  });

  it("le configurateur affiche les étapes 1, 2, 2.1, 2.2 et 2.3", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/Configurateur.tsx", "utf-8");
    for (const libelle of [
      "1. {retrait.libelle}",
      "2. Livraison",
      "2.1 Envoi",
      "2.2 Choix entre expédition en 2 jours et en 7 jours",
      "2.3 Ce prix s&apos;ajoute aux frais de livraison",
      "1. {optionRetrait.libelle}",
      "2.2 Choix du délai",
      "2.3 Le prix du délai s&apos;ajoute aux frais de livraison",
    ]) {
      expect(src, libelle).toContain(libelle);
    }
  });
});

it("tarifs.json n'a plus l'ancienne grille Colissimo publique", () => {
  expect(tarifs).not.toHaveProperty("transport_colis");
  expect(tarifs).not.toHaveProperty("colis_longueur_max_mm");
});
