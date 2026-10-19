import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * Politique de sécurité du contenu. Tout vient du site lui-même : les polices sont servies par
 * `next/font` (aucun appel à Google), les images sont dans `public/`, et le paiement Stripe est
 * une redirection, pas une iframe. Seule exception : la carte OpenStreetMap de la page contact.
 *
 * `unsafe-inline` sur les scripts est imposé par l'hydratation de Next ; le supprimer demanderait
 * un nonce par requête, donc un middleware. `dangerouslySetInnerHTML` n'est utilisé qu'une fois,
 * dans JsonLd, sur du JSON déjà échappé.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${dev ? " ws: http://localhost:*" : ""}`,
  "frame-src https://www.openstreetmap.org",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const entetesSecurite = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Sans effet en HTTP : le navigateur ignore l'en-tête hors HTTPS, donc inoffensif en développement.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Image autonome pour le déploiement Docker sur Dokploy.
  output: "standalone",
  // Ne jamais embarquer dans l'image : mails de développement (données clients de test),
  // oracle Python, archives de calibrage, photos de travail.
  outputFileTracingExcludes: {
    "*": ["boite-envoi/**", "reference/**", "archives/**", "photos-a-refaire.zip", "test/**"],
  },
  async headers() {
    return [{ source: "/:chemin*", headers: entetesSecurite }];
  },
};

export default nextConfig;
