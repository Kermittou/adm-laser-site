import { statSync } from "node:fs";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Pages juridiques exclues : elles restent en noindex tant que les textes ne sont pas fournis.
const PAGES: { chemin: string; source: string; priorite: number; frequence: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { chemin: "/", source: "src/app/page.tsx", priorite: 1, frequence: "monthly" },
  { chemin: "/devis", source: "src/app/devis/page.tsx", priorite: 0.9, frequence: "monthly" },
  { chemin: "/savoir-faire", source: "src/app/savoir-faire/page.tsx", priorite: 0.8, frequence: "monthly" },
  { chemin: "/matieres", source: "src/app/matieres/page.tsx", priorite: 0.8, frequence: "monthly" },
  { chemin: "/realisations", source: "src/app/realisations/page.tsx", priorite: 0.6, frequence: "monthly" },
  { chemin: "/contact", source: "src/app/contact/page.tsx", priorite: 0.7, frequence: "yearly" },
];

/**
 * Date de dernière modification : celle du fichier de la page, lue à la génération du sitemap
 * (statique, au build). Annoncer `new Date()` serait plus simple mais faux — ce serait dire à
 * Google que toutes les pages changent à chaque déploiement, et il cesse vite d'y croire.
 * Si le fichier est introuvable, on n'annonce rien plutôt qu'une date inventée.
 */
function modifieeLe(source: string): Date | undefined {
  try {
    return statSync(source).mtime;
  } catch {
    return undefined;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.chemin}`,
    lastModified: modifieeLe(p.source),
    changeFrequency: p.frequence,
    priority: p.priorite,
  }));
}
