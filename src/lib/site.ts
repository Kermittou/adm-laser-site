/**
 * Informations de l'entreprise — un seul endroit.
 *
 * Source : site actuel adm-laser.fr (pages Accueil, Contact, Mentions légales), relevé le 14/10/2026,
 * et fiche Google Maps « ADM Laser - Atelier Décoration Métal » relevée le 16/10/2026.
 * Tout champ à `null` est une information manquante : il s'affiche en TODO visible, jamais inventé.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.adm-laser.fr").replace(/\/$/, "");

export const site = {
  nom: "ADM Laser",
  nomComplet: "Atelier Décoration Métal",
  raisonSociale: "A.D.M",

  adresse: {
    rue: "3 Impasse de la Centrale",
    codePostal: "77360",
    ville: "Vaires-sur-Marne",
    departement: "Seine-et-Marne",
    region: "Île-de-France",
    pays: "FR",
  },
  // Position de la fiche Google Maps de l'atelier (16/10/2026).
  geo: { lat: 48.8742481, lon: 2.6511653 },

  telephone: "01 60 20 78 14",
  telephoneIntl: "+33160207814",
  email: "contact@adm-laser.fr",
  /** Reçoit les commandes payées en ligne à préparer (DXF et bordereaux joints). */
  emailCommandes: "commandes@adm-laser.fr",

  horaires: [
    { jours: "Lundi – Jeudi", ouverture: "07:30", fermeture: "17:00", schema: ["Monday", "Tuesday", "Wednesday", "Thursday"] },
    { jours: "Vendredi", ouverture: "07:30", fermeture: "12:00", schema: ["Friday"] },
  ],

  experience: "+50 ans d'expérience",
  delaiReponse: "réponse sous 48 h",
  formatsFichiers: ["DXF", "DWG", "PDF", "STEP"],

  machines: {
    laser: { nom: "Trumpf TruLaser 2030", puissance: "3 kW", format: "1500 × 3000 mm" },
    plieuses: [
      { nom: "Trumpf TrumaBend V85", force: "85 t", longueur: "2000 mm" },
      { nom: "Trumpf TruBend 3100", force: "100 t", longueur: "3000 mm" },
    ],
  },

  // Repris tels quels des mentions légales actuelles — à faire valider par le juriste.
  legal: {
    formeJuridique: "Société anonyme au capital de 25 000 €",
    representant: "Laurent Dupont",
    rcs: "RCS Meaux 309 835 890",
    siret: "309 835 890 00026",
    ape: "2599B",
    tva: "FR41 309 835 890",
  },

  // Logo et photos repris d'adm-laser.fr (16/10/2026), dans public/images/.
  logo: "/images/logo-adm-laser-detoure.png" as string | null,
  /** Logo original, fond bleu nuit (fiche entreprise Google, partages). */
  logoFond: "/images/logo-adm-laser.png",
  photoAtelier: "/images/atelier-trulaser-2030.png",
  // TODO : information à fournir par ADM.
  // Fiche Google Maps relevée le 16/10/2026 : 5,0 / 5 sur 6 avis. À mettre à jour de temps en temps.
  avisGoogle: { url: "https://maps.google.com/?cid=2974897766081181147" as string | null, note: 5 as number | null, nombre: 6 as number | null },
  hebergeur: null as string | null,
} as const;

export const adresseUneLigne = `${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}`;
