import type { MetadataRoute } from "next";
import { site, SITE_URL } from "@/lib/site";

// Pages juridiques ajoutées une fois les textes validés (site.textesJuridiquesValides).
const PAGES: { chemin: string; priorite: number; frequence: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { chemin: "/", priorite: 1, frequence: "monthly" },
  { chemin: "/devis", priorite: 0.9, frequence: "monthly" },
  { chemin: "/savoir-faire", priorite: 0.8, frequence: "monthly" },
  { chemin: "/matieres", priorite: 0.8, frequence: "monthly" },
  { chemin: "/realisations", priorite: 0.6, frequence: "monthly" },
  { chemin: "/contact", priorite: 0.7, frequence: "yearly" },
  ...(site.textesJuridiquesValides
    ? (["/mentions-legales", "/cgv", "/confidentialite"] as const).map((chemin) => ({ chemin, priorite: 0.2, frequence: "yearly" as const }))
    : []),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE_URL}${p.chemin}`, changeFrequency: p.frequence, priority: p.priorite }));
}
