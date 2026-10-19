import { SITE_URL, site } from "@/lib/site";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Le JSON est produit par nous, à partir de site.ts : pas d'entrée utilisateur.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Données structurées LocalBusiness. Les champs inconnus sont omis, jamais inventés. */
export function localBusiness(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#entreprise`,
    name: site.nom,
    alternateName: site.nomComplet,
    legalName: site.raisonSociale,
    description:
      "Atelier de découpe laser, pliage et soudure en sous-traitance à Vaires-sur-Marne (77) : acier, inox et aluminium, de la pièce unitaire à la série.",
    url: SITE_URL,
    telephone: site.telephoneIntl,
    email: site.email,
    logo: `${SITE_URL}${site.logoFond}`,
    image: `${SITE_URL}${site.photoAtelier}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.adresse.rue,
      postalCode: site.adresse.codePostal,
      addressLocality: site.adresse.ville,
      addressRegion: site.adresse.region,
      addressCountry: site.adresse.pays,
    },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lon },
    areaServed: [
      { "@type": "AdministrativeArea", name: site.adresse.departement },
      { "@type": "AdministrativeArea", name: site.adresse.region },
      { "@type": "Country", name: "France" },
    ],
    openingHoursSpecification: site.horaires.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.schema,
      opens: h.ouverture,
      closes: h.fermeture,
    })),
    vatID: site.legal.tva.replace(/\s/g, ""),
    // Pas de procédé de soudure nommé ici : « TIG/MIG » a été retiré du site faute de source (CLAUDE.md,
    // « Informations manquantes »). Déclarer à Google ce qu'ADM n'a pas confirmé serait pire qu'un oubli.
    knowsAbout: ["Découpe laser", "Pliage de tôle", "Soudure", "Tôlerie", "Acier", "Inox", "Aluminium"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Prestations",
      itemListElement: ["Découpe laser sur mesure", "Pliage de tôle", "Soudure"].map((nom) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: nom, areaServed: site.adresse.departement },
      })),
    },
  };
}

/**
 * Fil d'Ariane d'une page interne. Le site est plat : Accueil > la page. Google s'en sert pour
 * afficher « adm-laser.fr › Savoir-faire » au lieu de l'URL brute dans ses résultats.
 */
export function filDAriane(titre: string, chemin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: titre, item: `${SITE_URL}${chemin}` },
    ],
  };
}
