import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageJuridique } from "@/components/Juridique";
import { Todo } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  alternates: { canonical: "/mentions-legales" },
  // Indexées une fois les textes validés par le juriste (site.textesJuridiquesValides).
  robots: { index: site.textesJuridiquesValides, follow: true },
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
    ["Hébergeur du site", site.hebergeur ? `${site.hebergeur.nom}, ${site.hebergeur.adresse}` : <Todo>hébergeur du nouveau site (VPS Dokploy)</Todo>],
  ];

  return (
    <PageJuridique titre="Mentions légales">
      <h2 className="text-[30px] text-steel">Informations sur l&apos;entreprise</h2>
      {!site.textesJuridiquesValides && <p className="mt-2 text-texte-doux">En attente de validation par notre conseil juridique.</p>}
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
