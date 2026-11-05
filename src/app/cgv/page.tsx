import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageJuridique } from "@/components/Juridique";
import { EXPEDITION, GRILLE } from "@/lib/commande";
import { tarifs } from "@/lib/devis/moteur";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  alternates: { canonical: "/cgv" },
  // Pas d'indexation tant que le juriste n'a pas validé le texte et complété les TODO.
  robots: { index: false, follow: true },
};

/*
 * Texte fourni par ADM le 05/11/2026, complété avec les informations du site (src/lib/site.ts,
 * data/*.json) et ajusté au fonctionnement réel de la commande en ligne (paiement bloqué puis
 * débité après validation, délai 2 ou 7 jours, palette TNT, Corse exclue). Les valeurs entre
 * crochets du texte d'origine sans source sont laissées en TODO visibles.
 */

const adresse = `${site.adresse.rue.replace(/^(\d+) Impasse/, "$1 impasse")}, ${site.adresse.codePostal} ${site.adresse.ville}`;
const vendeur = `${site.nom} – ${site.nomComplet}`;
const minimum = (tarifs.prix_minimum_eur ?? 0).toLocaleString("fr-FR");
const delais = EXPEDITION.options
  .filter((o) => o.transport && o.delai_jours)
  .map((o) => o.delai_jours as number)
  .sort((a, b) => a - b);
const { palette_poids_max_kg: palettePoids, palette_longueur_max_cm: paletteL, palette_largeur_max_cm: paletteW } = GRILLE._calcul;
const m = (cm: number) => (cm / 100).toLocaleString("fr-FR");
const heure = (h: string) => h.replace(/^0/, "").replace(":00", " h").replace(":", " h ");
const horaires = site.horaires
  .map((h) => {
    const [debut, fin] = h.jours.toLowerCase().split(/\s*–\s*/);
    return `${fin ? `du ${debut} au ${fin}` : `le ${debut}`} de ${heure(h.ouverture)} à ${heure(h.fermeture)}`;
  })
  .join(", ");
const forme = site.legal.formeJuridique.charAt(0).toLowerCase() + site.legal.formeJuridique.slice(1);

function Article({ n, titre, children }: { n: number; titre: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-[26px] text-steel">
        Article {n} — {titre}
      </h2>
      <div className="mt-3 space-y-3 text-texte">{children}</div>
    </section>
  );
}

const Liste = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1.5 pl-6">{children}</ul>;
const Gras = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-steel-night">{children}</strong>;

