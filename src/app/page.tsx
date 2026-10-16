import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/Hero";
import { IconeDevis, IconeFleche, IconeLaser, IconePliage, IconeQualite, IconeSoudure, IconeTelephone, IconeMail } from "@/components/Icones";
import { StatsBar } from "@/components/StatsBar";
import { Button, Card, EnTete, Section } from "@/components/ui";
import { formatTole, mm, plageEpaisseurs, plageEpaisseursGlobale } from "@/lib/devis/catalogue";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Découpe laser Seine-et-Marne (77) — tôlerie sur mesure | ADM Laser" },
  description:
    "Découpe laser, pliage et soudure sur mesure à Vaires-sur-Marne (77). Acier, inox et aluminium, de la pièce unique à la série. Devis en ligne en 30 secondes.",
  alternates: { canonical: "/" },
};

const plage = (m: string) => {
  const p = plageEpaisseurs(m);
  return p ? `${mm(p.min)} à ${mm(p.max)} mm` : "";
};

export default function Accueil() {
  const globale = plageEpaisseursGlobale();
  const { laser, plieuses } = site.machines;

  return (
    <>
      <Hero />

      {/* ------------------------------------------------ Savoir-faire */}
      <Section aria-labelledby="savoir-faire">
        <EnTete id="savoir-faire" surTitre="Notre savoir-faire" titre="Nous découpons, plions et soudons le métal — avec la précision qui évite l'aller-retour.">
          <p>
            De la pièce unique à la petite série, nous travaillons l&apos;acier, l&apos;inox et l&apos;aluminium sur notre parc
            Trumpf, du laser à la soudure — sans sous-traiter d&apos;étape.
          </p>
        </EnTete>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { Icone: IconeLaser, titre: "Découpe laser de précision", texte: "Acier, inox et aluminium sur notre TruLaser Trumpf." },
            {
              Icone: IconePliage,
              titre: "Pliage & soudure",
              texte: "Mise en forme sur plieuses Trumpf et assemblage par soudure — des pièces prêtes à poser, pas juste découpées.",
            },
            { Icone: IconeQualite, titre: "Qualité & livraison premium", texte: "Zéro rayure, emballage soigné, livraison partout en France." },
          ].map(({ Icone, titre, texte }) => (
            <Card key={titre}>
              <span className="flex h-12 w-12 items-center justify-center rounded-btn-lg bg-accent/10 text-accent">
                <Icone />
              </span>
              <h3 className="mt-5 text-[26px] text-steel">{titre}</h3>
              <p className="mt-2 leading-relaxed text-texte-doux">{texte}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------ Chiffres (calculés depuis catalogue.json) */}
      <StatsBar
        items={[
          { valeur: "Acier · Inox · Alu", libelle: "Matières travaillées" },
          { valeur: `${mm(globale.min)} à ${mm(globale.max)} mm`, libelle: "Épaisseurs disponibles" },
          { valeur: "Trumpf TruLaser", libelle: "Parc machines" },
          { valeur: "Toute la France", libelle: "Zone de livraison" },
        ]}
      />

      {/* ------------------------------------------------ Capacités */}
      <Section ton="surface" aria-labelledby="capacites">
        <EnTete id="capacites" surTitre="Capacités" titre="Un parc Trumpf, de la tôle brute à la pièce finie." />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="flex flex-col">
            <IconeLaser className="text-accent" />
            <h3 className="mt-4 text-2xl text-steel">Découpe laser</h3>
            <ul className="mt-3 space-y-1.5 text-[15px] text-texte-doux">
              <li>
                {laser.nom}, {laser.puissance}
              </li>
              <li>Format tôle {formatTole()}</li>
              <li>Acier {plage("acier")}</li>
              <li>Inox {plage("inox")}</li>
              <li>Aluminium {plage("alu")}</li>
            </ul>
          </Card>
          <Card className="flex flex-col">
            <IconePliage className="text-accent" />
            <h3 className="mt-4 text-2xl text-steel">Pliage</h3>
            <ul className="mt-3 space-y-1.5 text-[15px] text-texte-doux">
              {plieuses.map((p) => (
                <li key={p.nom}>
                  {p.nom} — {p.force}, {p.longueur}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col">
            <IconeSoudure className="text-accent" />
            <h3 className="mt-4 text-2xl text-steel">Soudure</h3>
            <p className="mt-3 text-[15px] text-texte-doux">Assemblage de vos pièces découpées et pliées, livrées prêtes à poser.</p>
          </Card>
          <Card className="flex flex-col border-accent/30">
            <IconeDevis className="text-accent" />
            <h3 className="mt-4 text-2xl text-steel">Devis instantané</h3>
            <p className="mt-3 text-[15px] text-texte-doux">Matière, épaisseur, forme, cotes : le prix s&apos;affiche tout de suite.</p>
            <Link href="/devis" className="mt-auto inline-flex items-center gap-1.5 pt-4 font-semibold text-accent hover:text-accent-hover">
              Configurer ma pièce <IconeFleche />
            </Link>
          </Card>
        </div>
        <p className="mt-8">
          <Link href="/savoir-faire" className="inline-flex items-center gap-1.5 font-semibold text-steel hover:text-accent">
            Toutes nos capacités machine <IconeFleche />
          </Link>
        </p>
      </Section>

      {/* ------------------------------------------------ Matières */}
      <Section aria-labelledby="matieres">
        <EnTete id="matieres" surTitre="Matières" titre="Matières et finitions disponibles">
          <p>Les tôles que nous découpons au quotidien. Les autres métaux se traitent sur demande.</p>
        </EnTete>
        <ul className="mt-10 flex flex-wrap gap-3">
          {[
            ["Acier brut", "acier-brut"],
            ["Acier galvanisé", "acier-galvanise"],
            ["Corten", "acier-corten"],
            ["Inox brossé", "inox-brosse"],
            ["Inox miroir", "inox-miroir"],
            ["Aluminium", "alu-brut"],
          ].map(([label, ancre]) => (
            <li key={ancre}>
              <Link
                href={`/matieres#${ancre}`}
                className="inline-flex rounded-full border border-bordure bg-surface px-5 py-2.5 font-medium text-steel transition-colors hover:border-steel hover:bg-blanc"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link href="/matieres" className="inline-flex items-center gap-1.5 font-semibold text-steel hover:text-accent">
            Quelle matière choisir ? <IconeFleche />
          </Link>
        </p>
      </Section>

      {/* ------------------------------------------------ Devis en ligne */}
      <Section ton="sombre" aria-labelledby="devis-en-ligne">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <EnTete id="devis-en-ligne" surTitre="Devis en ligne" titre="Votre prix, en quelques secondes." sombre>
            <p>
              Choisissez la matière, l&apos;épaisseur, la forme et les dimensions : le prix s&apos;affiche instantanément. Pour une
              pièce complexe ou une grande série, notre équipe reprend la main par message.
            </p>
          </EnTete>
          <div>
            <ol className="grid gap-3 sm:grid-cols-5">
              {["Matière", "Épaisseur", "Forme", "Dimensions", "Prix instantané"].map((etape, i) => (
                <li
                  key={etape}
                  className={`flex items-center gap-3 rounded-btn-lg border px-4 py-3 sm:flex-col sm:items-start sm:gap-2 ${
                    i === 4 ? "border-accent bg-accent/15" : "border-blanc/12 bg-blanc/4"
                  }`}
                >
                  <span className="font-display text-2xl font-extrabold text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[15px] font-medium">{etape}</span>
                </li>
              ))}
            </ol>
            <Button href="/devis" className="mt-8">
              Configurer ma pièce <IconeFleche />
            </Button>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------ Réalisations */}
      <Section aria-labelledby="realisations">
        <EnTete id="realisations" surTitre="Réalisations" titre="Sorties de l'atelier." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { titre: "Découpe laser", photo: "/images/vitrine-bride-epaisse.webp", alt: "Bride épaisse découpée au laser, deux perçages" },
            { titre: "Pliage", photo: "/images/vitrine-support-plie-inserts.webp", alt: "Support découpé et plié, avec deux inserts" },
            { titre: "Décoration", photo: "/images/vitrine-panneau-decoratif.webp", alt: "Panneau décoratif découpé au laser : silhouette de femme dans un cadre" },
          ].map(({ titre, photo, alt }) => (
            <figure key={titre}>
              <Image src={photo} alt={alt} width={1254} height={1254} className="aspect-square w-full rounded-card border border-bordure bg-blanc object-contain" />
              <figcaption className="mt-4 font-display text-2xl font-extrabold text-steel">{titre}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-8">
          <Link href="/realisations" className="inline-flex items-center gap-1.5 font-semibold text-steel hover:text-accent">
            Voir les réalisations <IconeFleche />
          </Link>
        </p>
      </Section>

      {/* ------------------------------------------------ Appel final */}
      <Section ton="surface" aria-labelledby="contact-final">
        <div className="flex flex-col gap-10 rounded-card bg-steel-deep p-8 text-blanc md:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[620px]">
            <h2 id="contact-final" className="text-[34px] md:text-[44px]">
              Un plan à découper ? Discutons-en.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-gris-clair-3">
              Envoyez votre plan ou décrivez votre besoin — réponse sous 48 h pour les pièces hors configurateur.
            </p>
            <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-gris-clair-2">
              <a href={`tel:${site.telephoneIntl}`} className="inline-flex items-center gap-2 hover:text-blanc">
                <IconeTelephone /> {site.telephone}
              </a>
              <a href={`mailto:${site.email}`} className="inline-flex items-center gap-2 hover:text-blanc">
                <IconeMail /> {site.email}
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button href="/contact#formulaire">Envoyer un plan</Button>
            <Button href="/devis" variante="outline">
              Configurer ma pièce
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
