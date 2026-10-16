"""
Moteur de devis automatique ADM Laser — réglages du logiciel de devis ADM (15/10/2026).

    Prix = max(pièces + frais de plan, minimum de commande)
    Pièce = matière (bande d'imbrication × prix au kg) + découpe (minutes × taux €/min selon
            matière et épaisseur), majorée pour les grandes pièces.

Ancien modèle (calibrage du 29/09/2026) archivé dans archives/calibrage-2026-09-29.

    Prix commande = tarif de base (27 €, une fois) + quantité x prix de la pièce
    Prix unitaire = tarif de base / quantité + prix de la pièce

Trois niveaux de coût, et c'est cette répartition — pas une grille de remises — qui produit
la dégressivité :
    par COMMANDE : le tarif de base (programmation, devis, facture, emballage, expédition)
    par TÔLE     : chargement/déchargement, facturé AU PRORATA de la tôle occupée
    par PIÈCE    : matière, trajet de coupe, amorçage, tri

Il n'y a pas de prix plancher et il ne faut pas en ajouter un : puisque
total = base + quantité x prix_pièce, le total ne peut jamais tomber sous la base.

Ce que Quentin a fourni et qui est donc FIABLE :
  - les vitesses de coupe réelles par matière et épaisseur (en m/min, dans catalogue.json)
  - le tarif de base de 27 €
  - le catalogue réel des nuances et de leurs épaisseurs disponibles
  - la règle : un trou ne peut pas être plus petit que l'épaisseur de la tôle

Ce qui reste à caler (voir tarifs.json) : le prix d'achat au kg — le plus important, il domine
le prix des grandes pièces — puis le taux horaire machine et les deux coefficients de marge.

Changer un prix ne demande pas de toucher à ce fichier : tout est dans tarifs.json.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "data"
CATALOGUE = json.loads((BASE / "catalogue.json").read_text(encoding="utf-8"))
TARIFS = json.loads((BASE / "tarifs.json").read_text(encoding="utf-8"))


class DevisImpossible(Exception):
    """La pièce demandée ne peut pas être chiffrée automatiquement — devis humain."""


# --------------------------------------------------------------------------- #
#  Catalogue : lecture et validation
# --------------------------------------------------------------------------- #

def matiere(cle: str) -> dict:
    m = CATALOGUE["matieres"].get(cle)
    if m is None:
        raise DevisImpossible(f"matière inconnue : {cle!r}")
    return m


def nuance(matiere_cle: str, nuance_cle: str) -> dict:
    m = matiere(matiere_cle)
    if not m["devis_automatique"]:
        raise DevisImpossible(m.get("message_devis", f"{m['label']} : devis sur demande."))
    n = m["nuances"].get(nuance_cle)
    if n is None:
        dispo = ", ".join(m["nuances"])
        raise DevisImpossible(f"nuance inconnue pour {m['label']} : {nuance_cle!r} (dispo : {dispo})")
    return n


def epaisseurs_disponibles(matiere_cle: str, nuance_cle: str) -> list[float]:
    return list(nuance(matiere_cle, nuance_cle)["epaisseurs"])


def valider_epaisseur(matiere_cle: str, nuance_cle: str, epaisseur_mm: float) -> None:
    dispo = epaisseurs_disponibles(matiere_cle, nuance_cle)
    if epaisseur_mm not in dispo:
        n = nuance(matiere_cle, nuance_cle)
        lst = ", ".join(f"{e:g}" for e in dispo)
        raise DevisImpossible(
            f"{matiere(matiere_cle)['label']} {n['label']} n'existe qu'en {lst} mm "
            f"(demandé : {epaisseur_mm:g} mm)"
        )


def diametre_trou_min_mm(epaisseur_mm: float) -> float:
    """Un trou ne peut pas être plus petit que l'épaisseur de la tôle."""
    return float(epaisseur_mm)


def vitesse_mm_s(matiere_cle: str, epaisseur_mm: float) -> float:
    table = matiere(matiere_cle)["vitesses_m_min"]
    cle = f"{epaisseur_mm:g}"
    if cle not in table:
        dispo = ", ".join(sorted(table, key=float))
        raise DevisImpossible(
            f"pas de vitesse connue pour {matiere_cle} {epaisseur_mm:g}mm (épaisseurs : {dispo})"
        )
    return table[cle] * 1000.0 / 60.0  # m/min -> mm/s


