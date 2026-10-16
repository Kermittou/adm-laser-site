"""
Calibrage du moteur sur les devis réels d'ADM Laser.

    python3 calibrer.py

COMMENT ÇA MARCHE
-----------------
Le prix d'une commande s'écrit :

    Total = tarif_de_base + n x masse x K_mat + n x temps x K_mach

    K_mat  = prix_kg x marge_matiere          (EUR par kg facturé)
    K_mach = taux_horaire / 3600 x marge_machine   (EUR par seconde machine)

Le prix ne dépend pas de prix_kg et marge_matiere séparément : seulement de leur
produit. Quatre réglages s'effondrent donc en DEUX coefficients par matière — et
K_mach est commun aux trois matières, puisque c'est la même machine.

Il suffit de saisir ci-dessous des devis sortis du logiciel actuel. Le script
résout le système au moindre carré, teste les trois façons possibles de compter
la matière, et garde celle qui colle le mieux. Il écrit ensuite les valeurs
calibrées dans tarifs.json.

CE QU'IL FAUT SAISIR
--------------------
Au minimum 2 devis acier très contrastés (une pièce épaisse et compacte, une
pièce fine et découpée), puis 1 devis inox et 1 devis alu. Ajoutez-en d'autres :
le script s'en sert pour mesurer sa propre précision.
"""

from __future__ import annotations

import json
from pathlib import Path

from moteur_devis import (CATALOGUE, TARIFS, geometrie, temps_coupe_s,
                          pieces_par_tole, _epaisseur_masse_mm)

# --------------------------------------------------------------------------- #
#  LES DEVIS DU LOGICIEL ACTUEL — c'est la seule partie à remplir
# --------------------------------------------------------------------------- #
#  (matière, nuance, épaisseur, forme, dimensions, quantité, prix HT du logiciel)
#
#  Mettez le prix HORS TAXES. Si votre logiciel affiche du TTC, divisez par 1,2.
#  Laissez None pour un devis que vous n'avez pas encore sorti : il sera ignoré.

DEVIS = [
    # --- Acier : les deux extrêmes, indispensables ---
    ("acier", "brut", 3,  "rectangle", dict(longueur=300, largeur=300), 45, 330.0),
    ("acier", "brut", 8,  "rectangle", dict(longueur=300, largeur=300), 45, None),   # matière pure
    ("acier", "brut", 1,  "cadre_coupe_circulaire",
                          dict(longueur=300, largeur=300, diametre_interieur=250), 45, None),  # coupe pure

    # --- Les autres matières : un devis chacune suffit ---
    ("inox",  "brut", 3,  "rectangle", dict(longueur=300, largeur=300), 45, None),
    ("alu",   "brut", 3,  "rectangle", dict(longueur=300, largeur=300), 45, None),

    # --- Devis de contrôle : NON utilisés pour le calcul, seulement pour vérifier ---
    ("acier", "brut", 4,  "rectangle", dict(longueur=300, largeur=300), 45, None),
    ("acier", "brut", 2,  "rectangle", dict(longueur=500, largeur=400), 10, None),
]

# Les trois façons possibles de compter la matière. Le script les teste toutes.
MODES = {
    "net":      "le poids exact des pièces (aucune chute facturée)",
    "englobant": "le rectangle englobant de chaque pièce",
    "tole":     "la tôle réellement engagée, au prorata du remplissage",
}


def elements(matiere, nuance, epaisseur, forme, dims, quantite, mode):
    """Masse facturée et temps machine par pièce, selon le mode de comptage matière."""
    geo = geometrie(forme, **dims)
    ep_masse = _epaisseur_masse_mm(matiere, nuance, epaisseur)
    densite = CATALOGUE["matieres"][matiere]["densite_kg_dm3"]
    par_tole = pieces_par_tole(geo)

    if mode == "net":
        surface = geo["surface_nette_mm2"]
    elif mode == "englobant":
        surface = geo["surface_englobante_mm2"]
    else:  # tole
        fx, fy = CATALOGUE["contraintes"]["format_tole_max_mm"]
        surface = fx * fy / par_tole  # part de tôle que la pièce immobilise

    masse = surface * ep_masse / 1_000_000 * densite
    temps = (temps_coupe_s(geo, matiere, epaisseur)["total_s"]
             + TARIFS["temps_chargement_tole_s"] / par_tole)
    return masse, temps


