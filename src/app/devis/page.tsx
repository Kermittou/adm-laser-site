import type { Metadata } from "next";
import { filDAriane, JsonLd } from "@/components/JsonLd";
import { Configurateur } from "@/components/Configurateur";
import { Container } from "@/components/ui";
import { adressePage } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Devis découpe laser en ligne — prix immédiat",
  description:
    "Matière, épaisseur, forme, cotes, quantité : le prix HT de votre pièce découpée au laser s'affiche immédiatement. Acier, inox et aluminium sur mesure.",
  ...adressePage("/devis"),
};

export default async function Devis({ searchParams }: { searchParams: Promise<{ matiere?: string; nuance?: string }> }) {
  const { matiere, nuance } = await searchParams;

  return (
    <>
      <JsonLd data={filDAriane("Devis en ligne", "/devis")} />
      <section className="bg-hero min-h-[calc(100dvh-72px)] text-blanc">
      <Container className="max-w-[1320px] py-10 md:py-14">
        <p className="mb-3 text-[13px] font-semibold tracking-[0.18em] text-accent uppercase">Devis en ligne</p>
        <h1 className="text-[34px] md:text-[44px]">Votre devis de découpe laser, en 30 secondes</h1>
        <p className="mt-3 mb-10 max-w-[680px] text-[17px] text-gris-clair-3">
          Choisissez la matière, l&apos;épaisseur, la forme et les dimensions : le prix s&apos;affiche instantanément, sans attendre un
          commercial.
        </p>
        <Configurateur initial={{ matiere, nuance }} />
      </Container>
      </section>
    </>
  );
}
