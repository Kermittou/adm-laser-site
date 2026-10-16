import type { Metadata } from "next";
import { after } from "next/server";
import { IconeCheck } from "@/components/Icones";
import { Button, Container } from "@/components/ui";
import { eur } from "@/lib/devis/configurateur";
import { site } from "@/lib/site";
import { stripe } from "@/lib/stripe";
import { traiterCommande } from "@/lib/traitement-commande";

export const metadata: Metadata = {
  title: "Commande reçue",
  robots: { index: false, follow: false },
};

export default async function Merci({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const s = stripe();

  let montant: number | null = null;
  let email: string | null = null;
  let valide = false;
  if (s && session_id?.startsWith("cs_")) {
    try {
      const session = await s.checkout.sessions.retrieve(session_id);
      valide = session.status === "complete";
      montant = session.amount_total !== null ? session.amount_total / 100 : null;
      email = session.customer_details?.email ?? null;
      // En développement, Stripe ne peut pas joindre le webhook (localhost) : la commande est
      // traitée ici (Boxtal + mails). Jamais en production, où c'est le rôle du webhook.
      // Sans risque de doublon : traiterCommande ne traite qu'une fois chaque paiement.
      if (valide && process.env.NODE_ENV !== "production") {
        after(() => traiterCommande(s, session).catch((e) => console.error(`[merci] commande ${session.id} :`, e)));
      }
    } catch {
      valide = false;
    }
  }

  return (
    <section className="bg-hero min-h-[calc(100dvh-72px)] text-blanc">
      <Container className="max-w-[760px] py-20 md:py-28">
        {valide ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <IconeCheck width={28} height={28} />
            </span>
            <h1 className="mt-6 text-[40px] md:text-[54px]">Commande reçue, merci.</h1>
            <div className="mt-6 space-y-3 text-lg leading-relaxed text-gris-clair-3">
              {montant !== null && (
                <p>
                  <strong className="text-blanc">{eur(montant)} € TTC</strong> sont bloqués sur votre carte. Ils ne seront débités
                  qu&apos;après validation de votre pièce par notre atelier.
                </p>
              )}
              <p>
                Un récapitulatif part {email ? `à ${email}` : "par mail"}. Si un point doit être précisé, nous vous contactons avant tout
                débit.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[40px] md:text-[54px]">Nous n&apos;avons pas retrouvé cette commande.</h1>
            <p className="mt-6 text-lg text-gris-clair-3">
              Si vous venez de payer, pas d&apos;inquiétude : contactez-nous au {site.telephone} ou à {site.email}, nous vérifions tout de
              suite.
            </p>
          </>
        )}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button href="/devis">Configurer une autre pièce</Button>
          <Button href="/" variante="outline">
            Retour à l&apos;accueil
          </Button>
        </div>
      </Container>
    </section>
  );
}
