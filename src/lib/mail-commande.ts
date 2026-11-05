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
import { site, SITE_URL } from "@/lib/site";
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

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus), à midi UTC. */
function paques(annee: number): Date {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((8 * b + 13) / 25)) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour, 12));
}

/** Jours fériés de métropole (AAAA-MM-JJ), lundi de Pentecôte compris. */
export function joursFeries(annee: number): Set<string> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const p = paques(annee).getTime();
  const apresPaques = (n: number) => iso(new Date(p + n * 86_400_000));
  const fixes = ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"].map((md) => `${annee}-${md}`);
  return new Set([...fixes, apresPaques(1), apresPaques(39), apresPaques(50)]);
}

/**
 * Date + n jours ouvrés, comptés sur le calendrier de Paris : ni samedi, ni dimanche, ni jour
 * férié. Sert à l'échéance des mails et à la date de remise au transporteur (Boxtal).
 */
export function plusJoursOuvres(date: Date, jours: number): Date {
  const [a, m, j] = date.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j, 12));
  let restant = jours;
  while (restant > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const jour = d.getUTCDay();
    if (jour !== 0 && jour !== 6 && !joursFeries(d.getUTCFullYear()).has(d.toISOString().slice(0, 10))) restant--;
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
          "  À faire     : prévenir le client (e-mail ou téléphone) dès que la commande est prête.",
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
    `  E-mail      : ${c.client.email ?? "—"}`,
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
    "Nous vous remercions pour votre commande, que nous avons bien reçue.",
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
    "     vérification. Si un point doit être précisé, nous vous contacterons avant tout débit.",
    ...(retrait
      ? [
          "  3. Nous vous préviendrons dès que votre commande sera prête à être retirée :",
          `     ${site.nom}, ${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}`,
          `     (${horaires}).`,
        ]
      : [`  3. Expédition prévue au plus tard le ${echeance ? dateLongue(echeance) : "délai choisi"}${palette ? ", sur palette" : ""}.`]),
    "",
    `Votre commande est soumise à nos conditions générales de vente, acceptées lors de la commande : ${SITE_URL}/cgv`,
    "Votre pièce étant fabriquée sur mesure selon vos indications, cette commande n'ouvre pas de droit de rétractation (article L221-28, 3° du Code de la consommation).",
    "",
    "Pour toute question, il vous suffit de répondre à cet e-mail ou de nous appeler au " + site.telephone + ".",
    "",
    "Cordialement,",
    "",
    `L'équipe ${site.nom} — ${site.nomComplet}`,
    `${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}`,
    `${site.telephone} · ${site.email}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  return { sujet: `${site.nom} — votre commande ${c.reference} a bien été reçue`, texte };
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
    "Pour toute question, il vous suffit de répondre à cet e-mail ou de nous appeler au " + site.telephone + ".",
    "",
    "Cordialement,",
    "",
    `L'équipe ${site.nom} — ${site.nomComplet}`,
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
        `Nous avons le plaisir de vous informer que notre atelier a validé votre commande ${c.reference} (${quoi}). Sa fabrication est lancée.`,
        `Le montant de ${eur(c.montantTtc)} € TTC a été débité de votre carte.`,
        "",
        retrait
          ? `Nous vous préviendrons dès qu'elle sera prête à retirer à l'atelier : ${site.adresse.rue}, ${site.adresse.codePostal} ${site.adresse.ville}.`
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
      `Nous vous informons que votre commande ${c.reference} (${quoi}) a été annulée.`,
      `Le montant de ${eur(c.montantTtc)} € TTC qui était bloqué sur votre carte a été libéré : rien n'a été débité.`,
      "Selon votre banque, ce montant peut encore apparaître quelques jours sur votre compte avant de disparaître.",
      "",
      "Si vous ne vous attendiez pas à cette annulation, ou si vous souhaitez adapter votre pièce, contactez-nous : nous trouverons ensemble une solution.",
      "",
      ...signature,
    ].join("\n"),
  };
}
