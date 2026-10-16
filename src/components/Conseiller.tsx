"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QUESTIONS, recommander, type Reponses } from "@/lib/conseiller";
import { listeEpaisseurs } from "@/lib/devis/catalogue";
import { IconeCheck, IconeFleche } from "./Icones";

/** Questionnaire « Quelle matière choisir ? » — 5 questions, un classement argumenté. */
export function Conseiller() {
  const [reponses, setReponses] = useState<Reponses>({});
  const nbRepondues = QUESTIONS.filter((q) => reponses[q.cle]).length;
  const complet = nbRepondues === QUESTIONS.length;
  const resultat = complet ? recommander(reponses) : null;
  const panneau = useRef<HTMLDivElement>(null);

  // Sur mobile, le classement s'affiche sous les questions : on l'amène à l'écran.
  useEffect(() => {
    const el = panneau.current;
    if (!complet || !el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top > window.innerHeight * 0.6 || bottom < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [complet]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <ol className="space-y-6">
        {QUESTIONS.map((q, i) => (
          <li key={q.cle}>
            <fieldset>
              <legend className="mb-3 flex items-baseline gap-3 font-semibold text-steel">
                <span className="font-display text-xl font-extrabold text-accent">{String(i + 1).padStart(2, "0")}</span>
                {q.question}
              </legend>
              <div className="flex flex-wrap gap-2">
                {q.reponses.map(([valeur, libelle]) => {
                  const actif = reponses[q.cle] === valeur;
                  return (
                    <button
                      key={valeur}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => setReponses((r) => ({ ...r, [q.cle]: valeur }))}
                      className={`cursor-pointer rounded-btn border px-3.5 py-2 text-[15px] transition-colors ${
                        actif ? "border-accent bg-accent text-blanc" : "border-bordure bg-blanc text-texte hover:border-steel"
                      }`}
                    >
                      {libelle}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div ref={panneau} aria-live="polite" className="scroll-mt-[88px] rounded-card bg-steel-deep p-6 text-blanc md:p-8 lg:sticky lg:top-[96px] lg:self-start">
        {!resultat && (
          <div>
            <p className="font-display text-[28px] leading-tight font-extrabold">Votre classement</p>
            <p className="mt-3 text-gris-clair-2">
              Répondez aux {QUESTIONS.length} questions : nous classons les nuances du catalogue, avec pour chacune ce qui joue pour elle
              et ce qui mérite attention.
            </p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-blanc/10" aria-hidden>
              <div className="h-full bg-accent transition-[width]" style={{ width: `${(nbRepondues / QUESTIONS.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-gris-clair">
              {nbRepondues} / {QUESTIONS.length} réponses
            </p>
          </div>
        )}

        {resultat && (
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-display text-[28px] leading-tight font-extrabold">Nos recommandations</p>
              <button type="button" onClick={() => setReponses({})} className="cursor-pointer text-sm text-gris-clair-2 underline underline-offset-4 hover:text-blanc">
                Recommencer
              </button>
            </div>

            {resultat.message && (
              <p className="mt-4 text-gris-clair-3">
                {resultat.message}{" "}
                <Link href="/contact#formulaire" className="font-semibold text-blanc underline underline-offset-4">
                  Nous écrire
                </Link>
              </p>
            )}

            <ol className="mt-5 space-y-4">
              {resultat.recommandations.map((r, i) => (
                <li key={`${r.matiere}.${r.nuance}`} className="rounded-btn-lg border border-blanc/12 bg-blanc/4 p-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-xl font-extrabold text-accent">{i + 1}.</span>
                    <p className="font-display text-2xl font-extrabold">{r.label}</p>
                  </div>
                  <p className="mt-1 text-sm text-gris-clair">Épaisseurs : {listeEpaisseurs(r.epaisseurs)}</p>
                  <ul className="mt-3 space-y-1 text-[15px]">
                    {r.raisons.map((x) => (
                      <li key={x} className="flex gap-2 text-gris-clair-3">
                        <IconeCheck className="mt-1 shrink-0 text-blanc" /> {x}
                      </li>
                    ))}
                    {r.reserves.map((x) => (
                      <li key={x} className="flex gap-2 text-or">
                        <span aria-hidden className="w-4 shrink-0 text-center font-bold">!</span>
                        <span>
                          <span className="sr-only">Réserve : </span>
                          {x}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/devis?matiere=${r.matiere}&nuance=${r.nuance}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-blanc hover:text-or"
                  >
                    Chiffrer en {r.label.toLowerCase()} <IconeFleche />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
