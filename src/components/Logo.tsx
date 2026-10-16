import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";

export const NAV = [
  { href: "/savoir-faire", label: "Savoir-faire" },
  { href: "/matieres", label: "Matières" },
  { href: "/realisations", label: "Réalisations" },
  { href: "/contact", label: "Contact" },
] as const;

export function Logo() {
  // Logo d'adm-laser.fr, détouré (public/images/logo-adm-laser-detoure.png, 449 × 106).
  if (site.logo) {
    return (
      <Link href="/" className="inline-flex shrink-0 items-center" aria-label={`${site.nom} — accueil`}>
        <Image src={site.logo} alt={site.nom} width={449} height={106} priority className="h-8 w-auto md:h-9" />
      </Link>
    );
  }
  return (
    <Link
      href="/"
      className="font-display text-[26px] leading-none font-extrabold tracking-wide text-blanc uppercase"
      aria-label={`${site.nom} — accueil`}
    >
      ADM <span className="text-accent">Laser</span>
    </Link>
  );
}
