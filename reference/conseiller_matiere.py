"""
Conseiller "Quelle matière choisir ?" — le questionnaire derrière le bouton du configurateur.

Le client répond à 5 questions, le conseiller classe les nuances du catalogue et rend pour
chacune : pourquoi elle convient, et ce sur quoi il faut faire attention.

Les propriétés viennent des arguments commerciaux dictés par l'atelier. Une règle mérite
d'être connue : l'acier larmé reste proposé en extérieur — c'est LA tôle à marches — mais
avec la réserve « à galvaniser ou peindre après découpe ». L'écarter aurait été
techniquement défendable et commercialement faux.
"""

from __future__ import annotations

import json
from pathlib import Path

CATALOGUE = json.loads((Path(__file__).resolve().parent.parent / "data" / "catalogue.json").read_text(encoding="utf-8"))

QUESTIONS = [
    {"cle": "environnement", "question": "Où la pièce va-t-elle vivre ?", "reponses": [
        ("interieur", "À l'intérieur, au sec"), ("exterieur", "Dehors, sous la pluie"),
        ("marin", "En bord de mer"), ("humide", "Intérieur humide")]},
    {"cle": "usage", "question": "À quoi sert-elle ?", "reponses": [
        ("structure", "Structure / mécanique"), ("marche", "Une marche, un sol"),
        ("decor", "Pièce visible, décorative"), ("indifferent", "Je ne sais pas encore")]},
    {"cle": "pliage", "question": "Faudra-t-il la plier ?", "reponses": [
        ("oui", "Oui"), ("non", "Non"), ("inconnu", "Je ne sais pas")]},
    {"cle": "soudure", "question": "Faudra-t-il la souder ?", "reponses": [
        ("oui", "Oui"), ("non", "Non"), ("inconnu", "Je ne sais pas")]},
    {"cle": "priorite", "question": "Qu'est-ce qui compte le plus ?", "reponses": [
        ("prix", "Le prix"), ("resistance", "La résistance"),
        ("legerete", "La légèreté"), ("esthetique", "Le rendu visuel")]},
]

# inox = ne rouille pas · antid = antidérapant · esth = choisi pour être vu
# eco = le plus économique de sa catégorie · marin = conçu pour l'air salin
PROPS = {
    "acier.brut":          dict(inox=False, antid=False, esth=False, pliable=True,  eco=True,
                                txt="résistant, économique, facile à souder"),
    "acier.noir":          dict(inox=False, antid=False, esth=False, pliable=True,  eco=True,
                                txt="comme le brut, mais non décapé"),
    "acier.bleue":         dict(inox=False, antid=False, esth=False, pliable=False, eco=False,
                                txt="très dure — mais elle ne se plie pas"),
    "acier.galvanise":     dict(inox=True,  antid=False, esth=False, pliable=True,  eco=True,
                                txt="ne rouille pas, économique, aspect galvanisé"),
    "acier.electrozingue": dict(inox=True,  antid=False, esth=False, pliable=True,  eco=True,
                                txt="ne rouille pas, économique, aspect zinc"),
    "acier.corten":        dict(inox=True,  antid=False, esth=True,  pliable=True,  eco=False,
                                txt="rouille stabilisée, très esthétique dehors"),
    "acier.larme":         dict(inox=False, antid=True,  esth=False, pliable=True,  eco=True,
                                txt="antidérapant, parfait pour des marches extérieures"),
    "acier.perfore":       dict(inox=False, antid=False, esth=True,  pliable=True,  eco=False,
                                txt="esthétique, perforations Ø10mm"),
    "inox.brut":           dict(inox=True,  antid=False, esth=False, pliable=True,  eco=False,
                                txt="ne rouille pas, très résistant, soudable"),
    "inox.marin":          dict(inox=True,  antid=False, esth=False, pliable=True,  eco=False,
                                txt="résiste mieux à l'air salin, soudable", marin=True),
    "inox.miroir":         dict(inox=True,  antid=False, esth=True,  pliable=True,  eco=False,
                                txt="esthétique, effet miroir"),
    "inox.brosse":         dict(inox=True,  antid=False, esth=True,  pliable=True,  eco=False,
                                txt="esthétique, effet brossé"),
    "alu.brut":            dict(inox=True,  antid=False, esth=False, pliable=True,  eco=False,
                                txt="léger, ne rouille pas", alu=True),
    "alu.larme":           dict(inox=True,  antid=True,  esth=False, pliable=True,  eco=False,
                                txt="léger, ne rouille pas, antidérapant", alu=True),
}


