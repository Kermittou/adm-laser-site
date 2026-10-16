import { ImageResponse } from "next/og";
import { plageEpaisseursGlobale, mm } from "@/lib/devis/catalogue";
import { site } from "@/lib/site";

export const alt = "ADM Laser — découpe laser, pliage et soudure sur mesure à Vaires-sur-Marne (77)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Couleurs de la charte (globals.css) — les variables CSS ne sont pas disponibles ici.
const ACCENT = "#D93A2B";
const BLANC = "#FFFFFF";
const GRIS = "#C7CBCE";

export default function Image() {
  const p = plageEpaisseursGlobale();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(160deg, #1F2731, #151C23)",
          color: BLANC,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>
          ADM&nbsp;<span style={{ color: ACCENT }}>LASER</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, color: ACCENT, letterSpacing: 6, fontWeight: 700 }}>DÉCOUPE · PLIAGE · SOUDURE</div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, marginTop: 20, maxWidth: 960 }}>
            Vos pièces métalliques, découpées avec précision.
          </div>
          <div style={{ fontSize: 30, color: GRIS, marginTop: 24 }}>
            {`Acier · Inox · Alu — ${mm(p.min)} à ${mm(p.max)} mm — ${site.adresse.ville} (77)`}
          </div>
        </div>
        <div style={{ display: "flex", height: 6, width: 360, background: ACCENT, borderRadius: 3, boxShadow: `0 0 24px ${ACCENT}` }} />
      </div>
    ),
    size,
  );
}
