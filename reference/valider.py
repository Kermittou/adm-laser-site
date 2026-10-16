"""Confrontation du moteur aux 9 devis reels du logiciel actuel."""
from moteur_devis import Piece, calculer

DEVIS = [
    ("45 platines 300x300 acier 3mm",  330.00, Piece("acier","brut",3,"rectangle",dict(longueur=300,largeur=300),quantite=45), True),
    ("45 platines 300x300 acier 8mm",  836.00, Piece("acier","brut",8,"rectangle",dict(longueur=300,largeur=300),quantite=45), True),
    ("45 cadres 300x300 D250 acier 1mm",138.04, Piece("acier","brut",1,"cadre_coupe_circulaire",dict(longueur=300,largeur=300,diametre_interieur=250),quantite=45), True),
    ("5 platines 300x300 acier 3mm",    50.00, Piece("acier","brut",3,"rectangle",dict(longueur=300,largeur=300),quantite=5), True),
    ("10 platines 300x300 acier 3mm",   91.00, Piece("acier","brut",3,"rectangle",dict(longueur=300,largeur=300),quantite=10), True),
    ("45 platines 300x300 acier 4mm",  450.00, Piece("acier","brut",4,"rectangle",dict(longueur=300,largeur=300),quantite=45), True),
    ("50 platines 300x300 alu 5mm",    929.00, Piece("alu","brut",5,"rectangle",dict(longueur=300,largeur=300),quantite=50), True),
    ("50 platines 300x300 inox 8mm",  3151.00, Piece("inox","brut",8,"rectangle",dict(longueur=300,largeur=300),quantite=50), True),
    ("9 cadres 1300x1300 int.56 8mm", 2915.10, Piece("acier","brut",8,"cadre_coupe_rectangle",dict(longueur=1300,largeur=1300,longueur_interieure=56,largeur_interieure=56),quantite=9), False),
    ("1 platine 200x200 acier 10mm",     37.00, Piece("acier","brut",10,"rectangle",dict(longueur=200,largeur=200),quantite=1), False),
    ("10 platines 200x200 acier 10mm",  140.00, Piece("acier","brut",10,"rectangle",dict(longueur=200,largeur=200),quantite=10), False),
    ("100 platines 200x200 acier 10mm",1145.00, Piece("acier","brut",10,"rectangle",dict(longueur=200,largeur=200),quantite=100), False),
]

print(f"{'devis':<36}{'logiciel':>10}{'moteur':>10}{'ecart':>8}   statut")
print("-"*78)
aj, ho = [], []
for label, reel, p, ajuste in DEVIS:
    calc = calculer(p)["total_ht"]
    e = (calc - reel)/reel*100
    (aj if ajuste else ho).append(abs(e))
    print(f"{label:<36}{reel:>9.2f}€{calc:>9.2f}€{e:>7.1f}%   {'ajuste' if ajuste else 'JAMAIS VU'}")
print("-"*78)
print(f"ecart moyen ajustement {sum(aj)/len(aj):.1f} %   |   hors echantillon {sum(ho)/len(ho):.1f} %")