export default function Cgv() {
  return (
    <PageJuridique
      titre="Conditions générales de vente"
      note="Texte en cours de validation par notre conseil juridique. Pour toute question, contactez-nous."
    >
      <Article n={1} titre="Identification du vendeur">
        <p>
          Le site www.adm-laser.fr est exploité par {vendeur} ({site.raisonSociale}), {forme}, immatriculée au {site.legal.rcs.replace(/^RCS (\S+) /, "RCS de $1 sous le numéro ")}, dont le siège est
          situé {adresse}. N° de TVA intracommunautaire : {site.legal.tva}. Contact : {site.email} – {site.telephone}.
        </p>
        <p>Ci-après « ADM Laser » ou « le Vendeur ».</p>
      </Article>

      <Article n={2} titre="Objet et champ d'application">
        <p>
          Les présentes conditions générales de vente (CGV) régissent toute vente de pièces métalliques découpées, pliées ou façonnées
          commandées sur le site www.adm-laser.fr, par tout client :
        </p>
        <Liste>
          <li>
            <Gras>Consommateur</Gras> : personne physique agissant à des fins non professionnelles ;
          </li>
          <li>
            <Gras>Professionnel</Gras> : personne physique ou morale agissant pour les besoins de son activité.
          </li>
        </Liste>
        <p>
          Sauf mention contraire, chaque article s&apos;applique aux deux. Les clauses propres aux professionnels sont regroupées à
          l&apos;article 14. Toute commande vaut acceptation pleine des CGV en vigueur au jour de la commande, que le Client accepte en
          cochant la case prévue à cet effet. Les CGV sont consultables à tout moment sur le site, depuis le lien présent en bas de chaque
          page, et peuvent être imprimées ou enregistrées depuis le navigateur.
        </p>
        <p>
          Les présentes CGV prévalent sur tout document du Client, notamment ses conditions générales d&apos;achat, sauf accord écrit et
          signé d&apos;ADM Laser.
        </p>
      </Article>

      <Article n={3} titre="Produits proposés">
        <p>ADM Laser propose deux modes de commande :</p>
        <ol className="list-decimal space-y-1.5 pl-6">
          <li>
            <Gras>Configurateur en ligne</Gras> : le Client choisit la matière, la nuance, l&apos;épaisseur, la forme (et ses éventuelles
            découpes intérieures), les dimensions et la quantité. Le prix s&apos;affiche instantanément.
          </li>
          <li>
            <Gras>Pièce sur plan</Gras> : le Client transmet un fichier ({site.formatsFichiers.join(", ")}). ADM Laser étudie le fichier et
            adresse un devis sous 48 heures ouvrées.
          </li>
        </ol>
        <p>
          Les matières, nuances et épaisseurs disponibles sont celles affichées au moment de la commande. Le cuivre et le laiton sont
          proposés uniquement sur devis.
        </p>
        <p>Les photos et rendus du site sont illustratifs. L&apos;aspect réel des matières peut varier (voir article 8).</p>
      </Article>

      <Article n={4} titre="Formation du contrat">
        <p>
          <Gras>Commande via le configurateur.</Gras> Le Client valide sa configuration, vérifie le récapitulatif (caractéristiques,
          quantité, prix total HT et TTC, frais de livraison, délai), peut corriger toute erreur, puis confirme par un bouton portant la
          mention « Commande avec obligation de paiement » et procède au paiement. Le montant est alors bloqué sur sa carte. Le contrat
          est formé lorsque l&apos;atelier valide la commande et débite ce montant, au plus tard 7 jours après la commande ; le Client en
          est informé par e-mail.
        </p>
        <p>
          <Gras>Commande sur plan.</Gras> Le devis est valable 30 jours. Le contrat est formé à l&apos;acceptation du devis par le Client et au
          paiement (ou, pour un professionnel disposant d&apos;un compte, à l&apos;acceptation écrite du devis).
        </p>
        <p>
          ADM Laser envoie une confirmation de commande par e-mail, reprenant l&apos;ensemble des informations contractuelles et un lien
          vers les présentes CGV. ADM Laser peut refuser une commande en cas de litige de paiement en cours, de fichier inexploitable ou de
          pièce techniquement irréalisable : le montant bloqué sur la carte est alors libéré sans être débité, et le Client en est
          informé par e-mail.
        </p>
      </Article>

      <Article n={5} titre="Prix">
        <p>
          Les prix sont exprimés en euros. Ils sont affichés hors taxes (HT) et toutes taxes comprises (TTC), la TVA applicable étant
          ajoutée au taux en vigueur ; le montant payé est le montant TTC.
        </p>
        <p>
          Le prix comprend la matière et la découpe de la configuration choisie. Les frais de livraison sont indiqués séparément avant la
          validation de la commande. Un montant minimum de commande de {minimum} € HT s&apos;applique ; il est intégré au prix affiché.
        </p>
        <p>
          Le prix facturé est celui affiché lors de la validation de la commande. ADM Laser peut modifier ses prix à tout moment, sans
          effet sur les commandes déjà validées.
        </p>
      </Article>

      <Article n={6} titre="Paiement">
        <p>
          Le paiement s&apos;effectue en ligne, au moment de la commande, par carte bancaire via le prestataire de paiement sécurisé Stripe.
          Le montant est bloqué sur la carte du Client à la commande, puis débité après vérification et validation de la commande par
          l&apos;atelier, au plus tard 7 jours après la commande. Le paiement en ligne se fait uniquement par carte bancaire.
        </p>
        <p>Les données bancaires sont traitées exclusivement par le prestataire de paiement ; ADM Laser n&apos;y a pas accès.</p>
        <p>Une facture est transmise par e-mail à l&apos;expédition.</p>
      </Article>

      <Article n={7} titre="Fichiers et spécifications fournis par le Client">
        <p>
          Le Client est seul responsable des cotes, dimensions, quantités et fichiers qu&apos;il saisit ou transmet. ADM Laser fabrique la
          pièce conformément à ces données et n&apos;est pas tenu de vérifier leur adéquation à l&apos;usage prévu par le Client. Une erreur
          de saisie ou de plan imputable au Client ne constitue pas un défaut de conformité.
        </p>
        <p>
          Le Client garantit détenir les droits sur les plans, logos et motifs transmis et garantit ADM Laser contre toute réclamation
          d&apos;un tiers à ce titre. ADM Laser s&apos;engage à ne pas utiliser ni divulguer les fichiers du Client à d&apos;autres fins que
          l&apos;exécution de sa commande.
        </p>
        <p>ADM Laser peut refuser de fabriquer toute pièce contraire à la loi ou portant atteinte aux droits d&apos;un tiers.</p>
      </Article>

      <Article n={8} titre="Tolérances et aspect des matières">
        <p>
          <Gras>Tolérances.</Gras> Les pièces sont découpées au laser fibre avec une tolérance dimensionnelle de{" "}
{site.tolerances.decoupe}, et une tolérance de
          planéité conforme aux normes des tôles fournies par les aciéries. Le diamètre minimal d&apos;un trou est égal à l&apos;épaisseur
          de la tôle.
        </p>
        <p>
          <Gras>Aspect.</Gras> Les caractéristiques suivantes sont inhérentes aux matières et au procédé et ne constituent pas un défaut :
        </p>
        <Liste>
          <li>légères traces de découpe, bavures fines ou points d&apos;attache sur le contour ;</li>
          <li>calamine et coloration des chants sur l&apos;acier, notamment en forte épaisseur ;</li>
          <li>oxydation de surface de l&apos;acier brut non protégé, qui n&apos;est livré avec aucun traitement anticorrosion ;</li>
          <li>évolution de la teinte de l&apos;acier corten, dont la patine se forme naturellement avec le temps et l&apos;exposition ;</li>
          <li>variations de teinte, de grain ou de brossage entre deux tôles d&apos;un même lot.</li>
        </Liste>
        <p>
          Les pièces à finition décorative (inox miroir, inox brossé…) sont livrées avec un film de protection ; les autres nuances sont
          livrées sans film.
        </p>
      </Article>

      <Article n={9} titre="Délais de fabrication et d'expédition">
        <p>
          ADM Laser s&apos;engage à expédier la commande dans le délai choisi par le Client lors de la commande, soit{" "}
          {delais.map((d) => `${d} jours ouvrés`).join(" ou ")}, à compter de la commande en ligne (pour une pièce sur plan : de
          l&apos;acceptation du devis et du paiement). Les jours ouvrés s&apos;entendent du lundi au vendredi, hors jours fériés.
        </p>
        <p>
          Le délai de livraison total est indiqué dans le récapitulatif avant la commande. À défaut d&apos;indication, la livraison
          intervient au plus tard 30 jours après la conclusion du contrat.
        </p>
        <p>
          Pour les quantités importantes ou les pièces complexes, un délai spécifique peut être indiqué dans le devis ; il prévaut alors.
        </p>
      </Article>

      <Article n={10} titre="Livraison">
        <p>
          <Gras>Zone.</Gras> Les livraisons sont effectuées en France métropolitaine continentale, Corse et outre-mer exclus. Pour toute
          autre destination, contacter ADM Laser.
        </p>
        <p>
          <Gras>Transporteur.</Gras> Les colis sont expédiés par Colissimo, dans les limites de poids et de dimensions du transporteur. Les
          commandes qui les dépassent sont livrées sur palette par messagerie
          {palettePoids && paletteL && paletteW
            ? ` (jusqu'à ${palettePoids.toLocaleString("fr-FR")} kg et ${m(paletteL)} × ${m(paletteW)} m)`
            : ""}
          , au prix indiqué avant la commande ; au-delà, la livraison fait l&apos;objet d&apos;un devis.
        </p>
        <p>
          <Gras>Retrait à l&apos;atelier.</Gras> Le Client peut retirer gratuitement sa commande au {adresse}, {horaires}, après réception
          d&apos;un e-mail l&apos;informant que la commande est prête.
        </p>
        <p>
          <Gras>Emballage.</Gras> Les pièces sont emballées pour éviter rayures et déformations pendant le transport.
        </p>
        <p>
          <Gras>Retard (consommateurs).</Gras> En cas de dépassement du délai de livraison, le consommateur peut enjoindre ADM Laser, par
          écrit, de livrer dans un délai supplémentaire raisonnable. À défaut de livraison dans ce délai, il peut résoudre le contrat par
          écrit et obtient le remboursement des sommes versées au plus tard dans les 14 jours (articles L216-6 et L216-7 du Code de la
          consommation).
        </p>
      </Article>

      <Article n={11} titre="Transfert des risques, réception et réserves">
        <p>
          <Gras>Consommateurs.</Gras> Les risques de perte ou d&apos;endommagement sont transférés au consommateur lorsqu&apos;il prend, ou
          qu&apos;un tiers désigné par lui prend, physiquement possession des pièces. Si le consommateur choisit lui-même un transporteur
          non proposé par ADM Laser, les risques lui sont transférés à la remise au transporteur.
        </p>
        <p>
          <Gras>Professionnels.</Gras> Les risques sont transférés au Client dès la remise des pièces au transporteur ou dès leur mise à
          disposition à l&apos;atelier.
        </p>
        <p>
          À la réception, le Client vérifie l&apos;état du colis en présence du livreur. En cas de colis endommagé ou de pièces manquantes,
          il émet des réserves précises sur le bon de livraison et en informe ADM Laser à {site.email}. Le Client professionnel confirme ses
          réserves au transporteur par lettre recommandée dans les 3 jours suivant la réception (article L133-3 du Code de commerce), faute
          de quoi tout recours contre le transporteur est perdu.
        </p>
      </Article>

      <Article n={12} titre="Droit de rétractation (consommateurs)">
        <p>
          <Gras>Exclusion pour les pièces sur mesure.</Gras> Conformément à l&apos;article L221-28, 3° du Code de la consommation, le droit
          de rétractation ne peut pas être exercé pour les biens confectionnés selon les spécifications du consommateur ou nettement
          personnalisés. Toutes les pièces commandées via le configurateur (dimensions, forme et options choisies par le Client) ou sur plan
          entrent dans cette catégorie. Le Client en est informé avant la validation de sa commande et l&apos;accepte expressément en
          cochant une case dédiée.
        </p>
        <p>
          <Gras>Produits standard.</Gras> Pour tout produit vendu en l&apos;état, sans personnalisation, signalé comme tel sur sa fiche, le
          consommateur dispose d&apos;un délai de 14 jours à compter de la réception pour se rétracter, sans motif ni pénalité. Il peut le
          faire en envoyant le formulaire type figurant en annexe 2, ou toute déclaration dénuée d&apos;ambiguïté, à {site.email} ou par
          courrier à l&apos;adresse du siège.
        </p>
        <p>
          ADM Laser accuse réception de la rétractation sans délai sur support durable. Le consommateur renvoie les produits au plus tard
          14 jours après sa rétractation ; les frais de retour sont à sa charge. ADM Laser rembourse la totalité des sommes versées, frais
          de livraison initiaux inclus (sur la base du mode de livraison standard), dans les 14 jours suivant la rétractation, par le même
          moyen de paiement. Le remboursement peut être différé jusqu&apos;à récupération des produits. La responsabilité du consommateur
          est engagée en cas de dépréciation résultant de manipulations autres que celles nécessaires pour établir leur nature et leurs
          caractéristiques.
        </p>
        <p>
          <Gras>Professionnels.</Gras> Aucun droit de rétractation ne s&apos;applique aux commandes passées par un professionnel, sous
          réserve de l&apos;article L221-3 du Code de la consommation.
        </p>
      </Article>

      <Article n={13} titre="Garanties légales (consommateurs)">
        <p>
          Le consommateur bénéficie de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation) pendant
          2 ans à compter de la délivrance, et de la garantie des vices cachés (articles 1641 à 1649 du Code civil) pendant 2 ans à compter
          de la découverte du vice. Le contenu de ces garanties est reproduit dans l&apos;encadré de l&apos;annexe 1.
        </p>
        <p>
          Pour les mettre en œuvre, le consommateur contacte ADM Laser à {site.email} en joignant son numéro de commande et des photos du
          défaut. Ne relèvent pas de ces garanties les écarts dus à une erreur de spécification du Client (article 7), les
          caractéristiques d&apos;aspect décrites à l&apos;article 8, ni les dommages causés par une mauvaise utilisation, un stockage
          inadapté ou une transformation ultérieure de la pièce.
        </p>
      </Article>

      <Article n={14} titre="Dispositions propres aux professionnels">
        <p>
          <Gras>Paiement différé.</Gras> Un professionnel disposant d&apos;un compte validé par ADM Laser peut régler par virement à 30 jours
          à compter de la date de facture, sans escompte pour paiement anticipé.
        </p>
        <p>
          <Gras>Retard de paiement.</Gras> Tout retard entraîne de plein droit, sans rappel préalable, des pénalités égales au taux de
          refinancement de la BCE majoré de 10 points, ainsi qu&apos;une indemnité forfaitaire pour frais de recouvrement de 40 € (article
          L441-10 du Code de commerce). ADM Laser peut suspendre toute commande en cours jusqu&apos;au paiement complet.
        </p>
        <p>
          <Gras>Conformité.</Gras> Le Client contrôle les pièces dès réception. Toute réclamation pour non-conformité apparente doit être
          formulée par écrit, photos à l&apos;appui, dans les 5 jours ouvrés suivant la réception. Passé ce délai, les pièces sont réputées
          acceptées. Si la non-conformité est reconnue, ADM Laser choisit entre la refabrication des pièces ou leur remboursement, à
          l&apos;exclusion de toute autre indemnité. Aucun retour n&apos;est accepté sans accord préalable.
        </p>
        <p>
          <Gras>Limitation de responsabilité.</Gras> La responsabilité d&apos;ADM Laser est limitée au montant HT de la commande concernée.
          ADM Laser ne répond pas des dommages indirects (perte d&apos;exploitation, de chiffre d&apos;affaires ou de production, frais de
          montage ou de démontage).
        </p>
      </Article>

      <Article n={15} titre="Réserve de propriété">
        <p>
          ADM Laser conserve la propriété des pièces jusqu&apos;au paiement intégral du prix en principal et accessoires. Cette clause ne
          fait pas obstacle au transfert des risques prévu à l&apos;article 11.
        </p>
      </Article>

      <Article n={16} titre="Force majeure">
        <p>
          Aucune partie n&apos;est responsable d&apos;un manquement causé par un événement de force majeure au sens de l&apos;article 1218
          du Code civil (panne majeure de la machine de découpe, rupture d&apos;approvisionnement en matière, incendie, grève du
          transporteur…). ADM Laser informe le Client sans délai ; si l&apos;empêchement dure plus de 30 jours, chaque partie peut résoudre
          la commande, les sommes versées étant remboursées.
        </p>
      </Article>

      <Article n={17} titre="Données personnelles">
        <p>
          Les données collectées lors de la commande (identité, coordonnées, adresse de livraison, fichiers transmis) sont nécessaires à son
          exécution et à la facturation. Elles sont traitées par ADM Laser, responsable de traitement, conformément au RGPD et à la loi
          Informatique et Libertés. Le détail des traitements, durées de conservation et droits du Client figure dans la{" "}
          <Link href="/confidentialite" className="text-steel underline underline-offset-4">
            politique de confidentialité
          </Link>
          . Le Client peut exercer ses droits à {site.email} et saisir la CNIL.
        </p>
      </Article>

      <Article n={18} titre="Droit applicable et juridiction">
        <p>
          Les présentes CGV sont soumises au droit français. En cas de litige avec un consommateur, celui-ci peut saisir la juridiction du
          lieu où il demeurait lors de la conclusion du contrat ou de la survenance du fait dommageable. Pour tout litige avec un
          professionnel, compétence exclusive est attribuée au tribunal compétent dans le ressort du siège social d&apos;ADM Laser, y compris
          en cas de pluralité de défendeurs ou d&apos;appel en garantie.
        </p>
      </Article>

      <section className="mt-14 rounded-card border border-bordure p-6 md:p-8">
        <h2 className="text-[26px] text-steel">Annexe 1 — Encadré des garanties légales</h2>
        <div className="mt-3 space-y-3 text-texte">
          <p>
            Le consommateur dispose d&apos;un délai de deux ans à compter de la délivrance du bien pour obtenir la mise en œuvre de la
            garantie légale de conformité en cas d&apos;apparition d&apos;un défaut de conformité. Durant ce délai, le consommateur n&apos;est
            tenu d&apos;établir que l&apos;existence du défaut de conformité et non la date d&apos;apparition de celui-ci.
          </p>
          <p>
            La garantie légale de conformité emporte le droit à la réparation ou au remplacement du bien dans un délai de trente jours
            suivant sa demande, sans frais et sans inconvénient majeur pour lui.
          </p>
          <p>
            Le consommateur peut obtenir une réduction du prix d&apos;achat en conservant le bien ou mettre fin au contrat en se faisant
            rembourser intégralement contre restitution du bien, si : 1° le professionnel refuse de réparer ou de remplacer le bien ; 2° la
            réparation ou le remplacement du bien intervient après un délai de trente jours ; 3° la réparation ou le remplacement du bien
            occasionne un inconvénient majeur pour le consommateur, notamment lorsque le consommateur supporte définitivement les frais de
            reprise ou d&apos;enlèvement du bien non conforme, ou s&apos;il supporte les frais d&apos;installation du bien réparé ou de
            remplacement ; 4° la non-conformité du bien persiste en dépit de la tentative de mise en conformité du vendeur restée
            infructueuse.
          </p>
          <p>
            Le consommateur a également droit à une réduction du prix du bien ou à la résolution du contrat lorsque le défaut de conformité
            est si grave qu&apos;il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n&apos;est
            alors pas tenu de demander la réparation ou le remplacement du bien au préalable. Le consommateur n&apos;a pas droit à la
            résolution de la vente si le défaut de conformité est mineur.
          </p>
          <p>
            Toute période d&apos;immobilisation du bien en vue de sa réparation ou de son remplacement suspend la garantie qui restait à
            courir jusqu&apos;à la délivrance du bien remis en état.
          </p>
          <p>Les droits mentionnés ci-dessus résultent de l&apos;application des articles L. 217-1 à L. 217-32 du code de la consommation.</p>
          <p>
            Le vendeur qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile
            d&apos;un montant maximal de 300 000 euros, qui peut être porté jusqu&apos;à 10 % du chiffre d&apos;affaires moyen annuel
            (article L. 241-5 du code de la consommation).
          </p>
          <p>
            Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du code
            civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si
            le bien est conservé ou à un remboursement intégral contre restitution du bien.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-card border border-bordure p-6 md:p-8">
        <h2 className="text-[26px] text-steel">Annexe 2 — Formulaire type de rétractation</h2>
        <div className="mt-3 space-y-3 text-texte">
          <p className="text-texte-doux">(Applicable uniquement aux produits standard non personnalisés — voir article 12.)</p>
          <p>
            À l&apos;attention de {vendeur}, {adresse} – {site.email} :
          </p>
          <p>
            Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien
            ci-dessous :
          </p>
          <Liste>
            <li>Commandé le (*) / reçu le (*) :</li>
            <li>Numéro de commande :</li>
            <li>Nom du (des) consommateur(s) :</li>
            <li>Adresse du (des) consommateur(s) :</li>
            <li>Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :</li>
            <li>Date :</li>
          </Liste>
          <p className="text-texte-doux">(*) Rayez la mention inutile.</p>
        </div>
      </section>
    </PageJuridique>
  );
}