def taux_coupe_eur_min(matiere_cle: str, epaisseur_mm: float) -> float:
    """Taux de coupe en €/min : groupe de matières, puis première tranche dont max_mm ≥ épaisseur."""
    for groupe in TARIFS["taux_coupe_eur_min"]:
        if matiere_cle in groupe["matieres"]:
            tranches = sorted(groupe["tranches"], key=lambda t: t["max_mm"])
            for t in tranches:
                if epaisseur_mm <= t["max_mm"]:
                    return t["eur_min"]
            return tranches[-1]["eur_min"]
    raise DevisImpossible(f"pas de taux de coupe pour {matiere_cle}")


def _format_tole() -> tuple[float, float]:
    """(longueur, hauteur) de la tôle."""
    fx, fy = CATALOGUE["contraintes"]["format_tole_max_mm"]
    return max(fx, fy), min(fx, fy)


def surface_bande_mm2(geo: dict) -> float:
    """Surface de tôle consommée par pièce, imbrication ADM en colonnes :
    chaque colonne prend toute la hauteur de la tôle, sur la largeur de la pièce + l'écart
    entre pièces ; on divise par le nombre de pièces empilées dans la colonne.
    On garde l'orientation la plus économe."""
    L, H = _format_tole()
    esp = TARIFS.get("marge_entre_pieces_mm", 10.0)
    bord = TARIFS.get("marge_bord_tole_mm", 10.0)
    bx, by = geo["encombrement_mm"]
    meilleure = None
    for w, h in ((bx, by), (by, bx)):
        rangs = max(1, math.floor((H - 2 * bord + esp) / (h + esp)))
        aire = H * (w + esp) / rangs
        meilleure = aire if meilleure is None else min(meilleure, aire)
    return meilleure


def _epaisseur_masse_mm(matiere_cle: str, nuance_cle: str, epaisseur_mm: float) -> float:
    """Le larmé 3-5 pèse plus qu'une tôle lisse de 3mm : les larmes ajoutent de la matière."""
    return nuance(matiere_cle, nuance_cle).get("epaisseur_masse_mm", epaisseur_mm)


def _seuil(valeur: float, table: dict) -> str:
    for cle in sorted(table, key=float):
        if valeur <= float(cle):
            return cle
    return max(table, key=float)


# --------------------------------------------------------------------------- #
#  Géométrie des formes du catalogue
# --------------------------------------------------------------------------- #

def geometrie(forme: str, **d) -> dict:
    """Surface nette, périmètre total à découper, rectangle englobant, nombre de perçages."""
    if forme == "rectangle":
        L, l = d["longueur"], d["largeur"]
        return _geo(L * l, 2 * (L + l), L, l, 1)

    if forme == "triangle":
        b, h = d["base"], d["hauteur"]
        return _geo(b * h / 2, b + h + math.hypot(b, h), b, h, 1)

    if forme == "disque":
        dia = d["diametre"]
        return _geo(math.pi * dia**2 / 4, math.pi * dia, dia, dia, 1)

    if forme == "rectangle_coupe_coin":
        L, l, cx, cy = d["longueur"], d["largeur"], d["coupe_x"], d["coupe_y"]
        if cx >= L or cy >= l:
            raise DevisImpossible("la coupe en coin doit rester plus petite que la pièce")
        # le créneau ajoute autant de trajet qu'il en retire : périmètre inchangé
        return _geo(L * l - cx * cy, 2 * (L + l), L, l, 1)

    if forme == "cadre_coupe_circulaire":
        L, l, di = d["longueur"], d["largeur"], d["diametre_interieur"]
        if di >= min(L, l):
            raise DevisImpossible("le diamètre intérieur doit rester plus petit que la pièce")
        return _geo(L * l - math.pi * di**2 / 4, 2 * (L + l) + math.pi * di, L, l, 2)

    if forme == "cadre_coupe_rectangle":
        L, l, Li, li = d["longueur"], d["largeur"], d["longueur_interieure"], d["largeur_interieure"]
        if Li >= L or li >= l:
            raise DevisImpossible("la découpe intérieure doit rester plus petite que la pièce")
        return _geo(L * l - Li * li, 2 * (L + l) + 2 * (Li + li), L, l, 2)

    if forme == "demi_disque_allonge":
        w, h = d["largeur"], d["hauteur"]
        if h < w / 2:
            raise DevisImpossible("la hauteur totale doit valoir au moins un demi-diamètre")
        droit = h - w / 2  # partie rectangulaire sous le demi-disque
        return _geo(w * droit + math.pi * w**2 / 8, w + 2 * droit + math.pi * w / 2, w, h, 1)

    if forme == "trapeze":
        b, s, h = d["base"], d["sommet"], d["hauteur"]
        cote = math.hypot((b - s) / 2, h)
        return _geo((b + s) * h / 2, b + s + 2 * cote, max(b, s), h, 1)

    if forme == "personnalisee":
        # le modificateur en ligne fournit directement la géométrie du tracé
        return _geo(
            d["surface_mm2"], d["perimetre_mm"],
            d.get("encombrement_x", math.sqrt(d["surface_mm2"])),
            d.get("encombrement_y", math.sqrt(d["surface_mm2"])),
            d.get("percages", 1),
        )

    raise DevisImpossible(f"forme inconnue : {forme!r}")


