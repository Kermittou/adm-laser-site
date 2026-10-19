"use client";

import Link from "next/link";
import { useState } from "react";
import { etapesLivraison, expedition } from "@/lib/commande";
import { catalogue, mm } from "@/lib/devis/catalogue";
import { bornes, dimensionsEffectives, dimensionsParDefaut, epaisseurProche, eur, nb } from "@/lib/devis/configurateur";
import { devis, PALIERS, tarifs } from "@/lib/devis/moteur";
import type { Piece } from "@/lib/devis/types";
import { site } from "@/lib/site";
import { Commander, EtapesLivraisonPrix } from "./configurateur/Commander";
import { ConseillerCompact } from "./configurateur/ConseillerCompact";
import { Cote, Etape, ICONES_FORMES, Option } from "./configurateur/champs";
import { DemandeDevis } from "./configurateur/DemandeDevis";
import { DessinTechnique } from "./DessinTechnique";
import { IconeFleche } from "./Icones";

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
