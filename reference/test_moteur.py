"""Batterie de vérification du moteur de devis — à relancer après chaque changement de tarif."""

from dataclasses import replace
from moteur_devis import (Piece, calculer, paliers, vitesse_mm_s, pieces_par_tole,
                          geometrie, DevisImpossible, TARIFS)

SEP = "-" * 78


def ligne(titre, piece):
    r = calculer(piece)
    d = r["detail_unitaire"]
    print(f"{titre:<50} {r['total_ht']:>9.2f} EUR HT")
    print(f"{'':<50} u={r['prix_unitaire_ht']:.2f}  (mat {d['matiere']:.2f} + coupe {d['decoupe']:.2f}"
          f" + tole {d['toles']:.2f} + feat {d['features']:.2f} + base {d['frais_plan']:.2f})")
    return r


print(SEP); print("1. VITESSES REELLES CONVERTIES (m/min -> mm/s)"); print(SEP)
for m in ("acier", "inox", "alu"):
    vals = []
    for e in (1, 2, 3, 5, 8, 10):
        try:
            vals.append(f"{e}mm:{vitesse_mm_s(m, e):.0f}")
        except DevisImpossible:
            pass
    print(f"  {m:<6} " + "  ".join(vals))

print(); print(SEP); print("2. EFFET DE LA QUANTITE (le tarif de base de 27 EUR s'amortit)"); print(SEP)
for q in (1, 3, 10, 50, 100):
    ligne(f"Acier brut 3mm, rectangle 300x200, qte {q}",
          Piece("acier", "brut", 3, "rectangle", dict(longueur=300, largeur=200), quantite=q))

print(); print(SEP); print("3. LES 9 FORMES (acier brut 3mm, qte 10)"); print(SEP)
for label, forme, dims in [
    ("Rectangle 300x200", "rectangle", dict(longueur=300, largeur=200)),
    ("Triangle 300x200", "triangle", dict(base=300, hauteur=200)),
    ("Disque D250", "disque", dict(diametre=250)),
    ("Rect + coupe coin", "rectangle_coupe_coin", dict(longueur=300, largeur=200, coupe_x=80, coupe_y=60)),
    ("Cadre + coupe circulaire", "cadre_coupe_circulaire", dict(longueur=300, largeur=200, diametre_interieur=120)),
    ("Cadre + coupe rectangle", "cadre_coupe_rectangle", dict(longueur=300, largeur=200, longueur_interieure=180, largeur_interieure=100)),
    ("Demi-disque + allonge", "demi_disque_allonge", dict(largeur=200, hauteur=300)),
    ("Trapeze 300/180 h200", "trapeze", dict(base=300, sommet=180, hauteur=200)),
    ("Personnalisee (trace libre)", "personnalisee", dict(surface_mm2=48000, perimetre_mm=1150, encombrement_x=300, encombrement_y=200)),
]:
    ligne(label, Piece("acier", "brut", 3, forme, dims, quantite=10))

print(); print(SEP); print("4. GRANDES PIECES / FORTES EPAISSEURS"); print(SEP)
for label, p in [
    ("Acier brut 10mm, 1000x1000, qte 1", Piece("acier", "brut", 10, "rectangle", dict(longueur=1000, largeur=1000))),
    ("Acier brut 10mm, 1000x1000, qte 20", Piece("acier", "brut", 10, "rectangle", dict(longueur=1000, largeur=1000), quantite=20)),
    ("Inox brut 8mm, 1500x1000, qte 5", Piece("inox", "brut", 8, "rectangle", dict(longueur=1500, largeur=1000), quantite=5)),
    ("Alu brut 5mm, 1000x800, qte 5", Piece("alu", "brut", 5, "rectangle", dict(longueur=1000, largeur=800), quantite=5)),
]:
    ligne(label, p)

print(); print(SEP); print("5. LES GARDE-FOUS (ce que le moteur doit REFUSER)"); print(SEP)
refus = [
    ("Galvanise en 5mm (n'existe qu'en 1/2/3)",
     lambda: calculer(Piece("acier", "galvanise", 5, "rectangle", dict(longueur=300, largeur=200)))),
    ("Inox brosse en 10mm (n'existe qu'en 1/2/3/4)",
     lambda: calculer(Piece("inox", "brosse", 10, "rectangle", dict(longueur=300, largeur=200)))),
    ("Trou de 6mm dans de la tole de 10mm",
     lambda: calculer(Piece("acier", "brut", 10, "rectangle", dict(longueur=300, largeur=200),
                            features=[{"type": "trou", "diametre_mm": 6}]))),
    ("Piece 3500x1200 (hors format tole)",
     lambda: calculer(Piece("acier", "brut", 3, "rectangle", dict(longueur=3500, largeur=1200)))),
    ("Cuivre (pas de devis automatique)",
     lambda: calculer(Piece("cuivre", "brut", 2, "rectangle", dict(longueur=300, largeur=200)))),
    ("Trou interieur plus grand que la piece",
     lambda: calculer(Piece("acier", "brut", 3, "cadre_coupe_circulaire",
                            dict(longueur=200, largeur=200, diametre_interieur=250)))),
]
for label, fn in refus:
    try:
        fn(); print(f"  !! NON REFUSE : {label}")
    except DevisImpossible as e:
        print(f"  ok  {label}\n        -> {e}")

