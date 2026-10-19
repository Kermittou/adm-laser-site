"use client";

import { useState } from "react";
import { QUESTIONS, recommander, type Reponses } from "@/lib/conseiller";
import { IconeFleche } from "../Icones";
import { optActif, optBase, optInactif } from "./champs";

/* « Quelle matière choisir ? » : les 5 questions, puis le classement des nuances. */

export function ConseillerCompact({ onChoisir, onFermer }: { onChoisir: (matiere: string, nuance: string) => void; onFermer: () => void }) {
  const [rep, setRep] = useState<Reponses>({});
  const complet = QUESTIONS.every((q) => rep[q.cle]);
  const resultat = complet ? recommander(rep) : null;

  return (
    <div className="mt-4 rounded-card border border-blanc/15 bg-steel-deep p-5 shadow-2xl">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-2xl font-extrabold">Répondez à 5 questions, on vous dit quoi prendre</p>
        <button type="button" onClick={onFermer} className="cursor-pointer text-sm text-gris-clair-2 underline underline-offset-4 hover:text-blanc">
          Fermer
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {QUESTIONS.map((q) => (
          <div key={q.cle}>
            <p className="mb-2 text-sm text-gris-clair-2">{q.question}</p>
            <div className="flex flex-wrap gap-1.5">
              {q.reponses.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={rep[q.cle] === v}
                  onClick={() => setRep((r) => ({ ...r, [q.cle]: v }))}
                  className={`cursor-pointer rounded-btn border px-3 py-1.5 text-sm transition-colors ${
                    rep[q.cle] === v ? optActif : optInactif
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {resultat && (
        <div aria-live="polite" className="mt-5 border-t border-blanc/10 pt-4">
          <p className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-accent uppercase">Ce qu&apos;on vous conseille</p>
          {resultat.message && <p className="text-gris-clair-3">{resultat.message}</p>}
          <ol className="space-y-3">
            {resultat.recommandations.map((r) => (
              <li key={`${r.matiere}.${r.nuance}`} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <button type="button" onClick={() => onChoisir(r.matiere, r.nuance)} className={`${optBase} ${optInactif} shrink-0`}>
                  {r.label} <IconeFleche className="ml-1 inline" />
                </button>
                <ul className="space-y-0.5 text-sm">
                  {r.raisons.map((x) => (
                    <li key={x} className="text-gris-clair-3">
                      + {x}
                    </li>
                  ))}
                  {r.reserves.map((x) => (
                    <li key={x} className="text-or">
                      ! {x}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
