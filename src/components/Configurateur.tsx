"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { construireCommande, etapesLivraison, expedition, GRILLE, type EtapesLivraison, type Envoi, type OffreEnvoi } from "@/lib/commande";
import { QUESTIONS, recommander, type Reponses } from "@/lib/conseiller";
import { catalogue, mm } from "@/lib/devis/catalogue";
import { bornes, dimensionsEffectives, dimensionsParDefaut, epaisseurProche, eur, nb, pas, type Borne } from "@/lib/devis/configurateur";
import { devis, PALIERS, tarifs } from "@/lib/devis/moteur";
import type { Piece } from "@/lib/devis/types";
import { adresseUneLigne, site } from "@/lib/site";
import { DessinTechnique } from "./DessinTechnique";
import { IconeCheck, IconeFleche } from "./Icones";
import { Todo } from "./ui";

/* ================================================================== petits éléments */

const optBase = "cursor-pointer rounded-btn border px-3.5 py-2 text-[15px] transition-colors whitespace-nowrap";
const optInactif = "border-blanc/20 text-gris-clair-3 hover:border-blanc/50 hover:text-blanc";
const optActif = "border-accent bg-accent text-blanc";

function Etape({ num, titre, aide, action, children }: { num: string; titre: string; aide?: string; action?: ReactNode; children: ReactNode }) {
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

function Option({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={actif} onClick={onClick} className={`${optBase} ${actif ? optActif : optInactif}`}>
      {children}
    </button>
  );
}

const ICONES_FORMES: Record<string, string> = {
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
function Cote({ borne, valeur, onChange }: { borne: Borne; valeur: number; onChange: (v: number) => void }) {
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

/* ================================================================== conseiller compact */

function ConseillerCompact({ onChoisir, onFermer }: { onChoisir: (matiere: string, nuance: string) => void; onFermer: () => void }) {
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

/* ================================================================== demande de devis */

function DemandeDevis({ piece, onAnnuler }: { piece: Piece; onAnnuler: () => void }) {
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

/* ================================================================== commande en ligne */

/**
 * Récapitulatif avant paiement, en deux temps :
 *   1. retrait gratuit à l'atelier, ou
 *   2. livraison → choix du délai (2 ou 7 jours) ; le supplément du délai s'ajoute aux frais de port.
 * Les montants sont recalculés par le serveur avant de créer la session Stripe : le navigateur
 * n'envoie que la configuration et l'option choisie.
 */
function Commander({ piece, onAnnuler, onDevis }: { piece: Piece; onAnnuler: () => void; onDevis: () => void }) {
  const [cgv, setCgv] = useState(false);
  const [choix, setChoix] = useState<"" | "retrait" | "livraison">("");
  const [delai, setDelai] = useState("");
  const [envoi, setEnvoi] = useState<"" | Envoi>("");
  const [etat, setEtat] = useState<{ statut: "repos" | "envoi" | "erreur"; message?: string }>({ statut: "repos" });

  const r = devis(piece);
  const exp = r.ok ? expedition(r) : null;
  const optionRetrait = exp?.options.find((o) => o.retrait);
  const delais = exp?.options.filter((o) => !o.retrait) ?? [];
  const envois = exp?.envois ?? [];
  const livraisonPossible = delais.length > 0 && envois.length > 0;
  // 2.1 : un seul envoi possible → pris d'office ; colis ET palette → au client de choisir.
  const envoiChoisi: Envoi | "" = envois.length === 1 ? envois[0].type : envois.some((e) => e.type === envoi) ? envoi : "";
  const cleLivraison =
    choix === "retrait"
      ? (optionRetrait?.cle ?? "")
      : choix === "livraison" && envoiChoisi && delais.some((o) => o.cle === delai)
        ? delai
        : "";
  const commande = cleLivraison ? construireCommande(piece, cleLivraison, choix === "livraison" ? envoiChoisi : undefined) : null;
  const ok = commande?.ok ? commande : null;

  async function payer() {
    setEtat({ statut: "envoi" });
    try {
      const res = await fetch("/api/commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ piece, livraison: cleLivraison, envoi: choix === "livraison" ? envoiChoisi : "", cgv }),
      });
      const data = (await res.json()) as { ok: boolean; url?: string; message?: string };
      if (data.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setEtat({ statut: "erreur", message: data.message });
    } catch {
      setEtat({ statut: "erreur", message: `Connexion impossible. Écrivez-nous à ${site.email} ou appelez le ${site.telephone}.` });
    }
  }

  if (!r.ok || !exp) {
    return (
      <div role="alert" className="mt-4 rounded-btn-lg border border-accent/50 bg-accent/10 p-4 text-blanc">
        {r.ok ? "Cette commande ne peut pas être payée en ligne." : r.message}
      </div>
    );
  }

  const horaires = site.horaires.map((h) => `${h.jours.replace(" – ", "-")} ${h.ouverture.replace(":", "h")}–${h.fermeture.replace(":", "h")}`).join(" · ");
  // Frais de livraison (envoi) : identiques quel que soit le délai ; le délai s'y ajoute.
  const offreChoisie = envois.find((e) => e.type === envoiChoisi) ?? null;
  const fraisLivraison = (offreChoisie ?? envois[0])?.prix_ht ?? null;
  const libelleEnvoi = (e: OffreEnvoi) => (e.type === "palette" ? "Sur palette" : `En ${e.libelle}`);
  const carte = (actif: boolean) =>
    `flex cursor-pointer items-center justify-between gap-3 rounded-btn border px-3 py-2.5 transition-colors ${
      actif ? "border-accent bg-blanc/8" : "border-blanc/15 hover:border-blanc/40"
    }`;

  return (
    <div className="mt-4 space-y-4 rounded-btn-lg border border-blanc/15 bg-blanc/4 p-4">
      <fieldset>
        <legend className="mb-2 text-xs tracking-[0.1em] text-gris-clair uppercase">Retrait ou livraison</legend>
        <div className="grid gap-2">
          {/* 1. Retrait à l'atelier */}
          {optionRetrait && (
            <label className={carte(choix === "retrait")}>
              <span className="flex items-center gap-2.5">
                <input type="radio" name="mode-livraison" checked={choix === "retrait"} onChange={() => setChoix("retrait")} className="h-4 w-4 shrink-0 accent-accent" />
                <span className="flex flex-col">
                  <span className="text-[15px]">1. {optionRetrait.libelle}</span>
                  <span className="text-xs text-gris-clair">
                    {adresseUneLigne} · {horaires}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold">Gratuit</span>
            </label>
          )}

          {/* 2. Livraison */}
          {livraisonPossible ? (
            <label className={carte(choix === "livraison")}>
              <span className="flex items-center gap-2.5">
                <input type="radio" name="mode-livraison" checked={choix === "livraison"} onChange={() => setChoix("livraison")} className="h-4 w-4 shrink-0 accent-accent" />
                <span className="flex flex-col">
                  <span className="text-[15px]">2. Livraison</span>
                  <span className="text-xs text-gris-clair">
                    France métropolitaine continentale (hors {GRILLE.hors_zone.join(" et ")}) · {nb(exp.poids_facture_kg)} kg emballés
                  </span>
                </span>
              </span>
              {fraisLivraison !== null && (
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold tabular-nums">
                    {!offreChoisie && envois.length > 1 ? "dès " : ""}
                    {eur(fraisLivraison * (1 + tarifs.tva_taux))} € TTC
                  </span>
                  <span className="text-xs text-gris-clair">frais de livraison</span>
                </span>
              )}
            </label>
          ) : (
            <div aria-disabled="true" className="flex items-center justify-between gap-3 rounded-btn border border-dashed border-blanc/15 px-3 py-2.5 text-gris-clair">
              <span className="flex items-center gap-2.5">
                <input type="radio" disabled aria-label="Livraison : indisponible" className="h-4 w-4 shrink-0" />
                <span className="flex flex-col">
                  <span className="text-[15px] line-through decoration-blanc/30">2. Livraison</span>
                  <span className="text-xs">Indisponible — {raisonCourte(exp.raison)}</span>
                </span>
              </span>
              <button type="button" onClick={onDevis} className="shrink-0 cursor-pointer text-sm font-semibold text-blanc underline underline-offset-4 hover:text-accent">
                Devis de livraison
              </button>
            </div>
          )}
        </div>
      </fieldset>

      {/* 2.1 Envoi : en colis ou sur palette — TOUJOURS visible ; le choix n'est proposé que si les deux sont possibles */}
      {livraisonPossible && (
        <fieldset className={`ml-4 border-l border-blanc/15 pl-4 ${choix === "retrait" ? "opacity-60" : ""}`}>
          <legend className="mb-2 text-xs tracking-[0.1em] text-gris-clair uppercase">
            2.1 Envoi{envois.length > 1 ? " : en colis ou sur palette" : ""}
          </legend>
          <div className="grid gap-2">
            {envois.map((e) => {
              const actif = choix === "livraison" && envoiChoisi === e.type;
              const contenu = (
                <>
                  <span className="flex flex-col">
                    <span className="text-[15px]">{libelleEnvoi(e)}</span>
                    <span className="text-xs text-gris-clair">{e.transporteur}</span>
                  </span>
                </>
              );
              const prixEnvoi = <span className="shrink-0 text-sm font-semibold tabular-nums">{eur(e.prix_ht * (1 + tarifs.tva_taux))} € TTC</span>;
              return envois.length > 1 ? (
                <label key={e.type} className={carte(actif)}>
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="envoi"
                      checked={actif}
                      onChange={() => {
                        setChoix("livraison");
                        setEnvoi(e.type);
                      }}
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                    {contenu}
                  </span>
                  {prixEnvoi}
                </label>
              ) : (
                <div key={e.type} className="flex items-center justify-between gap-3 rounded-btn border border-blanc/10 px-3 py-2.5">
                  {contenu}
                  {prixEnvoi}
                </div>
              );
            })}
          </div>
          {exp.raison && <p className="mt-2 text-sm text-gris-clair-3">{exp.raison}</p>}
          {envoiChoisi === "colis" && exp.colis.length > 1 && (
            <p className="mt-2 text-sm text-gris-clair-3">
              Votre commande part en {exp.colis.length} colis de {nb(GRILLE.limite_colis.poids_kg)} kg maximum, expédiés séparément, chacun avec son suivi.
            </p>
          )}
        </fieldset>
      )}

      {/* 2.2 Délai d'expédition — TOUJOURS visible (structure validée par ADM) ; le choisir sélectionne la livraison */}
      {livraisonPossible && (
        <fieldset className={`ml-4 border-l border-blanc/15 pl-4 ${choix === "retrait" ? "opacity-60" : ""}`}>
          <legend className="mb-2 text-xs tracking-[0.1em] text-gris-clair uppercase">2.2 Choix du délai : expédition en 2 jours ou en 7 jours</legend>
          <div className="grid gap-2">
            {delais.map((o) => {
              const c = construireCommande(piece, o.cle);
              const actif = choix === "livraison" && delai === o.cle;
              return (
                <label key={o.cle} className={carte(actif)}>
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="delai"
                      checked={actif}
                      onChange={() => {
                        setChoix("livraison");
                        setDelai(o.cle);
                      }}
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                    <span className="text-[15px]">{o.libelle}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {!c.ok ? "—" : c.livraison.supplement_ht === 0 ? "+ 0 €" : `+ ${eur(c.livraison.supplement_ht * (1 + tarifs.tva_taux))} € TTC`}
                  </span>
                </label>
              );
            })}
          </div>
          {/* 2.3 Le prix du délai s'ajoute aux frais de livraison */}
          <p className="mt-2 text-sm text-gris-clair-2">
            2.3 Le prix du délai s&apos;ajoute aux frais de livraison
            {ok && !ok.livraison.retrait && fraisLivraison !== null
              ? ` : ${eur(ok.livraison.port_ht * (1 + tarifs.tva_taux))} € + ${eur(ok.livraison.supplement_ht * (1 + tarifs.tva_taux))} € = ${eur(ok.livraison.prix_ttc)} € TTC.`
              : "."}
          </p>
        </fieldset>
      )}

      {!commande && (
        <p className="text-sm text-gris-clair-2">
          {choix !== "livraison"
            ? "Choisissez le retrait à l'atelier ou la livraison pour voir le total."
            : !envoiChoisi
              ? "Choisissez l'envoi en colis ou sur palette, puis le délai, pour voir le total."
              : "Choisissez le délai d'expédition pour voir le total."}
        </p>
      )}
      {commande && !commande.ok && (
        <p role="alert" className="rounded-btn border border-accent/40 bg-accent/15 px-3 py-2 text-sm text-blanc">
          {commande.message}
        </p>
      )}

      {ok && (
        <dl className="space-y-1.5 text-[15px]">
          <div className="flex justify-between gap-4">
            <dt className="text-gris-clair-2">
              {piece.quantite} {piece.quantite > 1 ? "pièces" : "pièce"}
            </dt>
            <dd className="tabular-nums">{eur(ok.resultat.total_ttc)} € TTC</dd>
          </div>
          {ok.livraison.retrait || ok.livraison.offerte ? (
            <div className="flex justify-between gap-4">
              <dt className="text-gris-clair-2">
                {ok.livraison.libelle}
                {ok.livraison.offerte && ` — livraison offerte (${exp.colis.length} colis)`}
              </dt>
              <dd>gratuit</dd>
            </div>
          ) : (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-gris-clair-2">
                  Frais de livraison — {ok.livraison.envoi?.type === "palette" ? "sur palette" : `${exp.colis.length} colis`}
                </dt>
                <dd className="shrink-0 tabular-nums">{eur(ok.livraison.port_ht * (1 + tarifs.tva_taux))} € TTC</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gris-clair-2">Délai — {ok.livraison.libelle.toLowerCase()}</dt>
                <dd className="shrink-0 tabular-nums">
                  {ok.livraison.supplement_ht === 0 ? "+ 0 €" : `+ ${eur(ok.livraison.supplement_ht * (1 + tarifs.tva_taux))} € TTC`}
                </dd>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-blanc/10 pt-2">
            <dt className="font-semibold">À régler</dt>
            <dd className="font-display text-3xl font-extrabold text-accent tabular-nums">{eur(ok.total_ttc)} €</dd>
          </div>
          <p className="text-right text-sm text-gris-clair">soit {eur(ok.total_ht)} € HT</p>
        </dl>
      )}

      <ul className="space-y-1.5 text-sm text-gris-clair-3">
        <li className="flex gap-2">
          <IconeCheck className="mt-0.5 shrink-0 text-accent" />
          Le montant est bloqué sur votre carte, puis débité seulement après validation de votre pièce par l&apos;atelier.
        </li>
        <li className="flex gap-2">
          <IconeCheck className="mt-0.5 shrink-0 text-accent" />
          {choix === "retrait"
            ? "Paiement sécurisé par Stripe. Nous vous prévenons dès que votre commande est prête à retirer."
            : "Paiement sécurisé par Stripe. Vous saisirez vos adresses de facturation et de livraison à l'étape suivante."}
        </li>
      </ul>

      <p>
        <Todo>mentions de vente à distance (pièces sur mesure, rétractation) à valider par le juriste</Todo>
      </p>

      <label className="flex items-start gap-2.5 text-sm text-gris-clair-2">
        <input type="checkbox" checked={cgv} onChange={(e) => setCgv(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        <span>
          J&apos;accepte les{" "}
          <Link href="/cgv" target="_blank" className="text-blanc underline underline-offset-4">
            conditions générales de vente
          </Link>
          . *
        </span>
      </label>

      {etat.statut === "erreur" && (
        <p role="alert" className="rounded-btn border border-accent/40 bg-accent/15 px-3 py-2 text-sm text-blanc">
          {etat.message ?? "Une erreur est survenue."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={payer}
          disabled={!ok || !cgv || etat.statut === "envoi"}
          className="cursor-pointer rounded-btn-lg bg-accent px-5 py-3 font-semibold text-blanc transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {etat.statut === "envoi" ? "Redirection vers le paiement…" : ok ? `Payer ${eur(ok.total_ttc)} € TTC` : "Payer"}
        </button>
        <button type="button" onClick={onAnnuler} className="cursor-pointer text-sm text-gris-clair-2 underline underline-offset-4 hover:text-blanc">
          Annuler
        </button>
      </div>
    </div>
  );
}

/**
 * Récapitulatif sous le prix. Structure VALIDÉE PAR ADM — ne pas la modifier :
 *   1. Retrait à l'atelier — gratuit
 *   2. Livraison — frais de livraison
 *      2.2 choix entre expédition en 2 jours et en 7 jours
 *      2.3 le prix du délai s'ajoute aux frais de livraison
 */
function EtapesLivraisonPrix({ etapes, montant }: { etapes: EtapesLivraison; montant: (ht: number) => string }) {
  const { retrait, livraison } = etapes;
  const plus = (ht: number | null) => (ht === null ? "—" : ht === 0 ? "+ 0 €" : `+ ${montant(ht)}`);
  const plusieurs = livraison.envois.length > 1;
  const nomEnvoi = (type: Envoi) => (type === "palette" ? "palette" : (livraison.envois.find((e) => e.type === "colis")?.libelle ?? "colis"));
  return (
    <dl className="mt-3 space-y-1 rounded-btn border border-blanc/10 bg-blanc/4 px-3 py-2.5 text-sm">
      {retrait && (
        <div className="flex justify-between gap-3">
          <dt className="text-gris-clair-2">1. {retrait.libelle}</dt>
          <dd className="shrink-0">gratuit</dd>
        </div>
      )}
      <div className="flex justify-between gap-3">
        <dt className={livraison.disponible ? "text-gris-clair-2" : "text-gris-clair"}>
          2. Livraison{livraison.disponible ? " — frais de livraison" : ` — ${raisonCourte(livraison.raison)}`}
        </dt>
        {!livraison.disponible && <dd className="shrink-0">sur devis</dd>}
      </div>
      {livraison.disponible && (
        <>
          <p className="pt-1 pl-4 text-xs tracking-[0.08em] text-gris-clair uppercase">2.1 Envoi{plusieurs ? " : en colis ou sur palette" : ""}</p>
          {livraison.envois.map((e) => (
            <div key={e.type} className="flex justify-between gap-3 pl-4">
              <dt className="text-gris-clair-2">{e.type === "palette" ? "Sur palette" : `En ${e.libelle}`}</dt>
              <dd className="shrink-0 tabular-nums">{montant(e.prix_ht)}</dd>
            </div>
          ))}
          <p className="pt-1 pl-4 text-xs tracking-[0.08em] text-gris-clair uppercase">2.2 Choix entre expédition en 2 jours et en 7 jours</p>
          {livraison.delais.map((d) => (
            <div key={d.cle} className="flex justify-between gap-3 pl-4">
              <dt className="text-gris-clair-2">{d.libelle}</dt>
              <dd className="shrink-0 tabular-nums">{plus(d.supplement_ht)}</dd>
            </div>
          ))}
          <p className="pt-1 pl-4 text-xs tracking-[0.08em] text-gris-clair uppercase">2.3 Ce prix s&apos;ajoute aux frais de livraison</p>
          {livraison.delais.map((d) => (
            <div key={d.cle} className="flex justify-between gap-3 pl-4">
              <dt className="text-gris-clair">Livraison {d.libelle.toLowerCase()}</dt>
              <dd className="shrink-0 text-right tabular-nums">
                {livraison.envois.map((e) => `${plusieurs ? `${nomEnvoi(e.type)} ` : ""}${montant(d.totaux[e.type] ?? 0)}`).join(" · ")}
              </dd>
            </div>
          ))}
        </>
      )}
    </dl>
  );
}

/** « Livraison sur devis : pièce de 1,3 m (envoi en colis jusqu'à 1 m). » → « pièce de 1,3 m (envoi en colis jusqu'à 1 m) » */
function raisonCourte(raison: string | null): string {
  return (raison ?? "sur devis").replace(/^Livraison sur devis\s*:\s*/, "").replace(/\.$/, "");
}

/* ================================================================== configurateur */

const MATIERES = Object.keys(catalogue.matieres);
const FORMES = Object.keys(catalogue.formes);
const TVA = tarifs.tva_taux;

export function Configurateur({ initial }: { initial?: { matiere?: string; nuance?: string } }) {
  const matiereInit = initial?.matiere && catalogue.matieres[initial.matiere] ? initial.matiere : "acier";
  const nuancesInit = catalogue.matieres[matiereInit].nuances;
  const nuanceInit = initial?.nuance && nuancesInit[initial.nuance] ? initial.nuance : (Object.keys(nuancesInit)[0] ?? "");

  const [matiere, setMatiere] = useState(matiereInit);
  const [nuance, setNuance] = useState(nuanceInit);
  const [epaisseurVoulue, setEpaisseur] = useState(3);
  const [forme, setForme] = useState("rectangle");
  const [cotes, setCotes] = useState<Record<string, Record<string, number>>>({});
  const [quantite, setQuantite] = useState(10);
  const [ttc, setTtc] = useState(false);
  const [conseil, setConseil] = useState(false);
  const [mode, setMode] = useState<null | "devis" | "commande">(null);

  // --- cascade : seules les nuances et épaisseurs qui existent sont proposées
  const m = catalogue.matieres[matiere];
  const nuances = Object.entries(m.nuances);
  const n = m.nuances[nuance] ?? nuances[0]?.[1];
  const cleNuance = m.nuances[nuance] ? nuance : (nuances[0]?.[0] ?? "");
  const epaisseurs = n?.epaisseurs ?? [];
  const epaisseur = epaisseurs.includes(epaisseurVoulue) ? epaisseurVoulue : epaisseurs.length ? epaisseurProche(epaisseurs, epaisseurVoulue) : epaisseurVoulue;

  const formeDef = catalogue.formes[forme];
  const surContact = Boolean(formeDef.editeur_en_ligne);
  const dims = dimensionsEffectives(forme, cotes[forme] ?? dimensionsParDefaut(forme), epaisseur);
  const lesBornes = bornes(forme, dims, epaisseur);

  const piece: Piece = { matiere, nuance: cleNuance, epaisseur_mm: epaisseur, forme, dimensions: dims, quantite };
  const chiffrable = m.devis_automatique && !surContact;

  // Le moteur tourne dans le navigateur : 7 calculs par changement, instantanés.
  const resultat = chiffrable ? devis(piece) : null;
  const paliers = chiffrable ? PALIERS.map((q) => ({ q, r: devis({ ...piece, quantite: q }) })) : [];

  const prix = (ht: number) => (ttc ? ht * (1 + TVA) : ht);
  const suffixe = ttc ? "TTC" : "HT";

  function choisirMatiere(k: string) {
    setMatiere(k);
    setNuance(Object.keys(catalogue.matieres[k].nuances)[0] ?? "");
    setMode(null);
  }
  function choisirCote(cle: string, v: number) {
    setCotes((c) => ({ ...c, [forme]: { ...dims, [cle]: v } }));
  }

  /* ---------------------------------------------------------------- colonne formulaire */
  const formulaire = (
    <div className="flex min-w-0 flex-col gap-8">
      <Etape
        num="01"
        titre="Matière"
        action={
          <button
            type="button"
            onClick={() => setConseil((c) => !c)}
            aria-expanded={conseil}
            className="cursor-pointer rounded-btn border border-dashed border-blanc/35 px-3 py-1.5 text-sm text-gris-clair-3 hover:border-blanc hover:text-blanc"
          >
            {conseil ? "Fermer le conseiller" : "Quelle matière choisir ?"}
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {MATIERES.map((k) => (
            <Option key={k} actif={k === matiere} onClick={() => choisirMatiere(k)}>
              {catalogue.matieres[k].label}
            </Option>
          ))}
        </div>
        {conseil && (
          <ConseillerCompact
            onFermer={() => setConseil(false)}
            onChoisir={(mk, nk) => {
              setMatiere(mk);
              setNuance(nk);
              setConseil(false);
            }}
          />
        )}
      </Etape>

      {m.devis_automatique ? (
        <>
          <Etape num="02" titre="Nuance / finition">
            <div className="flex flex-wrap gap-2">
              {nuances.map(([k, v]) => (
                <Option key={k} actif={k === cleNuance} onClick={() => setNuance(k)}>
                  {v.label}
                </Option>
              ))}
            </div>
          </Etape>

          <Etape num="03" titre="Épaisseur" aide="Seules les épaisseurs réellement disponibles dans cette nuance.">
            <div className="flex flex-wrap gap-2">
              {epaisseurs.map((e) => (
                <Option key={e} actif={e === epaisseur} onClick={() => setEpaisseur(e)}>
                  {mm(e)} mm
                </Option>
              ))}
            </div>
          </Etape>

          <Etape num="04" titre="Forme">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {FORMES.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={k === forme}
                  onClick={() => setForme(k)}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-btn-lg border px-1.5 pt-3 pb-2.5 text-center text-[13px] leading-tight transition-colors ${
                    k === forme ? "border-accent bg-blanc/8 text-blanc" : "border-blanc/15 bg-blanc/2 text-gris-clair-3 hover:border-blanc/40"
                  }`}
                >
                  <svg viewBox="0 0 40 30" className="h-7 w-10" aria-hidden>
                    <path d={ICONES_FORMES[k]} fillRule="evenodd" className={k === forme ? "fill-accent" : "fill-gris-clair"} />
                  </svg>
                  {catalogue.formes[k].label}
                </button>
              ))}
            </div>
          </Etape>

          {!surContact && (
            <Etape num="05" titre="Dimensions (mm)">
              <div className="grid gap-3 sm:grid-cols-2">
                {lesBornes.map((b) => (
                  <Cote key={`${forme}.${b.cle}`} borne={b} valeur={dims[b.cle]} onChange={(v) => choisirCote(b.cle, v)} />
                ))}
              </div>
              <p className="mt-3 text-sm text-gris-clair">
                En {mm(epaisseur)} mm, le plus petit trou possible fait Ø {mm(epaisseur)} mm.
              </p>
            </Etape>
          )}

          {!surContact && (
            <Etape num="06" titre="Quantité">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label="Une pièce de moins"
                  onClick={() => setQuantite((q) => Math.max(1, q - (q <= 20 ? 1 : 10)))}
                  className="h-11 w-11 cursor-pointer rounded-btn border border-blanc/20 text-lg text-blanc hover:border-blanc/50"
                >
                  −
                </button>
                <label className="sr-only" htmlFor="quantite">
                  Nombre de pièces
                </label>
                <input
                  id="quantite"
                  inputMode="numeric"
                  value={quantite}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
                    setQuantite(Number.isFinite(v) ? Math.min(9999, Math.max(1, v)) : 1);
                  }}
                  className="h-11 w-24 rounded-btn border border-blanc/20 bg-steel-night/60 text-center text-lg text-blanc tabular-nums focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Une pièce de plus"
                  onClick={() => setQuantite((q) => Math.min(9999, q + (q < 20 ? 1 : 10)))}
                  className="h-11 w-11 cursor-pointer rounded-btn border border-blanc/20 text-lg text-blanc hover:border-blanc/50"
                >
                  +
                </button>
                <span className="ml-1 text-gris-clair-3">{quantite > 1 ? "pièces" : "pièce"}</span>
              </div>
            </Etape>
          )}
        </>
      ) : (
        <div className="rounded-card border border-accent/50 bg-accent/10 p-5">
          <p className="text-[17px] text-blanc">{m.message_devis}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/contact#formulaire" className="rounded-btn-lg bg-accent px-5 py-3 font-semibold text-blanc hover:bg-accent-hover">
              Envoyer mon plan
            </Link>
            <a href={`mailto:${site.email}`} className="rounded-btn-lg border border-blanc/35 px-5 py-3 font-semibold text-blanc hover:border-blanc">
              {site.email}
            </a>
          </div>
        </div>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- colonne aperçu & prix */
  const ok = resultat?.ok ? resultat : null;
  const unitaireCourant = ok?.prix_unitaire_ht ?? 0;
  const exp = ok ? expedition(ok) : null;
  const etapes = ok ? etapesLivraison(piece) : null;
  const transportSurDevis = exp !== null && exp.options.length === 0;

  const apercu = (
    <div className="flex min-w-0 flex-col gap-4">
      {chiffrable && (
        <div className="rounded-card bg-surface p-4 text-texte">
          <div className="flex items-center justify-between text-xs tracking-[0.1em] text-texte-doux uppercase">
            <span>Votre pièce — cotée en direct</span>
            {ok && (
              <span className="tracking-normal normal-case tabular-nums">
                {nb(ok.geometrie.encombrement_mm[0])} × {nb(ok.geometrie.encombrement_mm[1])} mm
              </span>
            )}
          </div>
          <DessinTechnique forme={forme} dimensions={dims} className="mt-2 block h-[260px] w-full md:h-[320px]" />
        </div>
      )}

      {surContact && m.devis_automatique && (
        <div className="rounded-card border border-blanc/12 bg-steel-deep p-6">
          <p className="font-display text-[28px] leading-tight font-extrabold">Une forme sur mesure ?</p>
          <p className="mt-3 text-gris-clair-3">
            L&apos;éditeur de tracé en ligne arrive bientôt. En attendant, envoyez-nous votre plan ({site.formatsFichiers.join(", ")}) : nous
            le chiffrons, {site.delaiReponse}.
          </p>
          <Link
            href="/contact#formulaire"
            className="mt-5 inline-flex items-center gap-2 rounded-btn-lg bg-accent px-5 py-3 font-semibold text-blanc hover:bg-accent-hover"
          >
            Envoyer mon plan <IconeFleche />
          </Link>
        </div>
      )}

      {chiffrable && (
        <div id="prix" className="scroll-mt-[88px] rounded-card border border-blanc/10 bg-steel-deep p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] text-gris-clair-3">{`${m.label} ${n?.label.toLowerCase()} · ${mm(epaisseur)} mm · ${formeDef.label}`}</p>
              {ok && (
                <p className="mt-0.5 text-sm text-gris-clair">
                  {nb(ok.masse_nette_kg, 2)} kg par pièce · {nb(ok.geometrie.perimetre_mm, 0)} mm de coupe
                </p>
              )}
            </div>
            <div role="group" aria-label="Affichage des prix" className="flex shrink-0 overflow-hidden rounded-btn border border-blanc/20 text-sm">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={ttc === v}
                  onClick={() => setTtc(v)}
                  className={`cursor-pointer px-2.5 py-1 ${ttc === v ? "bg-blanc text-steel-night" : "text-gris-clair-3 hover:text-blanc"}`}
                >
                  {v ? "TTC" : "HT"}
                </button>
              ))}
            </div>
          </div>

          {resultat && !resultat.ok && (
            <div role="alert" className="mt-5 rounded-btn-lg border border-accent/50 bg-accent/10 p-4">
              <p className="text-blanc">{resultat.message}</p>
              <Link href="/contact#formulaire" className="mt-3 inline-flex items-center gap-1.5 font-semibold text-blanc underline underline-offset-4">
                Nous contacter <IconeFleche />
              </Link>
            </div>
          )}

          {ok && (
            <>

              <div className="mt-5 border-t border-blanc/10 pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-gris-clair-2">Prix unitaire</span>
                  <span className="text-lg tabular-nums">
                    {eur(prix(ok.prix_unitaire_ht))} € {suffixe}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-4">
                  <span className="font-display text-2xl font-extrabold">
                    Total {quantite} {quantite > 1 ? "pièces" : "pièce"}
                  </span>
                  <span aria-live="polite" className="font-display text-[40px] leading-none font-extrabold text-accent tabular-nums">
                    {eur(ttc ? ok.total_ttc : ok.total_ht)} €
                  </span>
                </div>
                <p className="mt-1 text-right text-sm text-gris-clair">
                  {ttc ? `soit ${eur(ok.total_ht)} € HT` : `soit ${eur(ok.total_ttc)} € TTC`}
                </p>
                {etapes && <EtapesLivraisonPrix etapes={etapes} montant={(ht) => `${eur(prix(ht))} € ${suffixe}`} />}
              </div>

              <div className="mt-5 border-t border-blanc/10 pt-4">
                <p className="mb-2.5 text-xs tracking-[0.1em] text-gris-clair uppercase">Plus vous en prenez, moins ça coûte</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {paliers.map(({ q, r }) => {
                    if (!r.ok) return null;
                    const gain = Math.round((1 - r.prix_unitaire_ht / unitaireCourant) * 100);
                    return (
                      <button
                        key={q}
                        type="button"
                        aria-pressed={q === quantite}
                        onClick={() => setQuantite(q)}
                        className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-btn border px-1 py-2 transition-colors ${
                          q === quantite ? "border-accent bg-blanc/8" : "border-blanc/15 bg-blanc/3 hover:border-blanc/40"
                        }`}
                      >
                        <span className="text-xs text-gris-clair">{q === 1 ? "1 pce" : `${q} pces`}</span>
                        <span className="text-[15px] font-semibold tabular-nums">{eur(prix(r.prix_unitaire_ht))} €</span>
                        <span className="min-h-4 text-xs text-accent tabular-nums">{q > quantite && gain > 0 ? `−${gain} %` : ""}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gris-clair">Prix unitaire {suffixe} par quantité · écart calculé par rapport à votre quantité.</p>
              </div>

              {mode === null && (
                <div className="mt-5 grid gap-2.5">
                  <button
                    type="button"
                    disabled={transportSurDevis}
                    onClick={() => setMode("commande")}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-btn-lg bg-accent px-6 py-4 text-[17px] font-semibold text-blanc transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-accent"
                  >
                    Commander et payer en ligne <IconeFleche />
                  </button>
                  {transportSurDevis && (
                    <div className="rounded-btn border border-blanc/15 bg-blanc/4 px-3 py-2.5 text-center text-sm text-gris-clair-3">
                      <p>{exp?.raison} Demandez votre devis ci-dessous : nous vous envoyons le prix livré par mail.</p>
                    </div>
                  )}
                  {!transportSurDevis && exp?.mode === "sur_devis" && (
                    <p className="text-center text-sm text-gris-clair-3">
                      {exp.raison} Commandez avec retrait à l&apos;atelier, ou demandez un devis de livraison.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode("devis")}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-btn-lg border border-blanc/35 px-6 py-3.5 font-semibold text-blanc transition-colors hover:border-blanc hover:bg-blanc/8"
                  >
                    Demander ce devis
                  </button>
                </div>
              )}
              {mode === "devis" && <DemandeDevis piece={piece} onAnnuler={() => setMode(null)} />}
              {mode === "commande" && <Commander piece={piece} onAnnuler={() => setMode(null)} onDevis={() => setMode("devis")} />}
            </>
          )}
        </div>
      )}

      <p className="text-center text-sm text-gris-clair-2">
        Pièce trop spécifique ?{" "}
        <Link href="/contact#formulaire" className="font-semibold text-blanc underline underline-offset-4 hover:text-accent">
          Envoyez-nous votre plan
        </Link>
      </p>
    </div>
  );

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:gap-14">
        {formulaire}
        <div className="lg:sticky lg:top-[88px] lg:self-start">{apercu}</div>
      </div>

      {/* Mobile : le prix reste sous les yeux pendant qu'on tire les curseurs. */}
      {ok && (
        <a
          id="barre-prix-mobile"
          href="#prix"
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-blanc/10 bg-steel-night/95 px-5 py-3 text-blanc backdrop-blur lg:hidden"
        >
          <span className="text-sm text-gris-clair-2">
            {quantite} × {eur(prix(ok.prix_unitaire_ht))} € {suffixe}
          </span>
          <span className="font-display text-2xl font-extrabold text-accent tabular-nums">
            {eur(ttc ? ok.total_ttc : ok.total_ht)} € <span className="text-sm text-gris-clair-2">{suffixe}</span>
          </span>
        </a>
      )}
    </>
  );
}

