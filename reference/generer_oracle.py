"""Génère test/fixtures/moteur_oracle.json : 3 000 devis aléatoires chiffrés par moteur_devis.py.
Usage (depuis la racine) : python reference/generer_oracle.py reference test/fixtures/moteur_oracle.json"""
import json, random, sys
sys.path.insert(0, sys.argv[1])
from moteur_devis import Piece, calculer, DevisImpossible, CATALOGUE
rng = random.Random(20261014)
cas = []
formes = [f for f in CATALOGUE["formes"] if f != "personnalisee"]
for i in range(3000):
    mk = rng.choice(["acier", "inox", "alu"])
    nk = rng.choice(list(CATALOGUE["matieres"][mk]["nuances"]))
    ep = rng.choice(CATALOGUE["matieres"][mk]["nuances"][nk]["epaisseurs"])
    if i % 15 == 0:
        forme = "personnalisee"
        bx, by = rng.randint(20, 1400), rng.randint(20, 1400)
        dims = dict(surface_mm2=bx * by * rng.uniform(0.3, 1), perimetre_mm=2 * (bx + by) * rng.uniform(1, 2.5),
                    encombrement_x=bx, encombrement_y=by, percages=rng.randint(1, 4))
    else:
        forme = rng.choice(formes)
        dims = {}
        for prm in CATALOGUE["formes"][forme]["parametres"]:
            hi = min(prm["max"], 1600) if rng.random() < 0.85 else prm["max"]
            v = rng.uniform(prm["min"], hi)
            dims[prm["cle"]] = round(v) if rng.random() < 0.7 else round(v, 1)
    q = rng.choice([rng.randint(1, 12), rng.randint(1, 120), rng.randint(1, 400)])
    feats = []
    if rng.random() < 0.1:
        feats = [{"type": "trou", "diametre_mm": rng.choice([ep, ep + 4, 25, 40])}, {"type": "arrondi"}][: rng.randint(1, 2)]
    entree = dict(matiere=mk, nuance=nk, epaisseur_mm=ep, forme=forme, dimensions=dims, quantite=q, features=feats)
    try:
        r = calculer(Piece(**entree))
        sortie = {k: r[k] for k in ("total_ht", "prix_unitaire_ht", "total_ttc", "minutes_facturees", "pieces_par_tole",
                                     "nombre_de_toles", "masse_facturee_kg", "temps_coupe_s", "prix_minimum_applique")}
    except DevisImpossible as e:
        sortie = {"refus": str(e)}
    cas.append({"entree": entree, "sortie": sortie})
json.dump(cas, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(cas), "cas,", sum("refus" in c["sortie"] for c in cas), "refus")
