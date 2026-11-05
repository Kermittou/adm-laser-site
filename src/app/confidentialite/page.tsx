import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageJuridique } from "@/components/Juridique";
import { Todo } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  alternates: { canonical: "/confidentialite" },
  // Pas d'indexation tant que le juriste n'a pas validé le texte et complété les TODO.
  robots: { index: false, follow: true },
};

/*
 * Texte fourni par ADM le 05/11/2026, ajusté à ce que fait réellement le site (relevé dans le
 * code) : aucun cookie ni mesure d'audience (pas de Google Analytics, donc pas de bandeau),
 * aucune base de données (les commandes sont chez Stripe et dans les mails), carte de la page
 * Contact chargée depuis OpenStreetMap, étiquettes éditées via Boxtal. Si le site change
 * (mesure d'audience, nouveau prestataire…), mettre cette page à jour.
 */

const MISE_A_JOUR = "5 novembre 2026";
const adresse = `${site.adresse.rue.replace(/^(\d+) Impasse/, "$1 impasse")}, ${site.adresse.codePostal} ${site.adresse.ville}`;
const forme = site.legal.formeJuridique.charAt(0).toLowerCase() + site.legal.formeJuridique.slice(1);

const TRAITEMENTS: [string, string, string, string][] = [
  [
    "Gestion des commandes et livraison",
    "Nom, prénom, société, adresses de livraison et de facturation, e-mail, téléphone, contenu de la commande",
    "Exécution du contrat",
    "Durée de la commande, puis 5 ans (prescription civile et garanties)",
  ],
  [
    "Facturation et comptabilité",
    "Identité, coordonnées, SIRET et TVA pour les professionnels, montants, factures",
    "Obligation légale",
    "10 ans à compter de la clôture de l'exercice (art. L123-22 du Code de commerce)",
  ],
  [
    "Paiement",
    "Données de carte saisies directement chez Stripe ; ADM Laser ne reçoit que le statut du paiement et les 4 derniers chiffres de la carte",
    "Exécution du contrat",
    "Selon la politique de Stripe ; ADM Laser ne conserve aucun numéro de carte",
  ],
  [
    "Devis et étude de plans",
    `Coordonnées, fichiers transmis (${site.formatsFichiers.join(", ")}), échanges`,
    "Mesures précontractuelles",
    "3 ans après le dernier échange si le devis n'aboutit pas ; durée de la commande sinon",
  ],
  [
    "Demandes de contact",
    "Nom, e-mail, téléphone, contenu du message, pièces jointes",
    "Intérêt légitime (répondre aux demandes)",
    "3 ans après le dernier contact",
  ],
  [
    "Réclamations et garanties",
    "Coordonnées, commande concernée, photos, échanges",
    "Obligation légale et exécution du contrat",
    "5 ans après la clôture de la réclamation",
  ],
  [
    "Prospection commerciale par e-mail",
    "Nom, e-mail, société",
    "Professionnels : intérêt légitime ; particuliers : consentement, ou offres similaires pour les clients existants",
    "3 ans après le dernier contact ; arrêt immédiat en cas de désinscription",
  ],
];

const DESTINATAIRES: [ReactNode, ReactNode, ReactNode][] = [
  ["Stripe Payments Europe Ltd", "Paiement en ligne sécurisé", "Irlande (UE), transferts possibles vers les États-Unis"],
  ["Boxtal", "Édition des étiquettes d'expédition", "France"],
  ["La Poste – Colissimo", "Livraison des colis", "France"],
  ["TNT", "Livraison sur palette des pièces hors gabarit", "France"],
  ["IONOS SE", "Nom de domaine et messagerie", "Allemagne (UE)"],
  [site.hebergeur?.nom ?? <Todo key="h">hébergeur du serveur (voir la facture IONOS)</Todo>, "Hébergement du site", "Union européenne"],
  ["OpenStreetMap Foundation", "Carte de la page Contact (adresse IP du visiteur)", "Royaume-Uni (décision d'adéquation de la Commission européenne)"],
  ["Expert-comptable", <Todo key="c">nom du cabinet</Todo>, "France"],
];

function Titre({ children }: { children: ReactNode }) {
  return <h2 className="mt-12 text-[26px] text-steel first:mt-0">{children}</h2>;
}

const Liste = ({ children }: { children: ReactNode }) => <ul className="mt-3 list-disc space-y-1.5 pl-6 text-texte">{children}</ul>;
const P = ({ children }: { children: ReactNode }) => <p className="mt-3 text-texte">{children}</p>;

