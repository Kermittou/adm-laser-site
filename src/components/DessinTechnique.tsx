import { dessiner, type Cote } from "@/lib/devis/dessin";

/**
 * Dessin technique SVG coté en direct. Coordonnées en mm, mises à l'échelle par le viewBox :
 * traits et textes sont dimensionnés en proportion de la pièce pour garder une taille constante à l'écran.
 */
export function DessinTechnique({ forme, dimensions, className = "" }: { forme: string; dimensions: Record<string, number>; className?: string }) {
  const d = dessiner(forme, dimensions);
  if (!d) return null;

  const span = Math.max(d.largeur, d.hauteur);
  const u = span / 100; // unité graphique : 1 % de la plus grande dimension
  const police = 4.6 * u;
  const ecart = 9 * u; // distance pièce → ligne de cote
  const depasse = 2 * u;

  const pad = { gauche: ecart + police * 5.2, droite: 4 * u, haut: ecart + police * 1.6, bas: ecart + police * 1.8 };
  const viewBox = `${-pad.gauche} ${-pad.haut} ${d.largeur + pad.gauche + pad.droite} ${d.hauteur + pad.haut + pad.bas}`;

  const tick = (x: number, y: number) => `M${x - 1.4 * u},${y + 1.4 * u} L${x + 1.4 * u},${y - 1.4 * u}`;

  function rendreCote(c: Cote, i: number) {
    const horizontal = Math.abs(c.y2 - c.y1) < 1e-9;
    let trait = "";
    let tx = 0;
    let ty = 0;
    let ancre: "middle" | "end" | "start" = "middle";

    if (c.cote === "bas" || c.cote === "haut") {
      const sens = c.cote === "bas" ? 1 : -1;
      const y = c.y1 + sens * ecart;
      trait = `M${c.x1},${c.y1 + sens * u} V${y + sens * depasse} M${c.x2},${c.y2 + sens * u} V${y + sens * depasse} M${c.x1},${y} H${c.x2} ${tick(c.x1, y)} ${tick(c.x2, y)}`;
      tx = (c.x1 + c.x2) / 2;
      ty = y + sens * police * 0.95;
    } else if (c.cote === "gauche") {
      const x = c.x1 - ecart;
      trait = `M${c.x1 - u},${c.y1} H${x - depasse} M${c.x2 - u},${c.y2} H${x - depasse} M${x},${c.y1} V${c.y2} ${tick(x, c.y1)} ${tick(x, c.y2)}`;
      tx = x - police * 0.5;
      ty = (c.y1 + c.y2) / 2;
      ancre = "end";
    } else if (horizontal) {
      trait = `M${c.x1},${c.y1} H${c.x2} ${tick(c.x1, c.y1)} ${tick(c.x2, c.y2)}`;
      tx = (c.x1 + c.x2) / 2;
      ty = c.y1 - police * 0.75;
    } else {
      trait = `M${c.x1},${c.y1} V${c.y2} ${tick(c.x1, c.y1)} ${tick(c.x2, c.y2)}`;
      tx = c.libelleAGauche ? c.x1 - police * 0.5 : c.x1 + police * 0.5;
      ty = (c.y1 + c.y2) / 2;
      ancre = c.libelleAGauche ? "end" : "start";
    }

    return (
      <g key={i}>
        <path d={trait} className="stroke-accent" strokeWidth={0.45 * u} fill="none" />
        <text
          x={tx}
          y={ty}
          fontSize={police}
          textAnchor={ancre}
          dominantBaseline="middle"
          className="fill-accent-hover font-sans font-semibold"
          paintOrder="stroke"
          stroke="var(--color-surface)"
          strokeWidth={0.9 * u}
        >
          {c.label}
        </text>
      </g>
    );
  }

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={`Dessin coté : ${d.cotes.map((c) => c.label).join(", ")}`}>
      <path d={d.path} fillRule="evenodd" className="fill-gris-clair-2 stroke-steel" strokeWidth={0.6 * u} strokeLinejoin="round" />
      {d.cotes.map(rendreCote)}
    </svg>
  );
}
