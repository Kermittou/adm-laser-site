import Link from "next/link";
import { site } from "@/lib/site";
import { Container } from "./ui";
import { Logo, NAV } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-steel-night text-gris-clair-2">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-[300px] text-[15px] leading-relaxed">
            Découpe laser, pliage et soudure sur mesure — acier, inox et aluminium, façonnés dans notre atelier de{" "}
            {site.adresse.ville}.
          </p>
        </div>

        <nav aria-label="Pied de page">
          <h2 className="font-sans text-xs font-semibold tracking-[0.16em] text-gris-clair uppercase">Le site</h2>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            <li>
              <Link href="/devis" className="hover:text-blanc">
                Devis en ligne
              </Link>
            </li>
            {NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-blanc">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.16em] text-gris-clair uppercase">Horaires</h2>
          <dl className="mt-4 space-y-2.5 text-[15px]">
            {site.horaires.map((h) => (
              <div key={h.jours}>
                <dt className="text-blanc">{h.jours}</dt>
                <dd>
                  {h.ouverture.replace(":", " h ")} – {h.fermeture.replace(":", " h ")}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <address className="not-italic">
          <h2 className="font-sans text-xs font-semibold tracking-[0.16em] text-gris-clair uppercase">Atelier</h2>
          <p className="mt-4 text-[15px] leading-relaxed">
            {site.adresse.rue}
            <br />
            {site.adresse.codePostal} {site.adresse.ville}
          </p>
          <p className="mt-3 space-y-1 text-[15px]">
            <a href={`tel:${site.telephoneIntl}`} className="block hover:text-blanc">
              {site.telephone}
            </a>
            <a href={`mailto:${site.email}`} className="block hover:text-blanc">
              {site.email}
            </a>
          </p>
        </address>
      </Container>

      <div className="border-t border-blanc/8">
        <Container className="flex flex-col gap-3 py-6 text-[13px] md:flex-row md:items-center md:justify-between">
          <p>
            {site.nomComplet} · {site.adresse.ville} (77), France · {site.email} · {site.telephone}
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <span>© 2026 {site.nom} — Tous droits réservés.</span>
            <Link href="/mentions-legales" className="hover:text-blanc">
              Mentions légales
            </Link>
            <Link href="/cgv" className="hover:text-blanc">
              CGV
            </Link>
            <Link href="/confidentialite" className="hover:text-blanc">
              Confidentialité
            </Link>
          </p>
        </Container>
      </div>
    </footer>
  );
}
