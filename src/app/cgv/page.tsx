import type { Metadata } from "next";
import { PageJuridique } from "@/components/Juridique";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  alternates: { canonical: "/cgv" },
  // Placeholder : pas d'indexation tant que le texte définitif n'est pas en ligne.
  robots: { index: false, follow: true },
};

export default function Cgv() {
  return <PageJuridique titre="Conditions générales de vente" />;
}
