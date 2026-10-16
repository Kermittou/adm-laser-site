"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { IconeTelephone } from "./Icones";
import { Logo, NAV } from "./Logo";

export function Header() {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => setOuvert(false), [pathname]);

  const actif = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 bg-steel-deep">
      <div className="mx-auto flex h-[72px] w-full max-w-site items-center justify-between gap-6 px-5 md:px-12">
        <Logo />

        <nav aria-label="Navigation principale" className="hidden items-center gap-8 lg:flex">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={actif(l.href) ? "page" : undefined}
              className={`text-[15px] font-medium transition-colors hover:text-blanc ${actif(l.href) ? "text-blanc" : "text-gris-clair-2"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <a href={`tel:${site.telephoneIntl}`} className="flex items-center gap-2 text-[15px] text-gris-clair-2 transition-colors hover:text-blanc">
            <IconeTelephone /> {site.telephone}
          </a>
          <Link href="/devis" className="rounded-btn bg-accent px-4 py-2.5 text-[15px] font-semibold text-blanc transition-colors hover:bg-accent-hover">
            Devis en ligne
          </Link>
        </div>

        <button
          type="button"
          className="-mr-2 flex h-11 w-11 cursor-pointer items-center justify-center text-blanc lg:hidden"
          aria-expanded={ouvert}
          aria-controls="menu-mobile"
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOuvert((o) => !o)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {ouvert ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {ouvert && (
        <nav id="menu-mobile" aria-label="Navigation principale" className="border-t border-blanc/10 bg-steel-deep px-5 pb-6 lg:hidden">
          <ul className="flex flex-col">
            {NAV.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={actif(l.href) ? "page" : undefined}
                  className={`block border-b border-blanc/8 py-3.5 text-[17px] ${actif(l.href) ? "text-blanc" : "text-gris-clair-2"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-3">
            <Link href="/devis" className="rounded-btn-lg bg-accent px-6 py-3.5 text-center font-semibold text-blanc">
              Devis en ligne
            </Link>
            <a href={`tel:${site.telephoneIntl}`} className="flex items-center justify-center gap-2 rounded-btn-lg border border-blanc/35 px-6 py-3.5 font-semibold text-blanc">
              <IconeTelephone /> {site.telephone}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