function Tableau({ entetes, lignes }: { entetes: string[]; lignes: ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-card border border-bordure">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead className="bg-surface text-texte-doux">
          <tr>
            {entetes.map((e) => (
              <th key={e} className="px-4 py-3 font-semibold">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bordure">
          {lignes.map((l, i) => (
            <tr key={i} className="align-top">
              {l.map((c, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "font-semibold text-steel" : "text-texte"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Confidentialite() {
  return (
    <PageJuridique
      titre="Politique de confidentialité"
      note="Texte en cours de validation par notre conseil juridique. Pour toute question, contactez-nous."
    >
      <p className="text-texte-doux">Dernière mise à jour : {MISE_A_JOUR}</p>
      <P>
        Cette page explique quelles données personnelles ADM Laser collecte sur adm-laser.fr, pourquoi, combien de temps elle les garde
        et comment exercer vos droits.
      </P>

      <Titre>1. Responsable du traitement</Titre>
      <P>
        Le responsable du traitement est {site.nomComplet} ({site.raisonSociale}, nom commercial {site.nom}), {forme}, SIRET{" "}
        {site.legal.siret}, {adresse}.
      </P>
      <P>
        Pour toute question ou demande relative à vos données : {site.email}, ou par courrier à l&apos;adresse ci-dessus en précisant
        « Données personnelles ». ADM Laser n&apos;a pas désigné de délégué à la protection des données, cette désignation n&apos;étant
        pas obligatoire pour son activité.
      </P>

      <Titre>2. Données collectées, finalités et durées de conservation</Titre>
      <P>ADM Laser ne collecte que les données nécessaires à chaque usage ci-dessous. Elle ne vend ni ne loue vos données.</P>
      <Tableau entetes={["Traitement", "Données", "Base légale", "Durée de conservation"]} lignes={TRAITEMENTS} />
      <P>
        Les plans et fichiers techniques transmis par les clients ne sont utilisés que pour établir le devis et fabriquer les pièces. Ils
        ne sont jamais communiqués à des tiers.
      </P>

      <Titre>3. Destinataires et sous-traitants</Titre>
      <P>
        Vos données sont accessibles aux seules personnes d&apos;ADM Laser qui traitent votre commande ou votre demande. Elles sont aussi
        transmises, dans la limite de ce qui est nécessaire, aux prestataires suivants :
      </P>
      <Tableau entetes={["Prestataire", "Rôle", "Localisation"]} lignes={DESTINATAIRES} />
      <P>Les données peuvent aussi être communiquées aux autorités administratives ou judiciaires lorsque la loi l&apos;impose.</P>
      <P>
        <strong className="font-semibold text-steel-night">Transferts hors de l&apos;Union européenne.</strong> Lorsque Stripe transfère
        des données aux États-Unis, ces transferts reposent sur la décision d&apos;adéquation de la Commission européenne relative au cadre
        de protection des données UE–États-Unis (Data Privacy Framework), ou à défaut sur les clauses contractuelles types de la
        Commission.
      </P>

      <Titre>4. Cookies</Titre>
      <P>
        Le site adm-laser.fr ne dépose aucun cookie et n&apos;utilise aucun outil de mesure d&apos;audience ni de publicité : aucun
        bandeau de consentement n&apos;est donc nécessaire. Deux éléments proviennent de services extérieurs, qui appliquent leurs propres
        règles : la carte de la page Contact, chargée depuis OpenStreetMap, et la page de paiement, hébergée par Stripe, qui utilise des
        cookies nécessaires à la sécurité du paiement.
      </P>

      <Titre>5. Sécurité</Titre>
      <P>
        ADM Laser met en œuvre des mesures adaptées pour protéger vos données : connexion chiffrée (HTTPS) sur tout le site, paiement
        traité intégralement par Stripe sans passage des données de carte par nos serveurs, accès aux commandes réservé au personnel
        habilité par identifiant et mot de passe.
      </P>
      <P>
        En cas de violation de données présentant un risque pour vous, ADM Laser en informe la CNIL dans les 72 heures et, si le risque
        est élevé, les personnes concernées.
      </P>

      <Titre>6. Vos droits</Titre>
      <P>Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants sur vos données :</P>
      <Liste>
        <li>accès : obtenir une copie des données vous concernant ;</li>
        <li>rectification : corriger des données inexactes ou incomplètes ;</li>
        <li>effacement : demander la suppression de vos données, sauf obligation légale de conservation (factures notamment) ;</li>
        <li>limitation : geler temporairement l&apos;utilisation de vos données ;</li>
        <li>opposition : vous opposer à un traitement fondé sur l&apos;intérêt légitime, et à tout moment à la prospection commerciale ;</li>
        <li>portabilité : recevoir les données fournies pour une commande dans un format lisible par machine ;</li>
        <li>retrait du consentement à tout moment, sans remettre en cause les traitements passés ;</li>
        <li>directives post-mortem : définir le sort de vos données après votre décès.</li>
      </Liste>
      <P>
        Pour exercer ces droits, écrivez à {site.email}. Une pièce d&apos;identité peut être demandée en cas de doute raisonnable sur votre
        identité. ADM Laser répond dans un délai d&apos;un mois, prolongeable de deux mois pour les demandes complexes.
      </P>
      <P>
        Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL : cnil.fr/fr/plaintes,
        3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.
      </P>

      <Titre>7. Modification de la politique</Titre>
      <P>
        Cette politique peut être mise à jour, notamment en cas de nouveau prestataire ou de nouvelle fonctionnalité. La date de mise à
        jour figure en tête de page.
      </P>
    </PageJuridique>
  );
}
