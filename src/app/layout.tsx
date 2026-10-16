import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Sans } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd, localBusiness } from "@/components/JsonLd";
import { SITE_URL, site } from "@/lib/site";
import "./globals.css";

// Polices Google Fonts, téléchargées au build et servies depuis notre domaine :
// pas d'appel à fonts.googleapis.com depuis le navigateur du visiteur.
// « Big Shoulders Display » est désormais la famille variable « Big Shoulders » sur Google Fonts :
// la coupe Display correspond au haut de l'axe de taille optique (opsz), fixé dans globals.css.
const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-big-shoulders",
  fallback: ["Arial Narrow", "Roboto Condensed", "Helvetica Neue", "Arial", "sans-serif"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Découpe laser Seine-et-Marne (77) — tôlerie sur mesure | ADM Laser",
    template: "%s | ADM Laser",
  },
  description:
    "Découpe laser, pliage et soudure sur mesure à Vaires-sur-Marne (77). Acier, inox, aluminium, de la pièce unique à la série. Votre devis en ligne en 30 secondes.",
  applicationName: site.nom,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: site.nom,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1F2731",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${bigShoulders.variable} ${plex.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenu"
          className="sr-only z-[60] rounded-btn bg-accent px-4 py-2 font-semibold text-blanc focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Aller au contenu
        </a>
        <Header />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <Footer />
        <JsonLd data={localBusiness()} />
      </body>
    </html>
  );
}
