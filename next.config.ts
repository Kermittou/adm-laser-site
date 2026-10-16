import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image autonome pour le déploiement Docker sur Dokploy.
  output: "standalone",
  // Ne jamais embarquer dans l'image : mails de développement (données clients de test),
  // oracle Python, archives de calibrage, photos de travail.
  outputFileTracingExcludes: {
    "*": ["boite-envoi/**", "reference/**", "archives/**", "photos-a-refaire.zip", "test/**"],
  },
};

export default nextConfig;
