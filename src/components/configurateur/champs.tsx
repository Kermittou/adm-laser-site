"use client";

import { useState, type ReactNode } from "react";
import { nb, pas, type Borne } from "@/lib/devis/configurateur";

/* Briques d'interface du configurateur : une étape numérotée, un bouton de choix, un curseur de cote. */

export const optBase = "cursor-pointer rounded-btn border px-3.5 py-2 text-[15px] transition-colors whitespace-nowrap";
export const optInactif = "border-blanc/20 text-gris-clair-3 hover:border-blanc/50 hover:text-blanc";
export const optActif = "border-accent bg-accent text-blanc";

export function Etape({ num, titre, aide, action, children }: { num: string; titre: string; aide?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <legend className="contents">
          <span className="text-[13px] font-semibold tracking-[0.14em] text-accent uppercase">
            {num} — {titre}
          </span>
        </legend>
        {action}
      </div>
      {aide && <p className="-mt-1.5 mb-3 text-sm text-gris-clair">{aide}</p>}
      {children}
    </fieldset>
  );
}

export function Option({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={actif} onClick={onClick} className={`${optBase} ${actif ? optActif : optInactif}`}>
      {children}
    </button>
  );
}

export const ICONES_FORMES: Record<string, string> = {
  rectangle: "M6,5 H34 V25 H6 Z",
  triangle: "M6,5 V25 H34 Z",
  disque: "M10,15 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0 Z",
  rectangle_coupe_coin: "M6,5 H34 V25 H17 V17 H6 Z",
  cadre_coupe_circulaire: "M6,5 H34 V25 H6 Z M14,15 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 Z",
  cadre_coupe_rectangle: "M6,5 H34 V25 H6 Z M14,11 H26 V19 H14 Z",
  demi_disque_allonge: "M8,25 V15 A12,10 0 0,1 32,15 V25 Z",
  trapeze: "M13,5 H27 L34,25 H6 Z",
  personnalisee: "M8,13 h4 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 Z M25,10 h9 v3 h-9 Z M25,17 h9 v3 h-9 Z",
};

/** Une cote : curseur + champ numérique + − / +, bornés par le catalogue et les autres cotes. */
export function Cote({ borne, valeur, onChange }: { borne: Borne; valeur: number; onChange: (v: number) => void }) {
  const [saisie, setSaisie] = useState<string | null>(null);
  const id = `cote-${borne.cle}`;
  const borner = (v: number) => Math.min(borne.maxEffectif, Math.max(borne.minEffectif, v));

  return (
    <div className="rounded-btn-lg border border-blanc/12 bg-blanc/3 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[15px] text-gris-clair-3">
          {borne.label}
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Diminuer ${borne.label}`}
            onClick={() => onChange(borner(valeur - pas(valeur)))}
            className="h-8 w-8 cursor-pointer rounded-btn border border-blanc/20 text-blanc hover:border-blanc/50"
          >
            −
          </button>
          <div className="relative">
            <input
              id={id}
              inputMode="decimal"
              value={saisie ?? nb(valeur)}
              onFocus={(e) => {
                setSaisie(nb(valeur));
                e.currentTarget.select();
              }}
              onChange={(e) => {
                setSaisie(e.target.value);
                const v = Number(e.target.value.replace(/\s/g, "").replace(",", "."));
                if (e.target.value.trim() !== "" && Number.isFinite(v)) onChange(v);
              }}
              onBlur={() => setSaisie(null)}
              className="w-[92px] rounded-btn border border-blanc/20 bg-steel-night/60 py-1.5 pr-9 pl-2.5 text-right text-[15px] text-blanc tabular-nums focus:border-accent focus:outline-none"
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-gris-clair">mm</span>
          </div>
          <button
            type="button"
            aria-label={`Augmenter ${borne.label}`}
            onClick={() => onChange(borner(valeur + pas(valeur)))}
            className="h-8 w-8 cursor-pointer rounded-btn border border-blanc/20 text-blanc hover:border-blanc/50"
          >
            +
          </button>
        </div>
      </div>
      <input
        type="range"
        aria-label={`${borne.label} (curseur)`}
        min={borne.minEffectif}
        max={borne.maxEffectif}
        step={1}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-accent"
      />
      <div className="flex justify-between text-xs text-gris-clair">
        <span>{nb(borne.minEffectif)}</span>
        <span>{nb(borne.maxEffectif)} mm</span>
      </div>
    </div>
  );
}
