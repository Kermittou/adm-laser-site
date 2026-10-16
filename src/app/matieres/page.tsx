import type { Metadata } from "next";
import Link from "next/link";
import { Conseiller } from "@/components/Conseiller";
import { IconeFleche } from "@/components/Icones";
import { Button, Container, Section, SurTitre } from "@/components/ui";
import { PROPS } from "@/lib/conseiller";
import { catalogue, listeEpaisseurs, mm, plageEpaisseurs } from "@/lib/devis/catalogue";

export const metadata: Metadata = {
  title: "Découpe Corten, tôle larmée, inox brossé sur mesure",
  description:
    "Acier brut, galvanisé, Corten, tôle larmée, inox brossé ou miroir, aluminium : 14 nuances découpées au laser sur mesure. Le questionnaire vous aide à choisir.",
  alternates: { canonical: "/matieres" },
};

// Nom d'usage de chaque nuance, tel qu'un client le cherche.
const NOM_USAGE: Record<string, string> = {
  "acier.brut": "Acier brut",
  "acier.noir": "Tôle noire",
  "acier.bleue": "Tôle bleue",
  "acier.galvanise": "Tôle galvanisée",
  "acier.electrozingue": "Tôle électrozinguée",
  "acier.corten": "Acier Corten",
  "acier.larme": "Tôle larmée acier",
  "acier.perfore": "Tôle perforée",
  "inox.brut": "Inox brut",
  "inox.marin": "Inox marin",
  "inox.miroir": "Inox miroir",
  "inox.brosse": "Inox brossé",
  "alu.brut": "Aluminium brut",
  "alu.larme": "Tôle larmée aluminium",
};

function etiquettes(cle: string): string[] {
  const p = PROPS[cle];
  return [
    p.marin && "Air salin",
    p.inox && "Ne rouille pas",
    p.antid && "Antidérapant",
    p.esth && "Décoratif",
    p.alu && "Léger",
    p.eco && "Économique",
    p.pliable ? "Pliable" : "Ne se plie pas",
  ].filter((x): x is string => Boolean(x));
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Matieres() {
  const parMatiere = Object.entries(catalogue.matieres)
    .filter(([, m]) => m.devis_automatique)
    .map(([mk, m]) => ({
      mk,
      m,
      nuances: Object.keys(PROPS)
        .filter((cle) => cle.startsWith(`${mk}.`))
        .map((cle) => ({ cle, nk: cle.split(".")[1] }))
        .filter(({ nk }) => m.nuances[nk]),
    }));
  const surDevis = Object.values(catalogue.matieres).filter((m) => !m.devis_automatique);
  const nbNuances = parMatiere.reduce((n, g) => n + g.nuances.length, 0);

  return (
    <>
      <section className="bg-hero text-blanc">
        <Container className="py-16 md:py-20">
          <SurTitre>Matières</SurTitre>
          <h1 className="max-w-[860px] text-[40px] md:text-[54px]">Acier, inox, aluminium : {nbNuances} nuances découpées sur mesure</h1>
          <p className="mt-6 max-w-[640px] text-lg leading-relaxed text-gris-clair-3">
            De la tôle d&apos;acier brut au Corten, de l&apos;inox brossé à la tôle larmée pour vos marches : chaque nuance a ses atouts et
            ses limites. Pas sûr de votre choix ? Cinq questions suffisent.
          </p>
          <div className="mt-8">
            <Button href="#conseiller">
              Quelle matière choisir ? <IconeFleche />
            </Button>
          </div>
        </Container>
      </section>

      <Section id="conseiller" ton="surface" aria-labelledby="t-conseiller">
        <h2 id="t-conseiller" className="text-[34px] text-steel md:text-[44px]">
          Quelle matière choisir ?
        </h2>
        <p className="mt-4 mb-10 max-w-[640px] text-[17px] leading-relaxed text-texte-doux">
          Dites-nous où vivra la pièce et ce qu&apos;on attend d&apos;elle : nous classons les nuances, avec ce qui joue pour chacune — et
          les réserves.
        </p>
        <Conseiller />
      </Section>

      {parMatiere.map(({ mk, m, nuances }) => {
        const plage = plageEpaisseurs(mk);
        return (
          <Section key={mk} id={mk} aria-labelledby={`t-${mk}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
              <h2 id={`t-${mk}`} className="text-[34px] text-steel md:text-[44px]">
                Découpe laser {m.label.toLowerCase()}
              </h2>
              {plage && (
                <p className="text-texte-doux">
                  {mm(plage.min)} à {mm(plage.max)} mm d&apos;épaisseur
                </p>
              )}
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nuances.map(({ cle, nk }) => (
                <article key={cle} id={`${mk}-${nk}`} className="flex scroll-mt-[96px] flex-col rounded-card border border-bordure bg-blanc p-6">
                  <h3 className="text-[26px] text-steel">{NOM_USAGE[cle] ?? `${m.label} ${m.nuances[nk].label}`}</h3>
                  <p className="mt-2 leading-relaxed text-texte">{majuscule(PROPS[cle].txt)}.</p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {etiquettes(cle).map((e) => (
                      <li
                        key={e}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          e === "Ne se plie pas" ? "bg-accent/10 text-accent-hover" : "bg-surface text-texte-doux"
                        }`}
                      >
                        {e}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-texte-doux">Épaisseurs : {listeEpaisseurs(m.nuances[nk].epaisseurs)}</p>
                  <Link
                    href={`/devis?matiere=${mk}&nuance=${nk}`}
                    className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[15px] font-semibold text-steel hover:text-accent"
                  >
                    Chiffrer cette matière <IconeFleche />
                  </Link>
                </article>
              ))}
            </div>
          </Section>
        );
      })}

      {surDevis.length > 0 && (
        <Section ton="surface" aria-labelledby="t-sur-devis">
          <h2 id="t-sur-devis" className="text-[34px] text-steel md:text-[44px]">
            {surDevis.map((m) => m.label).join(", ")} et autres métaux
          </h2>
          <div className="mt-6 max-w-[680px] space-y-2 text-[17px] leading-relaxed text-texte-doux">
            {surDevis.map((m) => (
              <p key={m.label}>{m.message_devis}</p>
            ))}
          </div>
          <Button href="/contact#formulaire" className="mt-8">
            Nous envoyer votre plan
          </Button>
        </Section>
      )}
    </>
  );
}
