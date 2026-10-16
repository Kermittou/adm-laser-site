/**
 * Mail « commande à préparer » envoyé à l'atelier quand un client paie en ligne.
 *
 * Pur et testable (pas d'appel réseau) : le webhook Stripe lui passe les données de la commande,
 * il rend le sujet, le texte et la pièce jointe DXF.
 */
import { EXPEDITION, expedition, GRILLE, horsZone } from "@/lib/commande";
import { catalogue, mm } from "@/lib/devis/catalogue";
import { eur, nb } from "@/lib/devis/configurateur";
import { genererDxf } from "@/lib/devis/dxf";
import { devis } from "@/lib/devis/moteur";
import { libelleCotes, libellePiece } from "@/lib/devis/resume";
import { site } from "@/lib/site";
import type { Piece } from "@/lib/devis/types";

export type Adresse = { ligne1?: string | null; ligne2?: string | null; codePostal?: string | null; ville?: string | null; pays?: string | null };

export type DonneesCommande = {
  /** Référence courte affichée partout (dérivée de l'identifiant Stripe). */
  reference: string;
  date: Date;
  piece: Piece | null;
  livraison: { cle?: string; libelle?: string; prixHt?: string; envoi?: string };
  montantTtc: number;
  lienPaiement?: string;
  client: { nom?: string | null; societe?: string | null; email?: string | null; telephone?: string | null; tva?: string | null; facturation?: Adresse | null };
  destinataire: { nom?: string | null; adresse?: Adresse | null } | null;
  /** Bordereaux Boxtal (un par colis) : PDF à joindre, ou raison de leur absence. */
  bordereau?: { colis?: BordereauColis[]; raison?: string };
};

export type BordereauColis = { pdf?: Buffer | null; idBoxtal?: string; prixHt?: number; livraisonEstimee?: string; erreur?: string };

export type MailAtelier = { sujet: string; texte: string; piecesJointes: { nom: string; contenu: Buffer; type: string }[] };

export const referenceCommande = (idStripe: string) => idStripe.replace(/^cs_(test_|live_)?/, "").slice(-8).toUpperCase();

const ligneAdresse = (a?: Adresse | null) =>
  a ? [a.ligne1, a.ligne2, `${a.codePostal ?? ""} ${a.ville ?? ""}`.trim(), a.pays && a.pays !== "FR" ? a.pays : null].filter(Boolean).join(", ") : "—";

/** Date + n jours ouvrés (lundi → vendredi ; jours fériés non comptés). */
export function plusJoursOuvres(date: Date, jours: number): Date {
  const d = new Date(date);
  let restant = jours;
  while (restant > 0) {
    d.setDate(d.getDate() + 1);
    const j = d.getDay();
    if (j !== 0 && j !== 6) restant--;
  }
  return d;
}

const dateLongue = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const fichierSur = (s: string) => s.normalize("NFD").replace(/[^\w.,-]+/g, "-").replace(/-+/g, "-");

function lignesBordereaux(b: DonneesCommande["bordereau"], noms: string[]): string[] {
  if (!b?.colis?.length) {
    return [`  Bordereau   : NON GÉNÉRÉ — ${b?.raison ?? "génération automatique non configurée"}. À éditer sur le compte Boxtal.`];
  }
  return b.colis.map((x, i) => {
    const tete = b.colis!.length > 1 ? `  Bordereau ${i + 1}/${b.colis!.length}: ` : "  Bordereau   : ";
    const ref = x.idBoxtal ? ` — réf. Boxtal ${x.idBoxtal}` : "";
    if (!x.pdf) return `${tete}NON GÉNÉRÉ — ${x.erreur ?? "pas encore prêt chez Boxtal"}${ref}. À télécharger sur le compte Boxtal.`;
    const prix = x.prixHt !== undefined ? ` · transport ${eur(x.prixHt)} € HT` : "";
    const livraison = x.livraisonEstimee ? ` · livraison estimée le ${dateLongue(new Date(`${x.livraisonEstimee}T12:00:00`))}` : "";
    return `${tete}${noms[i]} (joint)${ref}${prix}${livraison}`;
  });
}

