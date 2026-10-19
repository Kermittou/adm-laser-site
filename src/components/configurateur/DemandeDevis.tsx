"use client";

import { useState, type FormEvent } from "react";
import type { Piece } from "@/lib/devis/types";
import { site } from "@/lib/site";
import { IconeCheck } from "../Icones";

/* Formulaire « Demander ce devis » : la configuration part par mail, sans paiement. */

export function DemandeDevis({ piece, onAnnuler }: { piece: Piece; onAnnuler: () => void }) {
  const [etat, setEtat] = useState<{ statut: "repos" | "envoi" | "ok" | "erreur"; message?: string }>({ statut: "repos" });
  const champ =
    "mt-1 w-full rounded-btn border border-blanc/20 bg-steel-night/60 px-3 py-2.5 text-[15px] text-blanc placeholder:text-gris-clair focus:border-accent focus:outline-none";

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEtat({ statut: "envoi" });
    try {
      const res = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          piece,
          contact: {
            nom: f.get("nom"),
            email: f.get("email"),
            telephone: f.get("telephone"),
            message: f.get("message"),
            consentement: f.get("consentement") === "on",
            site_web: f.get("site_web"),
          },
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      setEtat(data.ok ? { statut: "ok" } : { statut: "erreur", message: data.message });
    } catch {
      setEtat({ statut: "erreur", message: `Connexion impossible. Écrivez-nous à ${site.email} ou appelez le ${site.telephone}.` });
    }
  }

  if (etat.statut === "ok") {
    return (
      <div role="status" className="mt-4 rounded-btn-lg border border-blanc/15 bg-blanc/5 p-4">
        <p className="flex items-center gap-2 font-semibold">
          <IconeCheck className="text-accent" /> Demande envoyée.
        </p>
        <p className="mt-1 text-sm text-gris-clair-3">Nous revenons vers vous pour confirmer votre devis — {site.delaiReponse}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="mt-4 space-y-3 rounded-btn-lg border border-blanc/15 bg-blanc/4 p-4">
      <p className="text-sm text-gris-clair-3">Nous recevons votre configuration et ce prix. Laissez-nous de quoi vous répondre :</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-gris-clair-2">
          Nom *
          <input name="nom" required maxLength={120} autoComplete="name" className={champ} />
        </label>
        <label className="block text-sm text-gris-clair-2">
          Téléphone
          <input name="telephone" type="tel" maxLength={40} autoComplete="tel" className={champ} />
        </label>
      </div>
      <label className="block text-sm text-gris-clair-2">
        Adresse mail *
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={champ} />
      </label>
      <label className="block text-sm text-gris-clair-2">
        Précisions (délai, finition, livraison…)
        <textarea name="message" rows={3} maxLength={3000} className={champ} />
      </label>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="site_web" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="flex items-start gap-2.5 text-sm text-gris-clair-2">
        <input name="consentement" type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        <span>
          J&apos;accepte que les données saisies soient stockées et utilisées pour établir le contact. Je peux retirer mon consentement à
          tout moment. *
        </span>
      </label>
      {etat.statut === "erreur" && (
        <p role="alert" className="rounded-btn border border-accent/40 bg-accent/15 px-3 py-2 text-sm text-blanc">
          {etat.message ?? "Une erreur est survenue."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={etat.statut === "envoi"}
          className="cursor-pointer rounded-btn-lg bg-accent px-5 py-3 font-semibold text-blanc transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
        >
          {etat.statut === "envoi" ? "Envoi en cours…" : "Envoyer ma demande"}
        </button>
        <button type="button" onClick={onAnnuler} className="cursor-pointer text-sm text-gris-clair-2 underline underline-offset-4 hover:text-blanc">
          Annuler
        </button>
      </div>
    </form>
  );
}