print(); print(SEP); print("6. TROU MINIMUM ACCEPTE PAR EPAISSEUR"); print(SEP)
for e in (1, 2, 3, 5, 8, 10):
    calculer(Piece("acier", "brut", e, "rectangle", dict(longueur=300, largeur=200), quantite=10,
                   features=[{"type": "trou", "diametre_mm": e}]))
    print(f"  {e:>2}mm d'epaisseur -> plus petit trou possible : D{e}mm  (accepte)")

print(); print(SEP)
print("7. DEGRESSIVITE : courbe descendante, total croissant, jamais sous le cout marginal")
print(SEP)
ref = Piece("acier", "brut", 3, "rectangle", dict(longueur=300, largeur=200))
print(f"  {pieces_par_tole(geometrie('rectangle', longueur=300, largeur=200))} pieces par tole de 3000x1500")
print(f"  {'Qte':>5} {'PU HT':>9} {'Total HT':>10} {'Cout unit.':>11} {'Marge':>8}")
prec, sain = None, True
for l in paliers(ref):
    alerte = ""
    if prec is not None and l["prix_unitaire_ht"] > prec + 1e-9:
        alerte, sain = "  !! LE PRIX REMONTE", False
    if l["prix_unitaire_ht"] < l["cout_marginal"] - 1e-9:
        alerte, sain = "  !! SOUS LE COUT MARGINAL", False
    print(f"  {l['quantite']:>5} {l['prix_unitaire_ht']:>9.2f} {l['total_ht']:>10.2f} "
          f"{l['cout_unitaire_ht']:>11.2f} {l['marge_pct']:>7.1f}%{alerte}")
    prec = l["prix_unitaire_ht"]
print(f"  -> courbe decroissante et toujours au-dessus du cout marginal : {sain}")

pt, croissant = None, True
for q in range(1, 401):
    t = calculer(replace(ref, quantite=q))["total_ht"]
    if pt is not None and t <= pt + 1e-9:
        croissant = False
    pt = t
print(f"  -> total strictement croissant de 1 a 400 pieces           : {croissant}")
print(f"  -> le tarif de base garantit un total >= {TARIFS['frais_plan_eur']:.0f} EUR sans regle de plancher")

print(); print(SEP)
print("8. BASCULE DE TOLE (la 64e piece ne doit pas couter plus cher que la 63e)")
print(SEP)
prev = None
for q in (61, 62, 63, 64, 65, 126, 127):
    r = calculer(replace(ref, quantite=q))
    bad = prev is not None and r["prix_unitaire_ht"] > prev + 1e-9
    print(f"  {q:>4} pces ({r['nombre_de_toles']} tole phys.) : PU {r['prix_unitaire_ht']:.4f} EUR"
          + ("   !! REMONTE" if bad else ""))
    prev = r["prix_unitaire_ht"]

print(); print(SEP); print("9. LA REMISE NE DOIT JAMAIS CASSER LA MARGE MINIMALE"); print(SEP)
base_remise = TARIFS["remise_commerciale_pct"]
for remise in (0.0, 0.10, 0.25, 0.50, 0.90):
    TARIFS["remise_commerciale_pct"] = remise
    r = calculer(replace(ref, quantite=200))
    bride = "  [bridee]" if r["remise_bridee_par_marge_min"] else ""
    etat = "ok " if r["prix_unitaire_ht"] >= r["cout_marginal_ht"] else "!! "
    print(f"  {etat}remise {int(remise*100):>2}% -> PU {r['prix_unitaire_ht']:.2f} EUR, "
          f"marge {r['marge_realisee_pct']:>5.1f}%, cout marginal {r['cout_marginal_ht']:.2f} EUR{bride}")
TARIFS["remise_commerciale_pct"] = base_remise

print(); print(SEP); print("10. SENSIBILITE AU PRIX/KG (le chiffre qui manque encore)"); print(SEP)
base = TARIFS["prix_kg_eur"]["acier"]["_defaut"]
for prix_kg in (0.90, 1.20, 1.50, 2.00):
    TARIFS["prix_kg_eur"]["acier"]["_defaut"] = prix_kg
    petite = calculer(replace(ref, quantite=10))
    grosse = calculer(Piece("acier", "brut", 10, "rectangle", dict(longueur=1000, largeur=1000), quantite=20))
    print(f"  acier a {prix_kg:.2f} EUR/kg -> 10 pces 300x200 : {petite['total_ht']:>7.2f} EUR"
          f"   |   20 plaques 1x1m en 10mm : {grosse['total_ht']:>9.2f} EUR")
TARIFS["prix_kg_eur"]["acier"]["_defaut"] = base

print(); print(SEP); print("11. POINT DE CALIBRAGE JOHN STEEL"); print(SEP)
js = calculer(Piece("acier", "brut", 2, "cadre_coupe_circulaire",
                    dict(longueur=200, largeur=200, diametre_interieur=150), quantite=1))
print(f"  Acier brut 2mm, cadre 200x200 + trou D150, 1 piece")
print(f"    masse nette : {js['masse_nette_kg']} kg   (John Steel affichait 0,35 kg)")
print(f"    prix        : {js['total_ht']:.2f} EUR HT  (John Steel : 29,75 EUR HT)")