def _geo(surface, perimetre, bx, by, percages):
    return {
        "surface_nette_mm2": surface,
        "perimetre_mm": perimetre,
        "encombrement_mm": (bx, by),
        "surface_englobante_mm2": bx * by,
        "percages": percages,
    }


def valider_encombrement(geo: dict) -> None:
    fx, fy = CATALOGUE["contraintes"]["format_tole_max_mm"]
    bx, by = geo["encombrement_mm"]
    if max(bx, by) > max(fx, fy) or min(bx, by) > min(fx, fy):
        raise DevisImpossible(
            f"pièce trop grande pour le format tôle ({bx:g}x{by:g} mm, max {fx}x{fy} mm)"
        )


# --------------------------------------------------------------------------- #
#  Les postes de prix
# --------------------------------------------------------------------------- #

def prix_matiere_eur(geo: dict, matiere_cle: str, nuance_cle: str, epaisseur_mm: float) -> dict:
    """Coût matière. On facture le rectangle englobant : la chute des découpes intérieures
    est perdue et doit être payée."""
    ep_masse = _epaisseur_masse_mm(matiere_cle, nuance_cle, epaisseur_mm)
    densite = matiere(matiere_cle)["densite_kg_dm3"]

    mode = TARIFS["matiere_mode"]
    surface_facturee = (
        surface_bande_mm2(geo) if mode == "bande"
        else geo["surface_englobante_mm2"] if mode == "bounding_box"
        else geo["surface_nette_mm2"]
    )
    masse_facturee_kg = surface_facturee * ep_masse / 1_000_000 * densite
    masse_nette_kg = geo["surface_nette_mm2"] * ep_masse / 1_000_000 * densite

    grille = TARIFS["prix_kg_eur"][matiere_cle]
    prix_kg = grille.get(nuance_cle, grille["_defaut"])

    return {
        "surface_facturee_mm2": surface_facturee,
        "masse_nette_kg": masse_nette_kg,
        "masse_facturee_kg": masse_facturee_kg,
        "prix_kg_eur": prix_kg,
        "prix_eur": masse_facturee_kg * prix_kg,
    }


def temps_coupe_s(geo: dict, matiere_cle: str, epaisseur_mm: float) -> dict:
    """Temps machine PAR PIÈCE : trajet du faisceau + amorçages + tri.

    Ne contient QUE ce qui est refait pour chaque pièce. Le chargement de tôle, qui sert à
    toutes les pièces d'une même tôle, est compté séparément — c'est cette séparation qui
    rend la dégressivité honnête.
    """
    v = vitesse_mm_s(matiere_cle, epaisseur_mm)
    t_percage = TARIFS["temps_percage_s"][_seuil(epaisseur_mm, TARIFS["temps_percage_s"])]
    trajet = geo["perimetre_mm"] / v
    amorcage = geo["percages"] * t_percage
    tri = TARIFS.get("temps_tri_par_piece_s", 0.0)
    return {"vitesse_mm_s": v, "trajet_s": trajet, "amorcage_s": amorcage,
            "tri_s": tri, "total_s": trajet + amorcage + tri}


