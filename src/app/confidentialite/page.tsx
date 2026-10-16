import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageJuridique } from "@/components/Juridique";
import { Todo } from "@/components/ui";
import { adresseUneLigne, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  alternates: { canonical: "/confidentialite" },
  // Placeholder : pas d'indexation tant que le texte définitif n'est pas en ligne.
  robots: { index: false, follow: true },
};

/**
 * Inventaire TECHNIQUE et factuel des données traitées par le site (relevé dans le code le
 * 16/10/2026). Ce n'est pas un texte juridique : le juriste rédige la politique définitive à
 * partir de cet inventaire. Si le site change (nouveau formulaire, mesure d'audience…), le mettre à jour.
 */
const TRAITEMENTS: { usage: string; donnees: string; destinataires: string }[] = [
  {
    usage: "Formulaire de contact",
    donnees: "Nom, adresse mail, téléphone (facultatif), message, plans joints",
    destinataires: "Transmis par mail à l'atelier (messagerie IONOS). Rien n'est conservé sur le site lui-même.",
  },
  {
    usage: "Demande de devis depuis le configurateur",
    donnees: "Nom, adresse mail, téléphone (facultatif), message, configuration de la pièce",
    destinataires: "Transmis par mail à l'atelier (messagerie IONOS). Rien n'est conservé sur le site lui-même.",
  },
  {
    usage: "Commande et paiement en ligne",
    donnees:
      "Nom, société, adresse mail, téléphone, adresses de facturation et de livraison, numéro de TVA (facultatif), configuration commandée",
    destinataires:
      "Stripe (paiement : la carte bancaire est saisie chez Stripe, ADM n'y a jamais accès), atelier ADM et client (mails via IONOS).",
  },
  {
    usage: "Expédition des commandes",
    donnees: "Nom, adresse de livraison, téléphone et adresse mail du destinataire",
    destinataires: "Boxtal et le transporteur choisi (Colissimo ou TNT), pour éditer l'étiquette et livrer.",
  },
];

export default function Confidentialite() {
  const lignes: [string, ReactNode][] = [
    ["Responsable du traitement", `${site.raisonSociale} (${site.nom}), ${adresseUneLigne}`],
    ["Contact", `${site.email} · ${site.telephone}`],
    ["Durées de conservation", <Todo key="duree">à fixer par le juriste</Todo>],
    ["Bases légales", <Todo key="base">à préciser par le juriste</Todo>],
    ["Exercice des droits (accès, rectification, effacement…)", <Todo key="droits">procédure à rédiger par le juriste</Todo>],
  ];

  return (
    <PageJuridique titre="Politique de confidentialité">
      <h2 className="text-[30px] text-steel">Données traitées par le site</h2>
      <p className="mt-2 text-texte-doux">Relevé technique des données collectées et de leurs destinataires, en attente du texte définitif.</p>
      <div className="mt-6 divide-y divide-bordure rounded-card border border-bordure">
        {TRAITEMENTS.map((t) => (
          <div key={t.usage} className="px-5 py-4">
            <h3 className="font-display text-xl font-extrabold text-steel">{t.usage}</h3>
            <p className="mt-1 text-texte">
              <span className="text-texte-doux">Données : </span>
              {t.donnees}
            </p>
            <p className="mt-1 text-texte">
              <span className="text-texte-doux">Destinataires : </span>
              {t.destinataires}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-[30px] text-steel">Cookies et traceurs</h2>
      <p className="mt-3 text-texte">
        Le site ne dépose aucun cookie et n&apos;utilise aucun outil de mesure d&apos;audience ni de publicité. Deux éléments viennent
        de services extérieurs : la carte de la page Contact, chargée depuis OpenStreetMap, et la page de paiement, hébergée par
        Stripe.
      </p>

      <h2 className="mt-12 text-[30px] text-steel">Responsable et droits</h2>
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
