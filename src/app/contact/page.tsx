import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { filDAriane, JsonLd } from "@/components/JsonLd";
import { IconeHorloge, IconeLieu, IconeMail, IconeTelephone } from "@/components/Icones";
import { Container, Section, SurTitre } from "@/components/ui";
import { adressePage } from "@/lib/seo";
import { adresseUneLigne, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact et accès — tôlerie à Vaires-sur-Marne",
  description:
    "Envoyez votre plan (DXF, DWG, PDF, STEP) ou décrivez votre pièce de tôlerie : réponse sous 48 h. ADM Laser, 3 Impasse de la Centrale, 77360 Vaires-sur-Marne.",
  ...adressePage("/contact"),
};

export default function Contact() {
  const { lat, lon } = site.geo;
  const d = 0.006;
  const bbox = [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d].map((v) => v.toFixed(6)).join(",");
  const carte = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const itineraire = `https://www.openstreetmap.org/directions?to=${lat},${lon}#map=16/${lat}/${lon}`;
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.nom}, ${adresseUneLigne}`)}`;

  return (
    <>
      <JsonLd data={filDAriane("Contact", "/contact")} />
      <section className="bg-hero text-blanc">
        <Container className="py-16 md:py-20">
          <SurTitre>Contact</SurTitre>
          <h1 className="max-w-[820px] text-[40px] md:text-[54px]">Un plan à chiffrer ? Écrivez-nous.</h1>
          <p className="mt-6 max-w-[640px] text-lg leading-relaxed text-gris-clair-3">
            Envoyez votre plan ({site.formatsFichiers.join(", ")}) ou décrivez votre pièce — {site.delaiReponse}.
          </p>
        </Container>
      </section>

      <Section id="formulaire" aria-labelledby="t-formulaire">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 id="t-formulaire" className="text-[34px] text-steel md:text-[40px]">
              Votre demande
            </h2>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-card bg-steel-deep p-7 text-blanc">
              <h2 className="text-[30px]">Nos coordonnées</h2>
              <address className="mt-5 space-y-4 text-[15px] not-italic text-gris-clair-3">
                <p className="flex gap-3">
                  <IconeLieu className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    {site.nom}
                    <br />
                    {site.adresse.rue}
                    <br />
                    {site.adresse.codePostal} {site.adresse.ville}
                  </span>
                </p>
                <p>
                  <a href={`tel:${site.telephoneIntl}`} className="flex gap-3 hover:text-blanc">
                    <IconeTelephone className="mt-0.5 shrink-0 text-accent" /> {site.telephone}
                  </a>
                </p>
                <p>
                  <a href={`mailto:${site.email}`} className="flex gap-3 hover:text-blanc">
                    <IconeMail className="mt-0.5 shrink-0 text-accent" /> {site.email}
                  </a>
                </p>
              </address>
              <div className="mt-6 border-t border-blanc/10 pt-5">
                <p className="flex items-center gap-3 font-semibold">
                  <IconeHorloge className="text-accent" /> Horaires d&apos;ouverture
                </p>
                <dl className="mt-3 space-y-1.5 text-[15px] text-gris-clair-3">
                  {site.horaires.map((h) => (
                    <div key={h.jours} className="flex justify-between gap-4">
                      <dt>{h.jours}</dt>
                      <dd>
                        {h.ouverture.replace(":", " h ")} – {h.fermeture.replace(":", " h ")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </Section>

      <Section id="acces" ton="surface" aria-labelledby="t-acces">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="t-acces" className="text-[34px] text-steel md:text-[44px]">
              Plan d&apos;accès
            </h2>
            <p className="mt-3 text-[17px] text-texte-doux">
              {adresseUneLigne} — ZAC du Gué de Launay, {site.adresse.departement}.
            </p>
          </div>
          <p className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-semibold">
            <a href={itineraire} target="_blank" rel="noopener" className="text-steel underline underline-offset-4 hover:text-accent">
              Itinéraire (OpenStreetMap)
            </a>
            <a href={googleMaps} target="_blank" rel="noopener" className="text-steel underline underline-offset-4 hover:text-accent">
              Ouvrir dans Google Maps
            </a>
          </p>
        </div>
        <div className="mt-8 overflow-hidden rounded-card border border-bordure bg-blanc">
          <iframe
            title={`Plan d'accès : ${site.nom}, ${adresseUneLigne}`}
            src={carte}
            loading="lazy"
            className="block h-[380px] w-full md:h-[440px]"
          />
        </div>
      </Section>
    </>
  );
}
