/** Description lisible d'une configuration — pour le récapitulatif et le mail de demande de devis. */
import { catalogue, mm } from "./catalogue";
import { eur, nb } from "./configurateur";
import type { Piece, ResultatDevis } from "./types";

export function libellePiece(p: Piece): string {
  const m = catalogue.matieres[p.matiere];
  const n = m?.nuances[p.nuance];
  const f = catalogue.formes[p.forme];
  return `${m?.label ?? p.matiere} ${n?.label.toLowerCase() ?? p.nuance} · ${mm(p.epaisseur_mm)} mm · ${f?.label ?? p.forme}`;
}

export function libelleCotes(p: Piece): string {
  const f = catalogue.formes[p.forme];
  return (f?.parametres ?? []).map((prm) => `${prm.label} ${nb(p.dimensions[prm.cle])} mm`).join(" · ");
}

export function texteDevis(p: Piece, r: ResultatDevis, tva: number): string {
  return [
    `Pièce : ${libellePiece(p)}`,
    `Cotes : ${libelleCotes(p)}`,
    `Quantité : ${p.quantite}`,
    "",
    `Prix unitaire : ${eur(r.prix_unitaire_ht)} € HT`,
    `Total : ${eur(r.total_ht)} € HT — ${eur(r.total_ttc)} € TTC (TVA ${nb(tva * 100)} %)`,
    r.prix_minimum_applique ? "Minimum de commande appliqué." : "",
    "",
    "Détail technique",
    `  Encombrement : ${nb(r.geometrie.encombrement_mm[0])} × ${nb(r.geometrie.encombrement_mm[1])} mm`,
    `  Périmètre de coupe : ${nb(r.geometrie.perimetre_mm)} mm · ${r.geometrie.percages} perçage(s)`,
    `  Masse facturée : ${nb(r.masse_facturee_kg, 3)} kg/pièce (nette ${nb(r.masse_nette_kg, 3)} kg)`,
    `  Temps machine : ${r.minutes_facturees} min facturées · ${r.pieces_par_tole} pièces par tôle · ${r.nombre_de_toles} tôle(s)`,
    `  Par pièce : matière ${eur(r.detail_unitaire.matiere)} € · découpe ${eur(r.detail_unitaire.decoupe)} €${r.detail_unitaire.majoration ? ` · majoration grande pièce ${eur(r.detail_unitaire.majoration)} €` : ""}${r.detail_unitaire.attenuation ? ` · préparation de série ${eur(r.detail_unitaire.attenuation)} €` : ""}${r.detail_unitaire.arrondi ? ` · arrondi ${eur(r.detail_unitaire.arrondi)} €` : ""}${r.detail_unitaire.chute ? ` · coupe de chute ${eur(r.detail_unitaire.chute)} €` : ""} · frais de plan ${eur(r.detail_unitaire.frais_plan)} €`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
}
