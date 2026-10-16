/**
 * Export DXF d'une pièce du configurateur — le fichier de découpe joint au mail de commande.
 *
 * Format DXF R12 (AC1009) ASCII, le plus largement lu (TruTops, AutoCAD, DraftSight, LibreCAD) :
 * uniquement des entités LINE, ARC et CIRCLE, en millimètres, axe Y vers le haut, coin
 * inférieur gauche de l'encombrement en (0, 0). Les contours sont fermés et le trajet total
 * est égal au périmètre utilisé par le moteur de prix (vérifié par test/dxf.test.ts).
 */

export type Entite =
  | { type: "LINE"; x1: number; y1: number; x2: number; y2: number }
  | { type: "CIRCLE"; cx: number; cy: number; r: number }
  /** Angles en degrés, sens trigonométrique, de debut à fin. */
  | { type: "ARC"; cx: number; cy: number; r: number; debut: number; fin: number };

/** Polygone fermé → segments. */
function polygone(points: [number, number][]): Entite[] {
  return points.map(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    return { type: "LINE", x1, y1, x2, y2 };
  });
}

const rectangle = (x: number, y: number, w: number, h: number) =>
  polygone([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);

/** Géométrie de découpe d'une forme, en entités DXF. null pour la forme libre (pas de tracé). */
export function entitesDxf(forme: string, d: Record<string, number>): Entite[] | null {
  switch (forme) {
    case "rectangle":
      return rectangle(0, 0, d.longueur, d.largeur);

    case "triangle": // triangle rectangle : angle droit en bas à gauche
      return polygone([
        [0, 0],
        [d.base, 0],
        [0, d.hauteur],
      ]);

    case "disque":
      return [{ type: "CIRCLE", cx: d.diametre / 2, cy: d.diametre / 2, r: d.diametre / 2 }];

    case "rectangle_coupe_coin": {
      // encoche en bas à gauche, comme sur le dessin coté
      const { longueur: L, largeur: l, coupe_x: cx, coupe_y: cy } = d;
      return polygone([
        [cx, 0],
        [L, 0],
        [L, l],
        [0, l],
        [0, cy],
        [cx, cy],
      ]);
    }

    case "cadre_coupe_circulaire": {
      const { longueur: L, largeur: l, diametre_interieur: di } = d;
      return [...rectangle(0, 0, L, l), { type: "CIRCLE", cx: L / 2, cy: l / 2, r: di / 2 }];
    }

    case "cadre_coupe_rectangle": {
      const { longueur: L, largeur: l, longueur_interieure: Li, largeur_interieure: li } = d;
      return [...rectangle(0, 0, L, l), ...rectangle((L - Li) / 2, (l - li) / 2, Li, li)];
    }

    case "demi_disque_allonge": {
      // partie droite en bas, demi-disque en haut
      const { largeur: w, hauteur: h } = d;
      const r = w / 2;
      const droit = h - r;
      return [
        { type: "LINE", x1: 0, y1: 0, x2: w, y2: 0 },
        { type: "LINE", x1: w, y1: 0, x2: w, y2: droit },
        { type: "ARC", cx: r, cy: droit, r, debut: 0, fin: 180 },
        { type: "LINE", x1: 0, y1: droit, x2: 0, y2: 0 },
      ];
    }

    case "trapeze": {
      // base en bas ; base et sommet centrés (le sommet peut être le plus long)
      const { base: b, sommet: s, hauteur: h } = d;
      const W = Math.max(b, s);
      const ob = (W - b) / 2;
      const os = (W - s) / 2;
      return polygone([
        [ob, 0],
        [ob + b, 0],
        [os + s, h],
        [os, h],
      ]);
    }

    default:
      return null;
  }
}

const n = (v: number) => {
  const s = (Math.round(v * 1e4) / 1e4).toFixed(4).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};

function encoder(e: Entite): string[] {
  const commun = ["8", "0"]; // calque 0
  switch (e.type) {
    case "LINE":
      return ["0", "LINE", ...commun, "10", n(e.x1), "20", n(e.y1), "30", "0", "11", n(e.x2), "21", n(e.y2), "31", "0"];
    case "CIRCLE":
      return ["0", "CIRCLE", ...commun, "10", n(e.cx), "20", n(e.cy), "30", "0", "40", n(e.r)];
    case "ARC":
      return ["0", "ARC", ...commun, "10", n(e.cx), "20", n(e.cy), "30", "0", "40", n(e.r), "50", n(e.debut), "51", n(e.fin)];
  }
}

/** Fichier DXF complet, ou null si la forme n'a pas de tracé paramétrique. */
export function genererDxf(forme: string, dimensions: Record<string, number>, commentaire?: string): string | null {
  const brutes = entitesDxf(forme, dimensions);
  if (!brutes) return null;
  // Segments de longueur nulle (ex. demi-disque sans partie droite) : inutiles, et mal lus par certains logiciels.
  const entites = brutes.filter((e) => e.type !== "LINE" || Math.hypot(e.x2 - e.x1, e.y2 - e.y1) > 1e-9);

  const xs: number[] = [];
  const ys: number[] = [];
  for (const e of entites) {
    if (e.type === "LINE") xs.push(e.x1, e.x2), ys.push(e.y1, e.y2);
    else xs.push(e.cx - e.r, e.cx + e.r), ys.push(e.cy - e.r, e.cy + e.r);
  }

  const lignes = [
    "999",
    "ADM Laser - unites : millimetres",
    ...(commentaire ? ["999", commentaire.normalize("NFD").replace(/[^\x20-\x7e]/g, "")] : []),
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    "9", "$EXTMIN", "10", n(Math.min(...xs)), "20", n(Math.min(...ys)),
    "9", "$EXTMAX", "10", n(Math.max(...xs)), "20", n(Math.max(...ys)),
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entites.flatMap(encoder),
    "0", "ENDSEC",
    "0", "EOF",
  ];
  return lignes.join("\r\n") + "\r\n";
}