def conseiller(rep: dict) -> list[dict]:
    """Classe les nuances selon les réponses. Renvoie les retenues, meilleures d'abord."""
    env = rep.get("environnement", "interieur")
    usage = rep.get("usage", "indifferent")
    pliage = rep.get("pliage", "inconnu")
    prio = rep.get("priorite", "prix")

    out = []
    for cle, p in PROPS.items():
        mk, nk = cle.split(".")
        inoxydable = p["inox"]
        # L'acier larmé se traite après découpe : on ne l'écarte pas dehors.
        traitable = p["antid"]

        # --- exclusions dures ---
        if pliage == "oui" and not p["pliable"]:
            continue
        if usage == "marche" and not p["antid"]:
            continue
        if env == "marin" and not inoxydable:
            continue
        if env in ("exterieur", "humide") and not inoxydable and not traitable:
            continue

        score = 0
        raisons, reserves = [], []

        # --- environnement ---
        if env == "marin":
            if p.get("marin"):
                score += 40; raisons.append("conçu pour résister à l'air salin")
            elif inoxydable:
                score += 20; raisons.append("ne rouille pas")
        elif env in ("exterieur", "humide"):
            if nk == "corten":
                score += 22
                raisons.append("sa rouille se stabilise d'elle-même — c'est fait pour rester dehors")
            elif inoxydable:
                score += 22; raisons.append("ne rouille pas")
            else:
                score += 10
                reserves.append("à galvaniser ou peindre après découpe pour tenir dehors")
        else:
            score += 8
            if not inoxydable:
                raisons.append("à l'abri, l'acier non traité suffit largement")

        # --- usage ---
        if usage == "marche":
            score += 35; raisons.append("antidérapant, prévu pour être marché dessus")
        elif usage == "decor":
            if p["esth"]:
                score += 30; raisons.append("choisi pour être vu")
            else:
                score += 4
                reserves.append("aspect brut — prévoyez une finition si la pièce est visible")
        elif usage == "structure":
            if p.get("alu"):
                score += 8
                reserves.append("l'alu se raye plus vite et encaisse moins bien les chocs")
            elif mk == "inox":
                score += 20; raisons.append("très résistant")
            else:
                score += 16; raisons.append("résistant")
        else:
            score += 6

        # --- pliage / soudure ---
        if pliage == "oui":
            score += 6; raisons.append("se plie sans problème")
        if rep.get("soudure") == "oui":
            score += 6; raisons.append("soudable")

        # --- priorité ---
        if prio == "prix":
            if p["eco"]:
                score += 26; raisons.append("le plus économique de sa catégorie")
            elif mk == "inox":
                score -= 12; reserves.append("l'inox reste nettement plus cher que l'acier")
            else:
                score += 14
        elif prio == "resistance":
            if mk == "inox":
                score += 26; raisons.append("le plus résistant du catalogue")
            elif p.get("alu"):
                score += 4; reserves.append("moins résistant aux chocs que l'acier ou l'inox")
            else:
                score += 20; raisons.append("très bonne tenue mécanique")
        elif prio == "legerete":
            if p.get("alu"):
                score += 30; raisons.append("environ 3x plus léger que l'acier à volume égal")
            else:
                score -= 8; reserves.append("lourd — l'aluminium serait 3x plus léger")
        elif prio == "esthetique":
            if p["esth"]:
                score += 28; raisons.append("l'un des rendus les plus soignés du catalogue")
            else:
                score -= 4

        nuance = CATALOGUE["matieres"][mk]["nuances"][nk]
        out.append({
            "matiere": mk, "nuance": nk,
            "label": f"{CATALOGUE['matieres'][mk]['label']} {nuance['label']}",
            "score": score, "raisons": raisons, "reserves": reserves,
            "resume": p["txt"], "epaisseurs": nuance["epaisseurs"],
        })

    return sorted(out, key=lambda r: -r["score"])


def recommander(reponses: dict, nb: int = 3) -> dict:
    classement = conseiller(reponses)
    if not classement:
        return {"recommandations": [], "message":
                "Aucune matière du catalogue ne coche toutes ces cases — "
                "écrivez-nous, on trouvera la bonne solution ensemble."}
    return {"recommandations": classement[:nb], "message": None}


if __name__ == "__main__":
    scenarios = [
        ("Marche d'escalier extérieure",
         dict(environnement="exterieur", usage="marche", pliage="non", soudure="non", priorite="resistance")),
        ("Support mécanique intérieur, budget serré",
         dict(environnement="interieur", usage="structure", pliage="oui", soudure="oui", priorite="prix")),
        ("Enseigne décorative en bord de mer",
         dict(environnement="marin", usage="decor", pliage="non", soudure="non", priorite="esthetique")),
        ("Panneau décoratif de jardin",
         dict(environnement="exterieur", usage="decor", pliage="non", soudure="non", priorite="esthetique")),
    ]
    for titre, rep in scenarios:
        print("=" * 74); print(titre); print("=" * 74)
        for i, r in enumerate(recommander(rep)["recommandations"], 1):
            eps = ", ".join(f"{e:g}" for e in r["epaisseurs"])
            print(f"  {i}. {r['label']}  ({eps} mm)")
            for x in r["raisons"]:
                print(f"       + {x}")
            for x in r["reserves"]:
                print(f"       ! {x}")
        print()
