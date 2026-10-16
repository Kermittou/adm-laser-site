import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Pages juridiques exclues : elles restent en noindex tant que les textes ne sont pas fournis.
const PAGES: { chemin: string; priorite: number; frequence: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { chemin: "/", priorite: 1, frequence: "monthly" },
  { chemin: "/devis", priorite: 0.9, frequence: "monthly" },
  { chemin: "/savoir-faire", priorite: 0.8, frequence: "monthly" },
  { chemin: "/matieres", priorite: 0.8, frequence: "monthly" },
  { chemin: "/realisations", priorite: 0.6, frequence: "monthly" },
  { chemin: "/contact", priorite: 0.7, frequence: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE_URL}${p.chemin}`, changeFrequency: p.frequence, priority: p.priorite }));
}
