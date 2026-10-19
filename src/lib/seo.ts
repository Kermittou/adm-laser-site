import type { Metadata } from "next";

/**
 * Métadonnées d'adressage d'une page : l'URL canonique et l'`og:url` du partage.
 *
 * Les deux doivent toujours désigner la même adresse. Les écrire séparément dans chaque page,
 * c'est se garantir qu'un jour l'une des deux sera oubliée ou se mettra à pointer ailleurs.
 * `metadataBase` (layout.tsx) les transforme en URL absolues.
 */
export function adressePage(chemin: string): Pick<Metadata, "alternates" | "openGraph"> {
  return { alternates: { canonical: chemin }, openGraph: { url: chemin } };
}
