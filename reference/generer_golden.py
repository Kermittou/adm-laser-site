"""Recalcule les valeurs « attendu » de data/golden.json avec moteur_devis.py.

À relancer après tout changement de tarifs.json / catalogue.json, puis relire le diff :
les prix du logiciel ADM (prix_logiciel_adm_ht) ne bougent jamais, seuls le moteur et l'écart.
Usage (depuis la racine) : python reference/generer_golden.py
"""
import json
from pathlib import Path

from moteur_devis import Piece, calculer

chemin = Path(__file__).resolve().parent.parent / "data" / "golden.json"
golden = json.loads(chemin.read_text(encoding="utf-8"))
for g in golden:
    r = calculer(Piece(**g["entree"]))
    g["attendu"] = {
        "perimetre_mm": r["geometrie"]["perimetre_mm"],
        "surface_englobante_mm2": r["geometrie"]["encombrement_mm"][0] * r["geometrie"]["encombrement_mm"][1],
        "surface_facturee_m2": r["surface_facturee_m2"],
        "masse_facturee_kg": r["masse_facturee_kg"],
        "vitesse_mm_s": r["vitesse_mm_s"],
        "temps_par_piece_s": r["temps_coupe_s"],
        "taux_coupe_eur_min": r["taux_coupe_eur_min"],
        "pieces_par_tole": r["pieces_par_tole"],
        "minutes_facturees": r["minutes_facturees"],
        "majoration_grande_piece_pct": r["majoration_grande_piece_pct"],
        "prix_unitaire_ht": r["prix_unitaire_ht"],
        "total_ht": r["total_ht"],
    }
    g["ecart_pct"] = round((r["total_ht"] - g["prix_logiciel_adm_ht"]) / g["prix_logiciel_adm_ht"] * 100, 2)
    print(f"{g['cle']:<22}{g['prix_logiciel_adm_ht']:>10.2f}{r['total_ht']:>10.2f}{g['ecart_pct']:>8.1f} %")
chemin.write_text(json.dumps(golden, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
