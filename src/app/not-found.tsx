import { Button, Container, SurTitre } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="bg-hero text-blanc">
      <Container className="py-24 md:py-32">
        <SurTitre>Erreur 404</SurTitre>
        <h1 className="text-[40px] md:text-[54px]">Cette page n&apos;existe pas.</h1>
        <p className="mt-5 max-w-[560px] text-lg text-gris-clair-3">Elle a peut-être été déplacée. Repartez de l&apos;accueil ou chiffrez directement votre pièce.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button href="/">Retour à l&apos;accueil</Button>
          <Button href="/devis" variante="outline">
            Devis en ligne
          </Button>
        </div>
      </Container>
    </section>
  );
}
