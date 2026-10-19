"use client";

import Link from "next/link";
import { useState } from "react";
import { construireCommande, expedition, GRILLE, type EtapesLivraison, type Envoi, type OffreEnvoi } from "@/lib/commande";
import { eur, nb } from "@/lib/devis/configurateur";
import { devis, tarifs } from "@/lib/devis/moteur";
import type { Piece } from "@/lib/devis/types";
import { adresseUneLigne, site } from "@/lib/site";
import { IconeCheck } from "../Icones";
import { Todo } from "../ui";

/* Commande en ligne : choix du retrait ou de la livraison, puis redirection vers Stripe Checkout. */

/**
 * Récapitulatif avant paiement, en deux temps :
 *   1. retrait gratuit à l'atelier, ou
 *   2. livraison → choix du délai (2 ou 7 jours) ; le supplément du délai s'ajoute aux frais de port.
 * Les montants sont recalculés par le serveur avant de créer la session Stripe : le navigateur
 * n'envoie que la configuration et l'option choisie.
 */
export function Commander({ piece, onAnnuler, onDevis }: { piece: Piece; onAnnuler: () => void; onDevis: () => void }) {
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
export function EtapesLivraisonPrix({ etapes, montant }: { etapes: EtapesLivraison; montant: (ht: number) => string }) {
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
