import type { Metadata } from "next";
import Link from "next/link";
import { IconeFleche, IconeLaser, IconePliage, IconeSoudure } from "@/components/Icones";
import { Button, Card, Container, EnTete, Section, SurTitre, Todo } from "@/components/ui";
import { catalogue, formatTole, listeEpaisseurs, mm, plageEpaisseurs } from "@/lib/devis/catalogue";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Découpe laser, pliage et soudure — capacités machine",
  description:
    "Découpe laser Trumpf 3 kW sur tôle 1500 × 3000 mm, pliage jusqu'à 3 m, soudure : nos capacités réelles en acier, inox et alu, à Vaires-sur-Marne.",
  alternates: { canonical: "/savoir-faire" },
};

export default function SavoirFaire() {
  const { laser, plieuses } = site.machines;
  const matieresAuto = Object.entries(catalogue.matieres).filter(([, m]) => m.devis_automatique);
  const matieresSurDevis = Object.values(catalogue.matieres).filter((m) => !m.devis_automatique);

  return (
    <>
      <section className="bg-hero text-blanc">
        <Container className="py-16 md:py-20">
          <SurTitre>Savoir-faire</SurTitre>
          <h1 className="max-w-[820px] text-[40px] md:text-[54px]">Découpe laser, pliage et soudure sur mesure en Seine-et-Marne</h1>
          <p className="mt-6 max-w-[640px] text-lg leading-relaxed text-gris-clair-3">
            Atelier de tôlerie industrielle à {site.adresse.ville}, {site.experience}. De la pièce unitaire à la série, sur plan ou
            sur mesure, nous enchaînons découpe, pliage et soudure sous le même toit.
          </p>
          <nav aria-label="Sur cette page" className="mt-8 flex flex-wrap gap-3">
            {[
              ["#decoupe-laser", "Découpe laser"],
              ["#pliage", "Pliage"],
              ["#soudure", "Soudure"],
              ["#fichiers", "Fichiers & tolérances"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full border border-blanc/25 px-4 py-2 text-[15px] text-gris-clair-3 hover:border-blanc hover:text-blanc">
                {label}
              </a>
            ))}
          </nav>
        </Container>
      </section>

      {/* ------------------------------------------------ Découpe laser */}
      <Section id="decoupe-laser" aria-labelledby="t-laser">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
          <div>
            <IconeLaser className="text-accent" width={36} height={36} />
            <EnTete id="t-laser" titre="Découpe laser" className="mt-4">
              <p>
                Une source laser de {laser.puissance} sur une {laser.nom}. Les tôles sont découpées sur notre format maximal, au plus
                juste pour limiter la chute.
              </p>
            </EnTete>
            <dl className="mt-8 grid grid-cols-2 gap-4">
              {[
                ["Machine", laser.nom],
                ["Puissance", laser.puissance],
                ["Format tôle maxi", formatTole()],
                ["Plus petit trou", "Ø ≥ épaisseur"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-card bg-surface p-4">
                  <dt className="text-sm text-texte-doux">{k}</dt>
                  <dd className="mt-1 font-display text-2xl font-extrabold text-steel">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[15px] text-texte-doux">{catalogue.contraintes.diametre_trou_min_note}</p>
          </div>

          <div>
            <h3 className="text-[26px] text-steel">Épaisseurs disponibles</h3>
            <p className="mt-2 text-texte-doux">Ce que nous avons réellement en stock et savons couper, matière par matière.</p>
            <div className="mt-6 overflow-x-auto rounded-card border border-bordure">
              <table className="w-full min-w-[440px] text-left text-[15px]">
                <thead className="bg-surface text-sm text-texte-doux">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Matière
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Nuance
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Épaisseurs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matieresAuto.flatMap(([cle, m]) =>
                    Object.entries(m.nuances).map(([nk, n], i) => (
                      <tr key={`${cle}.${nk}`} className="border-t border-bordure">
                        {i === 0 && (
                          <th scope="rowgroup" rowSpan={Object.keys(m.nuances).length} className="bg-blanc px-4 py-3 align-top font-semibold text-steel">
                            {m.label}
                            <span className="block text-sm font-normal text-texte-doux">
                              {(() => {
                                const p = plageEpaisseurs(cle);
                                return p ? `${mm(p.min)} à ${mm(p.max)} mm` : "";
                              })()}
                            </span>
                          </th>
                        )}
                        <td className="px-4 py-3">
                          <Link href={`/matieres#${cle}-${nk}`} className="hover:text-accent">
                            {n.label}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-texte-doux">{listeEpaisseurs(n.epaisseurs)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            {matieresSurDevis.length > 0 && (
              <p className="mt-4 text-[15px] text-texte-doux">
                {matieresSurDevis.map((m) => m.label).join(" et ")} : sur devis uniquement —{" "}
                <Link href="/contact#formulaire" className="font-semibold text-steel underline underline-offset-4 hover:text-accent">
                  écrivez-nous avec votre plan
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------ Pliage */}
      <Section id="pliage" ton="surface" aria-labelledby="t-pliage">
        <IconePliage className="text-accent" width={36} height={36} />
        <EnTete id="t-pliage" titre="Pliage" className="mt-4">
          <p>Deux presses plieuses Trumpf pour mettre en forme vos pièces juste après la découpe, sans changer d&apos;atelier.</p>
        </EnTete>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {plieuses.map((p) => (
            <Card key={p.nom}>
              <h3 className="text-[26px] text-steel">{p.nom}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-texte-doux">Force</dt>
                  <dd className="font-display text-3xl font-extrabold text-steel">{p.force}</dd>
                </div>
                <div>
                  <dt className="text-sm text-texte-doux">Longueur de pliage</dt>
                  <dd className="font-display text-3xl font-extrabold text-steel">{p.longueur}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------ Soudure */}
      <Section id="soudure" aria-labelledby="t-soudure">
        <IconeSoudure className="text-accent" width={36} height={36} />
        <EnTete id="t-soudure" titre="Soudure" className="mt-4">
          <p>Assemblage de vos pièces découpées et pliées : des ensembles prêts à poser, pas seulement des pièces découpées.</p>
        </EnTete>
        <p className="mt-6">
          <Todo>postes de soudure, matières et épaisseurs soudées — à préciser par ADM</Todo>
        </p>
      </Section>

      {/* ------------------------------------------------ Fichiers & tolérances */}
      <Section id="fichiers" ton="surface" aria-labelledby="t-fichiers">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 id="t-fichiers" className="text-[34px] text-steel md:text-[44px]">
              Fichiers acceptés
            </h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {site.formatsFichiers.map((f) => (
                <li key={f} className="rounded-btn border border-bordure bg-blanc px-4 py-2 font-display text-xl font-extrabold text-steel">
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[17px] leading-relaxed text-texte-doux">
              Envoyez votre plan, {site.delaiReponse}. Pas de plan ? Décrivez votre pièce, on la dessine avec vous.
            </p>
          </div>
          <div>
            <h2 className="text-[34px] text-steel md:text-[44px]">Tolérances</h2>
            <p className="mt-6">
              <Todo>tolérances de découpe et de pliage — à fournir par ADM</Todo>
            </p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Button href="/devis">
            Configurer ma pièce <IconeFleche />
          </Button>
          <Button href="/contact#formulaire" variante="outline-sombre">
            Envoyer un plan
          </Button>
        </div>
      </Section>
    </>
  );
}