def minutes_facturees(temps_total_s: float) -> float:
    """Le temps machine se facture à la minute, arrondie au-dessus.

    Règle de l'atelier : au-delà de 10 secondes entamées, on compte la minute
    suivante. 5 min 23 s se facturent 6 minutes. L'arrondi porte sur la COMMANDE
    entière, pas sur chaque pièce.
    """
    minutes, secondes = divmod(temps_total_s, 60)
    return minutes + 1 if secondes > 10 else minutes


def pieces_par_tole(geo: dict) -> int:
    """Combien de pièces tiennent sur une tôle, en imbrication simple.

    Estimation volontairement prudente : une grille de rectangles englobants, sans
    imbrication maline entre silhouettes. On essaie aussi la pièce tournée.
    """
    fx, fy = _format_tole()
    m = TARIFS.get("marge_entre_pieces_mm", 10.0)
    b = TARIFS.get("marge_bord_tole_mm", 0.0)
    bx, by = geo["encombrement_mm"]

    def grille(px, py):
        return max(0, int((fx - 2 * b + m) // (px + m))) * max(0, int((fy - 2 * b + m) // (py + m)))

    return max(1, grille(bx, by), grille(by, bx))


def prix_feature_eur(feature: dict, epaisseur_mm: float) -> float:
    """Petites features à tarif FIXE : pour un trou, l'amorçage domine, pas le trajet."""
    seuil = _seuil(epaisseur_mm, TARIFS["tarif_arrondi_eur"])
    if feature["type"] == "arrondi":
        return TARIFS["tarif_arrondi_eur"][seuil]
    if feature["type"] == "trou":
        dia = feature["diametre_mm"]
        mini = diametre_trou_min_mm(epaisseur_mm)
        if dia < mini:
            raise DevisImpossible(
                f"trou de Ø{dia:g}mm impossible en {epaisseur_mm:g}mm d'épaisseur : "
                f"le plus petit trou possible fait Ø{mini:g}mm"
            )
        taille = "petit" if dia < 10 else ("moyen" if dia < 30 else "grand")
        return TARIFS["tarif_trou_eur"][seuil][taille]
    raise DevisImpossible(f"type de feature inconnu : {feature['type']!r}")


# --------------------------------------------------------------------------- #
#  Le devis
# --------------------------------------------------------------------------- #

@dataclass
class Piece:
    matiere: str
    nuance: str
    epaisseur_mm: float
    forme: str
    dimensions: dict
    quantite: int = 1
    features: list = field(default_factory=list)


def calculer(piece: Piece) -> dict:
    valider_epaisseur(piece.matiere, piece.nuance, piece.epaisseur_mm)
    geo = geometrie(piece.forme, **piece.dimensions)
    valider_encombrement(geo)

    marge_mat = TARIFS.get("marge_matiere", 1.0)
    marge_mach = TARIFS.get("marge_machine", 1.0)
    taux_min = taux_coupe_eur_min(piece.matiere, piece.epaisseur_mm)
    taux_s = taux_min / 60

    # --- niveau PIÈCE : coût réel, puis prix marge incluse ---------------------
    mat = prix_matiere_eur(geo, piece.matiere, piece.nuance, piece.epaisseur_mm)
    tps = temps_coupe_s(geo, piece.matiere, piece.epaisseur_mm)
    prix_features = sum(prix_feature_eur(f, piece.epaisseur_mm) for f in piece.features)

    # Le temps machine se facture à la minute arrondie, sur la COMMANDE entière —
    # d'où un calcul au niveau commande puis une répartition sur les pièces.
    par_tole_tmp = pieces_par_tole(geo)

    # Coupe de chute, une par commande : à ecart_coupe_chute_mm de la dernière colonne de
    # pièces au lieu de l'écart normal. La bande en plus est facturée une fois, et la coupe
    # (hauteur de tôle + un amorçage) s'ajoute au temps machine de la commande.
    _, hauteur_tole = _format_tole()
    surplus_mm = max(0.0, TARIFS.get("ecart_coupe_chute_mm", 0.0) - TARIFS.get("marge_entre_pieces_mm", 10.0))
    surface_chute_mm2 = hauteur_tole * surplus_mm if TARIFS["matiere_mode"] == "bande" else 0.0
    cout_chute = mat["prix_eur"] / mat["surface_facturee_mm2"] * surface_chute_mm2
    prix_chute = cout_chute * marge_mat
    t_percage = TARIFS["temps_percage_s"][_seuil(piece.epaisseur_mm, TARIFS["temps_percage_s"])]
    coupe_chute_s = hauteur_tole / tps["vitesse_mm_s"] + t_percage if TARIFS.get("coupe_chute") else 0.0

    temps_total_s = (tps["total_s"] * piece.quantite + coupe_chute_s
                     + TARIFS.get("temps_chargement_tole_s", 0.0) * piece.quantite / par_tole_tmp)
    minutes = minutes_facturees(temps_total_s)
    cout_decoupe_commande = minutes * 60 * taux_s
    cout_decoupe = cout_decoupe_commande / piece.quantite

    cout_matiere = mat["prix_eur"]
    prix_matiere = cout_matiere * marge_mat
    prix_decoupe = cout_decoupe * marge_mach

    # Grandes pièces (plus grand côté > seuil) : majoration de la matière et de la découpe.
    gp = TARIFS.get("grande_piece", {})
    majoration_pct = gp.get("majoration", 0.0) if max(geo["encombrement_mm"]) > gp.get("seuil_mm", float("inf")) else 0.0
    prix_majoration = (prix_matiere + prix_decoupe) * majoration_pct

    cout_piece = cout_matiere + cout_decoupe + prix_features
    prix_piece = prix_matiere + prix_decoupe + prix_majoration + prix_features

    # --- niveau TÔLE : au prorata, jamais par tôle entière ---------------------
    # Sinon la 64e pièce, qui ouvre une 2e tôle, coûterait plus cher l'unité que la 63e —
    # un client le voit tout de suite. Le prorata est aussi le plus juste : le reste de la
    # tôle n'est pas perdu, il sert aux autres commandes ou part en chute réutilisable.
    par_tole = par_tole_tmp
    toles_facturees = piece.quantite / par_tole
    n_toles_physiques = math.ceil(toles_facturees)
    cout_tole = prix_tole = 0.0  # déjà compris dans le temps machine arrondi ci-dessus

    # --- niveau COMMANDE : frais de plan AJOUTÉS, pas un plancher -------------
    fixe_commande = TARIFS["frais_plan_eur"]
    cout_fixe_commande = TARIFS.get("tarif_de_base_cout_eur", fixe_commande)

    total_brut = prix_piece * piece.quantite + toles_facturees * prix_tole + fixe_commande + prix_chute
    # Atténuation de la dégressivité (décision ADM) : dès 2 pièces, chaque pièce prend un
    # pourcentage du prix d'une pièce seule — la réduction par rapport à 1 pièce baisse du
    # même nombre de points à toutes les quantités, sans créer de dent de scie.
    attenuation_pct = TARIFS.get("attenuation_degressivite_pct", 0.0)
    prix_attenuation = 0.0
    if attenuation_pct and piece.quantite > 1:
        from dataclasses import replace as _remplacer
        prix_une_piece = calculer(_remplacer(piece, quantite=1))["total_ht"]
        prix_attenuation = attenuation_pct * prix_une_piece
        total_brut += prix_attenuation * piece.quantite

    unitaire_brut = total_brut / piece.quantite

    # Deux planchers à ne pas confondre :
    #   cout_marginal = ce que coûte VRAIMENT une pièce de plus (marge nulle)
    #   prix_plancher = ce même coût majoré de la marge minimale acceptable
    cout_marginal = cout_piece + cout_tole / par_tole
    prix_marginal = prix_piece + prix_tole / par_tole
    marge_min = TARIFS.get("marge_minimum_pct", 0.0)
    prix_plancher = cout_marginal * (1 + marge_min)

    # Remise commerciale explicite, bornée par ce plancher. Levier SÉPARÉ de la
    # dégressivité technique : celle-ci s'applique à tout le monde, la remise est un choix.
    remise_pct = TARIFS.get("remise_commerciale_pct", 0.0)
    unitaire_remise = unitaire_brut * (1 - remise_pct)
    remise_bridee = bool(remise_pct) and unitaire_remise < prix_plancher
    unitaire = max(unitaire_remise, prix_plancher) if remise_pct else unitaire_brut

    total_calcule = unitaire * piece.quantite
    # Les 27 € sont un MINIMUM de commande, distinct des frais de plan additifs (20 €) :
    # les deux coexistent. Manutention comprise dans ce minimum.
    minimum = TARIFS.get("prix_minimum_eur", 0.0)
    minimum_applique = total_calcule < minimum
    total_ht = max(total_calcule, minimum)
    if minimum_applique:
        unitaire = total_ht / piece.quantite

    # Arrondi commercial : total HT à l'euro supérieur (arrondi_total_ht_eur), puis unitaire = total / qté.
    pas = TARIFS.get("arrondi_total_ht_eur", 0)
    total_avant_arrondi = total_ht
    if pas:
        total_ht = math.ceil(round(total_ht, 2) / pas - 1e-9) * pas
        unitaire = total_ht / piece.quantite
    cout_unitaire = cout_piece + cout_tole / par_tole + (cout_fixe_commande + cout_chute) / piece.quantite

    return {
        "taux_coupe_eur_min": taux_min,
        "surface_facturee_m2": round(mat["surface_facturee_mm2"] / 1e6, 4),
        "majoration_grande_piece_pct": majoration_pct,
        "coupe_chute_s": round(coupe_chute_s, 2),
        "geometrie": {
            "surface_nette_mm2": round(geo["surface_nette_mm2"], 1),
            "perimetre_mm": round(geo["perimetre_mm"], 1),
            "encombrement_mm": tuple(round(v, 1) for v in geo["encombrement_mm"]),
            "percages": geo["percages"] + len(piece.features),
        },
        "masse_nette_kg": round(mat["masse_nette_kg"], 3),
        "masse_facturee_kg": round(mat["masse_facturee_kg"], 3),
        "vitesse_mm_s": round(tps["vitesse_mm_s"], 1),
        "temps_coupe_s": round(tps["total_s"], 2),
        "minutes_facturees": minutes,
        "pieces_par_tole": par_tole,
        "nombre_de_toles": n_toles_physiques,
        "detail_unitaire": {
            "matiere": round(prix_matiere, 2),
            "decoupe": round(prix_decoupe, 2),
            "majoration": round(prix_majoration, 2),
            "features": round(prix_features, 2),
            "toles": round(toles_facturees * prix_tole / piece.quantite, 2),
            "frais_plan": round(fixe_commande / piece.quantite, 2),
            "chute": round(prix_chute / piece.quantite, 2),
            "attenuation": round(prix_attenuation, 2),
            "arrondi": round((total_ht - total_avant_arrondi) / piece.quantite, 2),
        },
        "prix_unitaire_ht": round(unitaire, 2),
        "cout_unitaire_ht": round(cout_unitaire, 2),
        "cout_marginal_ht": round(cout_marginal, 2),
        "prix_marginal_ht": round(prix_marginal, 2),
        "prix_plancher_ht": round(prix_plancher, 2),
        "marge_realisee_pct": round((unitaire / cout_unitaire - 1) * 100, 1),
        "remise_commerciale_pct": remise_pct,
        "remise_bridee_par_marge_min": remise_bridee,
        "quantite": piece.quantite,
        "epaisseur_mm": piece.epaisseur_mm,
        "prix_minimum_applique": minimum_applique,
        "total_ht": round(total_ht, 2),
        "total_ttc": round(total_ht * (1 + TARIFS["tva_taux"]), 2),
    }


PALIERS_STANDARD = [1, 5, 10, 25, 50, 100, 250, 500]


def paliers(piece: Piece, quantites: list[int] = None) -> list[dict]:
    """Table de prix par palier — ce qu'on affiche au client pour l'inciter à monter en série."""
    from dataclasses import replace
    lignes = []
    for q in (quantites or PALIERS_STANDARD):
        r = calculer(replace(piece, quantite=q))
        lignes.append({
            "quantite": q,
            "prix_unitaire_ht": r["prix_unitaire_ht"],
            "total_ht": r["total_ht"],
            "cout_unitaire_ht": r["cout_unitaire_ht"],
            "marge_pct": r["marge_realisee_pct"],
            "cout_marginal": r["cout_marginal_ht"],
            "prix_marginal": r["prix_marginal_ht"],
        })
    return lignes