def resoudre(lignes, mode):
    """Moindres carrés sans dépendance externe : K_mat par matière + K_mach commun."""
    mats = sorted({d[0] for d in lignes})
    idx = {m: i for i, m in enumerate(mats)}
    ncol = len(mats) + 1

    A, b = [], []
    for matiere, nuance, ep, forme, dims, n, prix in lignes:
        masse, temps = elements(matiere, nuance, ep, forme, dims, n, mode)
        row = [0.0] * ncol
        row[idx[matiere]] = n * masse
        row[-1] = n * temps
        A.append(row)
        b.append(prix - TARIFS["tarif_de_base_eur"])

    # équations normales AtA x = Atb, résolues par élimination de Gauss
    AtA = [[sum(A[k][i] * A[k][j] for k in range(len(A))) for j in range(ncol)] for i in range(ncol)]
    Atb = [sum(A[k][i] * b[k] for k in range(len(A))) for i in range(ncol)]
    M = [AtA[i] + [Atb[i]] for i in range(ncol)]
    for c in range(ncol):
        piv = max(range(c, ncol), key=lambda r: abs(M[r][c]))
        if abs(M[piv][c]) < 1e-12:
            return None, None, None
        M[c], M[piv] = M[piv], M[c]
        for r in range(ncol):
            if r != c:
                f = M[r][c] / M[c][c]
                for k in range(c, ncol + 1):
                    M[r][k] -= f * M[c][k]
    x = [M[i][ncol] / M[i][i] for i in range(ncol)]

    k_mat = {m: x[idx[m]] for m in mats}
    k_mach = x[-1]
    ecarts = []
    for (matiere, nuance, ep, forme, dims, n, prix) in lignes:
        masse, temps = elements(matiere, nuance, ep, forme, dims, n, mode)
        predit = TARIFS["tarif_de_base_eur"] + n * masse * k_mat[matiere] + n * temps * k_mach
        ecarts.append((prix, predit, abs(predit - prix) / prix * 100))
    return k_mat, k_mach, ecarts


