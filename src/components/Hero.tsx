import { site } from "@/lib/site";
import { Button, Container, Todo } from "./ui";

function Composition() {
  // Deux plaques d'acier inclinées, un trait laser en diagonale, trois étincelles. CSS pur.
  return (
    <div className="relative mx-auto aspect-[10/9] w-full max-w-[520px]" aria-hidden>
      <div className="plaque plaque-a top-[8%] left-[4%] h-[58%] w-[66%]">
        <span className="percage top-[16%] left-[12%] h-[9%] w-[8%]" />
        <span className="percage top-[16%] right-[12%] h-[9%] w-[8%]" />
        <span className="percage bottom-[16%] left-[12%] h-[9%] w-[8%]" />
        <span className="percage right-[12%] bottom-[16%] h-[9%] w-[8%]" />
        <span className="percage top-[34%] left-[38%] h-[32%] w-[24%]" />
      </div>
      <div className="plaque plaque-b right-[3%] bottom-[6%] h-[50%] w-[58%]">
        <span className="percage top-[22%] left-[14%] h-[18%] w-[30%] rounded-[6px]!" />
        <span className="percage right-[14%] bottom-[22%] h-[14%] w-[12%]" />
      </div>
      <span className="laser top-[50%] left-[-6%] w-[112%]" />
      <span className="etincelle top-[41%] left-[64%]" />
      <span className="etincelle top-[47%] left-[71%] scale-75" />
      <span className="etincelle top-[38%] left-[58%] scale-50" />
    </div>
  );
}

export function Hero() {
  const { avisGoogle } = site;
  return (
    <section className="bg-hero overflow-hidden text-blanc">
      <Container className="grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-5 text-[13px] font-semibold tracking-[0.18em] text-accent">DÉCOUPE · PLIAGE · SOUDURE</p>
          <h1 className="text-[42px] md:text-[54px]">
            Vos pièces métalliques, découpées avec <span className="text-accent">précision</span>.
          </h1>
          <p className="mt-6 max-w-[540px] text-lg leading-relaxed text-gris-clair-3">
            Découpe laser, pliage et soudure sur mesure — acier, inox et aluminium, façonnés dans notre atelier de{" "}
            {site.adresse.ville}.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button href="/devis">Configurer ma pièce</Button>
            <Button href="/contact#formulaire" variante="outline">
              Envoyer un plan (DXF/STEP)
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-gris-clair-2">
            <li>✓ Réponse sous 48 h</li>
            <li>✓ Fichiers {site.formatsFichiers.join(", ")}</li>
            <li>✓ {site.experience}</li>
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-[15px] text-gris-clair-2">
            {avisGoogle.note !== null && (
              <span className="tracking-[0.12em] text-or" aria-hidden>
                ★★★★★
              </span>
            )}
            {avisGoogle.url ? (
              <a href={avisGoogle.url} className="underline-offset-4 hover:text-blanc hover:underline" rel="noopener" target="_blank">
                {avisGoogle.note !== null
                  ? `${avisGoogle.note.toLocaleString("fr-FR", { minimumFractionDigits: 1 })} / 5${avisGoogle.nombre ? ` · ${avisGoogle.nombre} avis` : ""} sur Google`
                  : "Avis clients sur Google"}
              </a>
            ) : (
              <span>Avis clients sur Google</span>
            )}
            {(avisGoogle.url === null || avisGoogle.note === null) && <Todo>lien et note de la fiche Google</Todo>}
          </div>
        </div>

        <Composition />
      </Container>
    </section>
  );
}
