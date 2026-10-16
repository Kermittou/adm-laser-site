import type { ReactNode } from "react";
import { Container, SurTitre } from "./ui";

/** Gabarit des pages juridiques : bandeau « en cours de rédaction » toujours visible. */
export function PageJuridique({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <>
      <section className="bg-hero text-blanc">
        <Container className="py-14 md:py-16">
          <SurTitre>Informations juridiques</SurTitre>
          <h1 className="text-[40px] md:text-[54px]">{titre}</h1>
        </Container>
      </section>
      <Container className="py-12 md:py-16">
        <div role="note" className="rounded-card border-2 border-dashed border-or bg-or/15 p-6 md:p-8">
          <p className="font-display text-[26px] font-extrabold text-steel">Texte en cours de rédaction</p>
          <p className="mt-2 max-w-[680px] text-texte">
            Le texte définitif de cette page est en cours de rédaction par notre conseil juridique. Pour toute question, contactez-nous.
          </p>
        </div>
        {children && <div className="mt-10 max-w-[760px]">{children}</div>}
      </Container>
    </>
  );
}