export function mailAtelier(c: DonneesCommande): MailAtelier {
  const p = c.piece;
  const r = p ? devis(p) : null;
  const res = r?.ok ? r : null;
  const exp = res ? expedition(res) : null;

  const m = p ? catalogue.matieres[p.matiere] : undefined;
  const n = p && m ? m.nuances[p.nuance] : undefined;
  const f = p ? catalogue.formes[p.forme] : undefined;
  const matiere = m && n ? `${m.label} ${n.label.toLowerCase()}` : (p ? `${p.matiere} ${p.nuance}` : "?");
  const epaisseur = p ? `${mm(p.epaisseur_mm)} mm` : "?";
  const cotes = p && f ? f.parametres.map((prm) => `${prm.label} ${nb(p.dimensions[prm.cle])} mm`).join(" · ") : "—";

  const option = EXPEDITION.options.find((o) => o.cle === c.livraison.cle);
  const delai = option?.delai_jours;
  const express = c.livraison.cle === "express";
  const retrait = Boolean(option?.retrait);
  const echeance = delai ? plusJoursOuvres(c.date, delai) : null;

  // --- DXF de découpe
  const piecesJointes: MailAtelier["piecesJointes"] = [];
  let nomDxf = "";
  if (p) {
    nomDxf = fichierSur(`ADM-${c.reference}-${p.matiere}-${p.nuance}-${String(p.epaisseur_mm).replace(".", ",")}mm-x${p.quantite}.dxf`);
    const dxf = genererDxf(p.forme, p.dimensions, `Commande ${c.reference} - ${matiere} ${epaisseur} - quantite ${p.quantite}`);
    if (dxf) piecesJointes.push({ nom: nomDxf, contenu: Buffer.from(dxf, "ascii"), type: "application/dxf" });
  }

  // --- bordereaux d'envoi (Boxtal), un par colis
  const bordereaux = c.bordereau?.colis ?? [];
  const nomsBordereaux = bordereaux.map((_, i) =>
    bordereaux.length > 1 ? `ADM-${c.reference}-bordereau-${i + 1}-sur-${bordereaux.length}.pdf` : `ADM-${c.reference}-bordereau.pdf`,
  );
  bordereaux.forEach((x, i) => {
    if (x.pdf) piecesJointes.push({ nom: nomsBordereaux[i], contenu: x.pdf, type: "application/pdf" });
  });

  const palette = c.livraison.envoi === "palette";
  const lignesColis = !exp
    ? []
    : palette
      ? [
          `  Envoi       : PALETTE — ${GRILLE.transporteur_lourd} · ${nb(exp.poids_facture_kg)} kg facturés · pièce la plus longue ${nb(exp.longueur_mm / 10)} cm`,
          "  À faire     : commander la palette sur le compte Boxtal (pas de bordereau automatique).",
        ]
      : exp.colis.length
        ? [
            `  Envoi       : ${exp.colis.length} colis${exp.colis.length > 1 ? ` (${exp.colis.length} envois séparés)` : ""} — ${GRILLE.transporteur_colis} · pièce la plus longue ${nb(exp.longueur_mm / 10)} cm`,
            ...exp.colis.map(
              (x, i) =>
                `    colis ${i + 1}  : ${x.quantite} pièce${x.quantite > 1 ? "s" : ""} — ${nb(x.poids_kg, 2)} kg emballage compris — ${x.dimensions_cm.join(" × ")} cm${x.volumineux ? " — VOLUMINEUX (dépôt en bureau de poste)" : ""}`,
            ),
          ]
        : [`  Envoi       : ${exp.raison ?? "transport sur devis"} → chiffrer le transport avec le client.`];
  const alerteZone =
    !retrait && horsZone(c.destinataire?.adresse?.codePostal)
      ? `  ⚠ HORS ZONE : ${c.destinataire?.adresse?.codePostal} — la grille ne couvre pas ${GRILLE.hors_zone.join(" ni les ")}. Contacter le client avant d'encaisser.`
      : "";

  const sujet = [
    `[Commande ${c.reference}]`,
    express ? "EXPRESS" : null,
    retrait ? "RETRAIT ATELIER" : null,
    palette ? "PALETTE" : null,
    c.livraison.libelle ?? null,
    `— ${p ? `${p.quantite} × ` : ""}${matiere} ${epaisseur}`,
    `— ${c.client.societe || c.client.nom || c.client.email || "client"}`,
  ]
    .filter(Boolean)
    .join(" ");

  const texte = [
    `COMMANDE EN LIGNE ${c.reference} — ${dateLongue(c.date)}`,
    "",
    "PAIEMENT BLOQUÉ, PAS ENCORE ENCAISSÉ.",
    "Après vérification de la pièce : « Capturer » le paiement dans Stripe (7 jours maximum), ou l'annuler.",
    c.lienPaiement ? `→ ${c.lienPaiement}` : "",
    "",
    "━━━ À FABRIQUER ━━━",
    `  Matière     : ${matiere}`,
    `  ÉPAISSEUR   : ${epaisseur}`,
    `  QUANTITÉ    : ${p?.quantite ?? "?"} pièce${(p?.quantite ?? 0) > 1 ? "s" : ""}`,
    `  Forme       : ${f?.label ?? p?.forme ?? "?"} — ${cotes}`,
    res ? `  Encombrement: ${nb(res.geometrie.encombrement_mm[0])} × ${nb(res.geometrie.encombrement_mm[1])} mm · ${res.pieces_par_tole} pièces par tôle` : "",
    piecesJointes.length ? `  Fichier     : ${nomDxf} (joint, en mm)` : "  Fichier     : pas de DXF pour cette forme — voir le client",
    !res && r && !r.ok ? `  ⚠ La pièce ne se recalcule plus : ${r.message}` : "",
    "",
    "━━━ EXPÉDITION ━━━",
    ...(retrait
      ? [
          "  Mode        : RETRAIT À L'ATELIER — pas d'envoi, pas de bordereau.",
          "  À faire     : prévenir le client (mail ou téléphone) dès que la commande est prête.",
        ]
      : [
          `  Délai       : ${c.livraison.libelle ?? "?"}${echeance ? ` — à expédier au plus tard le ${dateLongue(echeance)}` : ""}`,
          ...lignesColis,
        ]),
    exp ? `  Poids       : ${nb(exp.poids_kg)} kg de pièces (nettes)` : "",
    ...(retrait
      ? [`  Contact     : ${c.client.nom ?? "—"} — ${c.client.telephone ?? "—"} — ${c.client.email ?? "—"}`]
      : [
          `  Destinataire: ${c.destinataire?.nom ?? c.client.nom ?? "—"}${c.client.societe ? ` (${c.client.societe})` : ""}`,
          `  Adresse     : ${ligneAdresse(c.destinataire?.adresse)}`,
          ...(alerteZone ? [alerteZone] : []),
          `  Téléphone   : ${c.client.telephone ?? "—"}`,
          ...lignesBordereaux(c.bordereau, nomsBordereaux),
        ]),
    "",
    "━━━ CLIENT ━━━",
    `  Nom         : ${c.client.nom ?? "—"}`,
    `  Société     : ${c.client.societe ?? "—"}`,
    `  Mail        : ${c.client.email ?? "—"}`,
    `  Téléphone   : ${c.client.telephone ?? "—"}`,
    `  N° de TVA   : ${c.client.tva ?? "—"}`,
    `  Facturation : ${ligneAdresse(c.client.facturation)}`,
    "",
    "━━━ MONTANTS ━━━",
    res ? `  Pièces      : ${eur(res.total_ht)} € HT (${eur(res.prix_unitaire_ht)} € HT la pièce)` : "",
    `  Expédition  : ${c.livraison.prixHt ? `${eur(Number(c.livraison.prixHt))} € HT` : "—"}`,
    `  Total payé  : ${eur(c.montantTtc)} € TTC`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  return { sujet, texte, piecesJointes };
}

/**
 * Mail de confirmation envoyé au CLIENT juste après son paiement : récapitulatif de la commande
 * et étapes suivantes. Rien d'interne (coûts, temps machine) : ce que le client a acheté, payé,
 * et ce qui va se passer.
 */
export function mailClient(c: DonneesCommande): { sujet: string; texte: string } {
  const p = c.piece;
  const r = p ? devis(p) : null;
  const res = r?.ok ? r : null;
  const option = EXPEDITION.options.find((o) => o.cle === c.livraison.cle);
  const retrait = Boolean(option?.retrait);
  const echeance = !retrait && option?.delai_jours ? plusJoursOuvres(c.date, option.delai_jours) : null;
  const palette = c.livraison.envoi === "palette";
  const exp = res && !retrait ? expedition(res) : null;
  const prenomNom = c.client.nom ?? "";
  const horaires = site.horaires.map((h) => `${h.jours.toLowerCase()} ${h.ouverture.replace(":", "h")}–${h.fermeture.replace(":", "h")}`).join(", ");

  const livraison = retrait
    ? "Retrait à l'atelier — gratuit"
    : [
        c.livraison.libelle ?? "Livraison",
        palette ? "sur palette" : exp?.colis.length ? `${exp.colis.length} colis Colissimo` : null,
        c.livraison.prixHt ? `${eur(Number(c.livraison.prixHt))} € HT` : null,
      ]
        .filter(Boolean)
        .join(" — ");

  const texte = [
    `Bonjour${prenomNom ? ` ${prenomNom}` : ""},`,
    "",
    "Merci pour votre commande : nous l'avons bien reçue.",
    "",
    `━━━ VOTRE COMMANDE ${c.reference} — ${dateLongue(c.date)} ━━━`,
    p ? `  Pièce       : ${libellePiece(p)}` : "",
    p ? `  Cotes       : ${libelleCotes(p)}` : "",
    p ? `  Quantité    : ${p.quantite} pièce${p.quantite > 1 ? "s" : ""}` : "",
    res ? `  Prix        : ${eur(res.total_ht)} € HT` : "",
    `  Livraison   : ${livraison}`,
    `  Total payé  : ${eur(c.montantTtc)} € TTC`,
    ...(!retrait && c.destinataire?.adresse ? [`  Livré à     : ${c.destinataire.nom ?? prenomNom} — ${ligneAdresse(c.destinataire.adresse)}`] : []),
    "",
    "━━━ ET MAINTENANT ━━━",
    "  1. Notre atelier vérifie votre pièce.",
    "  2. Le montant est seulement bloqué sur votre carte : il n'est débité qu'après cette",
    "     vérification. Si un point doit être précisé, nous vous contactons avant tout débit.",
    ...(retrait
      ? [
          "  3. Nous vous prévenons dès que votre commande est prête à retirer :",
          `     ${site.nom}, ${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}`,
          `     (${horaires}).`,
        ]
      : [`  3. Expédition prévue au plus tard le ${echeance ? dateLongue(echeance) : "délai choisi"}${palette ? ", sur palette" : ""}.`]),
    "",
    "Une question ? Répondez simplement à ce mail, ou appelez-nous au " + site.telephone + ".",
    "",
    `${site.nom} — ${site.nomComplet}`,
    `${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}`,
    `${site.telephone} · ${site.email}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  return { sujet: `${site.nom} — votre commande ${c.reference} est bien reçue`, texte };
}

/**
 * Mails de suivi envoyés au CLIENT quand l'atelier tranche dans Stripe :
 *   « validee » : paiement capturé → la commande part en fabrication ;
 *   « annulee » : paiement annulé → le montant bloqué est libéré, rien n'est débité.
 */
export function mailSuiviClient(c: DonneesCommande, etape: "validee" | "annulee"): { sujet: string; texte: string } {
  const option = EXPEDITION.options.find((o) => o.cle === c.livraison.cle);
  const retrait = Boolean(option?.retrait);
  const echeance = !retrait && option?.delai_jours ? plusJoursOuvres(c.date, option.delai_jours) : null;
  const p = c.piece;
  const quoi = p ? `${p.quantite} × ${libellePiece(p)}` : "votre commande";
  const signature = [
    "Une question ? Répondez simplement à ce mail, ou appelez-nous au " + site.telephone + ".",
    "",
    `${site.nom} — ${site.nomComplet}`,
    `${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}`,
    `${site.telephone} · ${site.email}`,
  ];
  const bonjour = `Bonjour${c.client.nom ? ` ${c.client.nom}` : ""},`;

  if (etape === "validee") {
    return {
      sujet: `${site.nom} — votre commande ${c.reference} est validée`,
      texte: [
        bonjour,
        "",
        `Bonne nouvelle : notre atelier a validé votre commande ${c.reference} (${quoi}). Elle part en fabrication.`,
        `Le montant de ${eur(c.montantTtc)} € TTC a été débité.`,
        "",
        retrait
          ? `Nous vous prévenons dès qu'elle est prête à retirer à l'atelier : ${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}.`
          : `Expédition prévue au plus tard le ${echeance ? dateLongue(echeance) : "délai choisi"}.`,
        "",
        ...signature,
      ].join("\n"),
    };
  }
  return {
    sujet: `${site.nom} — votre commande ${c.reference} est annulée`,
    texte: [
      bonjour,
      "",
      `Votre commande ${c.reference} (${quoi}) a été annulée.`,
      `Le montant de ${eur(c.montantTtc)} € TTC qui était bloqué sur votre carte a été libéré : rien n'a été débité.`,
      "Selon votre banque, il peut apparaître encore quelques jours sur votre compte avant de disparaître.",
      "",
      "Si vous ne vous attendiez pas à cette annulation, ou pour adapter votre pièce, contactez-nous : nous trouverons une solution.",
      "",
      ...signature,
    ].join("\n"),
  };
}