def main():
    fournis = [d for d in DEVIS if d[6] is not None]
    mats = {d[0] for d in fournis}

    print("=" * 74)
    print("CALIBRAGE DU MOTEUR SUR LES DEVIS REELS")
    print("=" * 74)
    print(f"  Devis saisis : {len(fournis)} sur {len(DEVIS)}   (matières : {', '.join(sorted(mats)) or '—'})")

    manques = []
    if len([d for d in fournis if d[0] == "acier"]) < 2:
        manques.append("au moins 2 devis ACIER d'épaisseurs très différentes (ex. 1 mm et 8 mm)")
    for m in ("inox", "alu"):
        if m not in mats:
            manques.append(f"1 devis {m.upper()}")
    if manques:
        print("\n  Il manque encore, pour un calibrage complet :")
        for x in manques:
            print(f"    - {x}")
    if len(fournis) < 2:
        print("\n  Pas assez de devis pour résoudre quoi que ce soit.")
        print("  Ouvrez calibrer.py, remplissez les prix dans DEVIS, relancez.")
        return

    print("\n" + "=" * 74)
    print("QUELLE FAÇON DE COMPTER LA MATIERE COLLE LE MIEUX ?")
    print("=" * 74)
    resultats = {}
    for mode, desc in MODES.items():
        k_mat, k_mach, ecarts = resoudre(fournis, mode)
        if k_mat is None:
            print(f"  {mode:<10} système indéterminé — vos devis sont trop semblables entre eux")
            continue
        err = sum(e[2] for e in ecarts) / len(ecarts)
        resultats[mode] = (k_mat, k_mach, ecarts, err)
        print(f"  {mode:<10} écart moyen {err:>5.1f} %   ({desc})")

    if not resultats:
        print("\n  Ajoutez des devis plus contrastés (épaisseurs et formes très différentes).")
        return

    best = min(resultats, key=lambda m: resultats[m][3])
    k_mat, k_mach, ecarts, err = resultats[best]
    print(f"\n  -> Retenu : « {best} » — {MODES[best]}")

    print("\n" + "=" * 74)
    print("COEFFICIENTS DEDUITS")
    print("=" * 74)
    taux_horaire = k_mach * 3600
    print(f"  Coût machine tout compris : {taux_horaire:>7.2f} EUR/h   (marge incluse)")
    for m, k in sorted(k_mat.items()):
        print(f"  Matière {m:<6}           : {k:>7.2f} EUR/kg facturé   (marge incluse)")
    print("\n  Ces coefficients incluent déjà votre marge : ils disent ce que vous")
    print("  FACTUREZ, pas ce que vous payez. Pour connaître votre marge réelle, il")
    print("  faut y confronter vos vraies factures fournisseur.")

    print("\n" + "=" * 74)
    print("PRECISION SUR CHAQUE DEVIS")
    print("=" * 74)
    for (matiere, nuance, ep, forme, dims, n, prix), (reel, predit, e) in zip(fournis, ecarts):
        flag = "  <-- à regarder" if e > 8 else ""
        print(f"  {matiere:<6}{ep:>3g}mm {forme:<24}{n:>4} pces : "
              f"réel {reel:>8.2f}  calculé {predit:>8.2f}  écart {e:>5.1f} %{flag}")
    print(f"\n  Écart moyen : {err:.1f} %")
    if err < 5:
        print("  Sous 5 %, le moteur reproduit votre logiciel. Calibrage validé.")
    else:
        print("  Au-dessus de 5 %, il manque un poste que votre logiciel facture et")
        print("  que le moteur ignore. Ajoutez des devis pour le faire apparaître.")

    print("\n" + "=" * 74)
    print("ECRIRE CES VALEURS DANS tarifs.json ?")
    print("=" * 74)
    print("  Les coefficients se répartissent ainsi (marges laissées à 1, puisque")
    print("  les valeurs déduites les contiennent déjà) :\n")
    print(f'    "taux_horaire_machine_eur_h": {taux_horaire:.2f},')
    print('    "marge_machine": 1.0,')
    print('    "marge_matiere": 1.0,')
    print('    "prix_kg_eur": {')
    for m, k in sorted(k_mat.items()):
        print(f'      "{m}": {{ "_defaut": {k:.2f} }},')
    print("    }")
    rep = input("\n  Écrire dans tarifs.json ? [o/N] ").strip().lower()
    if rep == "o":
        p = Path(__file__).resolve().parent.parent / "data" / "tarifs.json"
        t = json.loads(p.read_text(encoding="utf-8"))
        t["taux_horaire_machine_eur_h"] = round(taux_horaire, 2)
        t["marge_machine"] = 1.0
        t["marge_matiere"] = 1.0
        t["matiere_mode"] = {"net": "net", "englobant": "bounding_box", "tole": "tole"}[best]
        for m, k in k_mat.items():
            t["prix_kg_eur"].setdefault(m, {})["_defaut"] = round(k, 2)
        t["_calibrage"] = (f"Calibré sur {len(fournis)} devis du logiciel actuel, "
                           f"écart moyen {err:.1f} %. Mode matière : {best}.")
        p.write_text(json.dumps(t, ensure_ascii=False, indent=2), encoding="utf-8")
        print("  tarifs.json mis à jour. Relancez test_moteur.py pour vérifier.")
    else:
        print("  Rien n'a été modifié.")


if __name__ == "__main__":
    main()
