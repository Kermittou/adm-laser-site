import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/devis/catalogue";
import { dimensionsEffectives, dimensionsParDefaut } from "@/lib/devis/configurateur";
import { genererDxf } from "@/lib/devis/dxf";
import { geometrie } from "@/lib/devis/geometrie";

const FORMES = Object.keys(catalogue.formes).filter((f) => f !== "personnalisee");

type Lue =
  | { type: "LINE"; x1: number; y1: number; x2: number; y2: number }
  | { type: "CIRCLE"; cx: number; cy: number; r: number }
  | { type: "ARC"; cx: number; cy: number; r: number; debut: number; fin: number };

/** Relit les entités d'un DXF ASCII (paires code / valeur). */
function lire(dxf: string): Lue[] {
  const l = dxf.split(/\r\n/);
  const debut = l.indexOf("ENTITIES");
  const out: Lue[] = [];
  let courant: Record<string, string> | null = null;
  let type = "";
  const pousser = () => {
    if (!courant) return;
    const g = (k: string) => Number(courant![k]);
    if (type === "LINE") out.push({ type, x1: g("10"), y1: g("20"), x2: g("11"), y2: g("21") });
    if (type === "CIRCLE") out.push({ type, cx: g("10"), cy: g("20"), r: g("40") });
    if (type === "ARC") out.push({ type, cx: g("10"), cy: g("20"), r: g("40"), debut: g("50"), fin: g("51") });
  };
  for (let i = debut + 1; i < l.length - 1; i += 2) {
    const [code, valeur] = [l[i], l[i + 1]];
    if (code === "0") {
      pousser();
      if (valeur === "ENDSEC") break;
      type = valeur;
      courant = {};
    } else if (courant) courant[code] = valeur;
  }
  return out;
}

function longueur(e: Lue): number {
  if (e.type === "LINE") return Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
  if (e.type === "CIRCLE") return 2 * Math.PI * e.r;
  const balayage = (((e.fin - e.debut) % 360) + 360) % 360;
  return (Math.PI * e.r * balayage) / 180;
}

function boite(es: Lue[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const e of es) {
    if (e.type === "LINE") xs.push(e.x1, e.x2), ys.push(e.y1, e.y2);
    else if (e.type === "CIRCLE") xs.push(e.cx - e.r, e.cx + e.r), ys.push(e.cy - e.r, e.cy + e.r);
    else xs.push(e.cx - e.r, e.cx + e.r), ys.push(e.cy - (e.debut === 0 && e.fin === 180 ? 0 : e.r), e.cy + e.r);
  }
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), x0: Math.min(...xs), y0: Math.min(...ys) };
}

/** Les segments forment des boucles fermées : chaque extrémité est partagée par exactement deux segments. */
function contoursFermes(es: Lue[]): boolean {
  const cle = (x: number, y: number) => `${x.toFixed(3)},${y.toFixed(3)}`;
  const compte = new Map<string, number>();
  const ajouter = (k: string) => compte.set(k, (compte.get(k) ?? 0) + 1);
  for (const e of es) {
    if (e.type === "LINE") ajouter(cle(e.x1, e.y1)), ajouter(cle(e.x2, e.y2));
    if (e.type === "ARC") {
      const rad = (a: number) => (a * Math.PI) / 180;
      ajouter(cle(e.cx + e.r * Math.cos(rad(e.debut)), e.cy + e.r * Math.sin(rad(e.debut))));
      ajouter(cle(e.cx + e.r * Math.cos(rad(e.fin)), e.cy + e.r * Math.sin(rad(e.fin))));
    }
  }
  return [...compte.values()].every((c) => c === 2);
}

function alea(graine: number) {
  let s = graine;
  return () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
}

describe("export DXF", () => {
  it.each(FORMES)("%s : longueur de coupe = périmètre du moteur, encombrement identique, contours fermés", (forme) => {
    const r = alea(7);
    const essais = [dimensionsParDefaut(forme)];
    for (let i = 0; i < 25; i++) {
      const brut = Object.fromEntries(catalogue.formes[forme].parametres.map((p) => [p.cle, Math.round(p.min + r() * (p.max - p.min))]));
      essais.push(dimensionsEffectives(forme, brut, 3));
    }
    for (const d of essais) {
      const dxf = genererDxf(forme, d)!;
      const es = lire(dxf);
      const geo = geometrie(forme, d);
      const total = es.reduce((s, e) => s + longueur(e), 0);
      expect(total, JSON.stringify(d)).toBeCloseTo(geo.perimetre_mm, 2);
      const b = boite(es);
      expect(b.x0).toBeCloseTo(0, 3);
      expect(b.y0).toBeCloseTo(0, 3);
      expect(b.w).toBeCloseTo(geo.encombrement_mm[0], 3);
      expect(b.h).toBeCloseTo(geo.encombrement_mm[1], 3);
      expect(contoursFermes(es)).toBe(true);
    }
  });

  it("le cadre 1300×1300 du devis golden : 2 contours, 5 424 mm de coupe", () => {
    const d = { longueur: 1300, largeur: 1300, longueur_interieure: 56, largeur_interieure: 56 };
    const es = lire(genererDxf("cadre_coupe_rectangle", d)!);
    expect(es).toHaveLength(8);
    expect(es.reduce((s, e) => s + longueur(e), 0)).toBeCloseTo(5424, 6);
  });

  it("produit un fichier DXF R12 ASCII bien formé, sans caractère non ASCII", () => {
    const dxf = genererDxf("disque", { diametre: 250 }, "Commande n° 1 — Acier brut 3 mm × 10")!;
    expect(dxf).toMatch(/\$ACADVER\r\n1\r\nAC1009/);
    expect(dxf.trimEnd().endsWith("0\r\nEOF")).toBe(true);
    expect(/^[\x00-\x7f]*$/.test(dxf)).toBe(true);
    const l = dxf.split("\r\n").slice(0, -1);
    expect(l.length % 2).toBe(0); // paires code / valeur
  });

  it("pas de DXF pour la forme libre", () => {
    expect(genererDxf("personnalisee", {})).toBeNull();
  });
});
