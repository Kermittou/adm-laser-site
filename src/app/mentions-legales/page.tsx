import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageJuridique } from "@/components/Juridique";
import { Todo } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  alternates: { canonical: "/mentions-legales" },
  // Placeholder : pas d'indexation tant que le texte définitif n'est pas en ligne.
  robots: { index: false, follow: true },
};

export default function MentionsLegales() {
  // Informations reprises telles quelles des mentions légales de l'actuel adm-laser.fr.
  // Elles ne remplacent pas le texte du juriste.
  const lignes: [string, ReactNode][] = [
    ["Société", site.raisonSociale],
    ["Siège social", `${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}`],
    ["Téléphone", site.telephone],
    ["Mail", site.email],
    ["Représentant légal", site.legal.representant],
    ["Forme juridique", site.legal.formeJuridique],
    ["Immatriculation", site.legal.rcs],
    ["SIRET", site.legal.siret],
    ["Code APE", site.legal.ape],
    ["TVA intracommunautaire", site.legal.tva],
    ["Hébergeur du site", site.hebergeur ?? <Todo>hébergeur du nouveau site (VPS Dokploy)</Todo>],
  ];

  return (
    <PageJuridique titre="Mentions légales">
      <h2 className="text-[30px] text-steel">Informations sur l&apos;entreprise</h2>
      <p className="mt-2 text-texte-doux">Reprises des mentions légales actuellement publiées, en attente de validation.</p>
      <dl className="mt-6 divide-y divide-bordure rounded-card border border-bordure">
        {lignes.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[220px_1fr]">
            <dt className="text-[15px] text-texte-doux">{k}</dt>
            <dd className="text-texte">{v}</dd>
          </div>
        ))}
      </dl>
    </PageJuridique>
  );
}
