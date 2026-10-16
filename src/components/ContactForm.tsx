"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { site } from "@/lib/site";
import { SubmitButton } from "./ui";

type Etat = { statut: "repos" | "envoi" | "ok" | "erreur"; message?: string };

const champ =
  "mt-1.5 w-full rounded-btn border border-bordure bg-blanc px-3.5 py-3 text-base text-texte placeholder:text-gris-clair focus:border-steel focus:outline-2 focus:outline-offset-0 focus:outline-steel/20";
const label = "text-[15px] font-medium text-steel";

export function ContactForm() {
  const [etat, setEtat] = useState<Etat>({ statut: "repos" });

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulaire = e.currentTarget;
    setEtat({ statut: "envoi" });
    try {
      const res = await fetch("/api/contact", { method: "POST", body: new FormData(formulaire) });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        formulaire.reset();
        setEtat({ statut: "ok" });
      } else {
        setEtat({ statut: "erreur", message: data.message });
      }
    } catch {
      setEtat({ statut: "erreur", message: `Connexion impossible. Écrivez-nous à ${site.email} ou appelez le ${site.telephone}.` });
    }
  }

  if (etat.statut === "ok") {
    return (
      <div role="status" className="rounded-card border border-bordure bg-surface p-8">
        <p className="font-display text-3xl font-extrabold text-steel">Message envoyé.</p>
        <p className="mt-3 text-texte-doux">Merci — {site.delaiReponse}.</p>
        <button type="button" onClick={() => setEtat({ statut: "repos" })} className="mt-5 cursor-pointer font-semibold text-steel underline underline-offset-4 hover:text-accent">
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Nom *</span>
          <input name="nom" required maxLength={120} autoComplete="name" className={champ} />
        </label>
        <label className="block">
          <span className={label}>Téléphone</span>
          <input name="telephone" type="tel" maxLength={40} autoComplete="tel" className={champ} />
        </label>
      </div>
      <label className="block">
        <span className={label}>Adresse mail *</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={champ} />
      </label>
      <label className="block">
        <span className={label}>Votre besoin *</span>
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={5000}
          rows={6}
          placeholder="Matière, épaisseur, quantité, délai souhaité…"
          className={champ}
        />
      </label>
      <label className="block">
        <span className={label}>Plan (facultatif)</span>
        <input
          name="plan"
          type="file"
          accept=".dxf,.dwg,.pdf,.step,.stp,.png,.jpg,.jpeg"
          className="mt-1.5 block w-full text-[15px] text-texte-doux file:mr-4 file:cursor-pointer file:rounded-btn file:border-0 file:bg-steel file:px-4 file:py-2.5 file:font-semibold file:text-blanc hover:file:bg-steel-deep"
        />
        <span className="mt-1.5 block text-sm text-texte-doux">DXF, DWG, PDF, STEP ou photo — 10 Mo maximum.</span>
      </label>

      {/* Champ piège pour les robots, invisible pour les visiteurs. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input name="site_web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-3 text-[15px] text-texte-doux">
        <input name="consentement" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-accent" />
        <span>
          J&apos;accepte que les données saisies soient stockées et utilisées pour établir le contact. Je peux retirer mon
          consentement à tout moment. Voir la{" "}
          <Link href="/confidentialite" className="underline underline-offset-4 hover:text-steel">
            politique de confidentialité
          </Link>
          . *
        </span>
      </label>

      {etat.statut === "erreur" && (
        <p role="alert" className="rounded-btn border border-accent/30 bg-accent/8 px-4 py-3 text-[15px] text-accent-hover">
          {etat.message ?? "Une erreur est survenue."}
        </p>
      )}

      <SubmitButton type="submit" disabled={etat.statut === "envoi"}>
        {etat.statut === "envoi" ? "Envoi en cours…" : "Envoyer ma demande"}
      </SubmitButton>
      <p className="text-sm text-texte-doux">* Champs obligatoires</p>
    </form>
  );
}
