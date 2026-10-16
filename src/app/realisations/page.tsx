import type { Metadata } from "next";
import Image from "next/image";
import { Button, Container, Section, SurTitre } from "@/components/ui";

export const metadata: Metadata = {
  title: "Réalisations — pièces découpées, pliées et soudées",
  description:
    "Pièces découpées au laser, pliées et soudées dans notre atelier de Vaires-sur-Marne (Seine-et-Marne) : brides, platines, supports pliés, charnières, panneaux décoratifs.",
  alternates: { canonical: "/realisations" },
};

// Photos vitrine fournies par ADM (16/10/2026, public/images/vitrine-*.webp) : de vraies pièces de
// l'atelier, aucune fausse réalisation. Légendes descriptives uniquement (ni matière ni client inventés).
// `carre` : photo de pièce sur fond blanc, affichée entière ; sinon recadrée en 4:3.
const CATEGORIES = [
  {
    titre: "Pièces découpées au laser",
    carre: true,
    photos: [
      { src: "/images/vitrine-bride-epaisse.webp", alt: "Bride épaisse à deux perçages", legende: "Bride épaisse" },
      { src: "/images/vitrine-plaque-lumieres.webp", alt: "Plaque épaisse percée de deux lumières oblongues", legende: "Plaque à lumières" },
      { src: "/images/vitrine-plaque-ajouree.webp", alt: "Plaque ajourée à angles arrondis, quatre grands perçages", legende: "Plaque ajourée" },
      { src: "/images/vitrine-disque-perce.webp", alt: "Disque percé de quatre trous", legende: "Disque percé" },
    ],
  },
  {
    titre: "Pièces pliées",
    carre: true,
    photos: [
      { src: "/images/vitrine-patte-pliee-percee.webp", alt: "Patte pliée avec un grand perçage et quatre trous de fixation", legende: "Patte pliée percée" },
      { src: "/images/vitrine-support-plie-inserts.webp", alt: "Support découpé et plié, avec deux inserts", legende: "Support plié avec inserts" },
      { src: "/images/vitrine-support-plie-galvanise.webp", alt: "Support en tôle pliée en U avec découpes de fixation", legende: "Support plié en U" },
      { src: "/images/vitrine-cadre-plie.webp", alt: "Angle d'un cadre en tôle pliée avec patte de fixation", legende: "Cadre plié" },
    ],
  },
  {
    titre: "Pièces soudées",
    carre: true,
    photos: [{ src: "/images/vitrine-charniere-soudee.webp", alt: "Charnière : axe soudé sur une platine percée", legende: "Charnière soudée" }],
  },
  {
    titre: "Décoration",
    carre: true,
    photos: [
      { src: "/images/vitrine-panneau-decoratif.webp", alt: "Panneau décoratif découpé au laser : silhouette de femme dans un cadre", legende: "Panneau décoratif" },
      { src: "/images/vitrine-pieces-decoratives.webp", alt: "Pièces décoratives découpées au laser : trèfle, feuille, marque-page", legende: "Pièces décoratives" },
    ],
  },
  {
    titre: "L'atelier",
    carre: false,
    photos: [
      { src: "/images/atelier-trulaser-2030.png", alt: "Laser Trumpf TruLaser 2030", legende: "Laser Trumpf TruLaser 2030 — 3 kW, 1500 × 3000 mm" },
      { src: "/images/atelier-plieuse-trumpf.png", alt: "Plieuse Trumpf de l'atelier", legende: "Plieuse Trumpf" },
      { src: "/images/atelier-soudure.png", alt: "Soudure à l'atelier", legende: "Soudure" },
    ],
  },
];

export default function Realisations() {
  return (
    <>
      <section className="bg-hero text-blanc">
        <Container className="py-16 md:py-20">
          <SurTitre>Réalisations</SurTitre>
          <h1 className="max-w-[820px] text-[40px] md:text-[54px]">Pièces sorties de notre atelier</h1>
          <p className="mt-6 max-w-[640px] text-lg leading-relaxed text-gris-clair-3">
            Découpe laser, pliage et soudure : un aperçu des pièces que nous fabriquons à Vaires-sur-Marne.
          </p>
        </Container>
      </section>

      {CATEGORIES.map((c, i) => (
        <Section key={c.titre} ton={i % 2 ? "surface" : "blanc"} aria-labelledby={`t-real-${i}`}>
          <h2 id={`t-real-${i}`} className="text-[34px] text-steel md:text-[44px]">
            {c.titre}
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {c.photos.map((p) => (
              <li key={p.src}>
                <figure>
                  {c.carre ? (
                    <Image src={p.src} alt={p.alt} width={1254} height={1254} className="aspect-square w-full rounded-card border border-bordure bg-blanc object-contain" />
                  ) : (
                    <Image src={p.src} alt={p.alt} width={768} height={576} className="aspect-[4/3] w-full rounded-card bg-blanc object-cover" />
                  )}
                  <figcaption className="mt-3 text-[15px] font-medium text-texte-doux">{p.legende}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section ton="sombre" aria-labelledby="t-real-cta">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <h2 id="t-real-cta" className="max-w-[620px] text-[34px] text-blanc md:text-[44px]">
            Votre pièce pourrait être la prochaine.
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/devis">Configurer ma pièce</Button>
            <Button href="/contact#formulaire" variante="outline">
              Envoyer un plan
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
