# ADM Laser — brief MVP du site

Fichier de consigne pour Claude Code. À poser à la racine du repo, à côté de `CLAUDE.md`,
`catalogue.json`, `tarifs.json`, `golden.json` et du dossier `reference/`.

Ouvre chaque session par : *« Lis MVP.md et CLAUDE.md, puis reprends à l'étape N. »*

---

## Le périmètre, et il est étroit exprès

ADM Laser est un atelier de découpe laser, pliage et soudure en sous-traitance
(Vaires-sur-Marne, 77). Ce MVP construit **le site vitrine complet, avec un configurateur
qui AFFICHE un prix**.

### Dans le MVP

- Toutes les pages du site, finies et présentables
- Le moteur de prix porté en TypeScript, testé contre les devis réels
- Le configurateur : matière → épaisseur → forme → dimensions → **prix affiché**
- Le bouton au bout du configurateur est **« Demander ce devis »** : il envoie la
  configuration et le prix par mail. Rien d'autre.
- Le SEO local, dès le départ

### HORS du MVP — ne construis rien de tout ça

- **Aucun paiement.** Pas de Stripe, pas de tunnel, pas de panier, pas de commande.
- Pas de comptes clients, pas d'espace client, pas de recommande
- Pas de calcul de transport, pas de choix de livraison
- Pas de gestion de stock ni d'affichage de disponibilité
- Pas de parsing de fichier DXF/STEP (le bouton existe, il renvoie vers le formulaire)
- Pas de contenu de CGV ni de mentions légales — **placeholders uniquement**, les textes
  arrivent d'un juriste

Si une de ces briques te paraît nécessaire pour que le site tienne debout, **dis-le au lieu
de la construire.**

---

## La direction artistique

Reprise de la maquette validée (style « ForgeX »). Ne pas réinventer : ces valeurs sont
celles de la maquette, au hexadécimal près.

### Couleurs

```
--accent          #D93A2B   rouge, boutons et accents
--accent-hover    #B32E22
--or              #F2B84B   étoiles d'avis, points lumineux
--steel-deep      #1F2731   fond de nav, départ du dégradé héros
--steel-night     #151C23   arrivée du dégradé héros
--steel           #313B46   titres sur fond blanc
--steel-mid       #3A4552   #4A5563  #5B6672   dégradés de plaques, texte courant
--texte           #1B2126
--texte-doux      #5B6672
--gris-clair      #8A93A0  #B8BCC0  #C7CBCE
--surface         #F3F4F5   #F1F2F3
--bordure         #E3E5E7
--blanc           #FFFFFF
```

Héros : `linear-gradient(160deg, #1F2731, #151C23)`.

### Typographie

- Titres `h1 h2 h3` : **Big Shoulders Display**, 700 à 800 — condensée, industrielle
- Texte courant : **IBM Plex Sans**, 400 à 600
- Les deux via Google Fonts, avec `display=swap` et une pile de repli réelle

### Mise en page

- Conteneur `max-width: 1180px`, gouttières de 48 px en desktop, 20 px minimum en mobile
- Sections verticales à 96 px, 64 px en mobile
- Nav collante, hauteur 72 px, fond `--steel-deep`
- Rayons : 6 px sur les boutons, 8 px sur les gros boutons, 14 px sur les cartes
- Survols : `.btn-primary` → `--accent-hover`, `.btn-outline` → bordure blanche +
  `rgba(255,255,255,.08)`, liens de nav → blanc

### Le héros

Colonne gauche : sur-titre `DÉCOUPE · PLIAGE · SOUDURE` en `--accent`, h1 à 54 px, sous-titre,
deux boutons, et une ligne d'avis Google (5 étoiles `--or`).

Colonne droite : composition abstraite de **deux plaques métalliques** en dégradé, inclinées
(`rotate(-7deg)` et `rotate(9deg)`), avec une **ligne laser rouge** lumineuse en diagonale
(`rotate(-16deg)`, `box-shadow` rouge) et trois points d'étincelle. Pas de photo : c'est du
CSS pur, et ça reste net sur tous les écrans.

---

## Le stack — décidé

- **Next.js (App Router) + TypeScript**, déployé sur un VPS Dokploy, machine séparée
- **Aucun backend séparé.** Pas de Python en production : le moteur TypeScript tourne côté
  navigateur pour le prix en direct, et côté serveur pour le mail de devis.
- **Tailwind CSS**, avec les couleurs ci-dessus déclarées en tokens de thème
- **Vitest**
- Pas de base de données : catalogue et tarifs sont des fichiers JSON
- Pas de librairie de composants, pas de librairie d'animation

### Arborescence attendue

```
data/              catalogue.json  tarifs.json  golden.json
reference/         le Python, oracle de vérité — jamais déployé
src/
  app/             layout.tsx  page.tsx  globals.css  sitemap.ts  robots.ts
                   savoir-faire/  matieres/  devis/  realisations/  contact/
                   mentions-legales/  cgv/
  components/      Header  Footer  Hero  Section  Button  StatsBar  Card
                   Configurateur  DessinTechnique  JsonLd
  lib/devis/       moteur.ts  geometrie.ts  catalogue.ts  types.ts
  lib/site.ts      nom, adresse, mail, téléphone — un seul endroit, avec les TODO
  test/            golden.test.ts  invariants.test.ts
```

---

## Les pages et leur contenu réel

Le texte ci-dessous est celui de la maquette validée. **Utilise-le tel quel**, n'invente pas
d'autre argumentaire commercial.

### `/` — accueil

**Héros** — sur-titre `DÉCOUPE · PLIAGE · SOUDURE`
> « Vos pièces métalliques, découpées avec **précision**. »
> Découpe laser, pliage et soudure sur mesure — acier, inox et aluminium, façonnés dans
> notre atelier de Vaires-sur-Marne.

Boutons : **Configurer ma pièce** (vers `/devis`) · **Envoyer un plan (DXF/STEP)** (vers
`/contact`). Puis la ligne « Avis clients sur Google ».

**Notre savoir-faire**
> Nous découpons, plions et soudons le métal — avec la précision qui évite l'aller-retour.
>
> De la pièce unique à la petite série, nous travaillons l'acier, l'inox et l'aluminium sur
> notre parc Trumpf, du laser à la soudure — sans sous-traiter d'étape.

Trois cartes :
- **Découpe laser de précision** — Acier, inox et aluminium sur notre TruLaser Trumpf.
- **Pliage & soudure** — Mise en forme sur plieuses Trumpf et assemblage TIG/MIG — des
  pièces prêtes à poser, pas juste découpées.
- **Qualité & livraison premium** — Zéro rayure, emballage soigné, livraison partout en France.

**Bandeau de chiffres** — quatre entrées :
`Acier · Inox · Alu` / Matières travaillées · `0,5 à 15 mm` / Épaisseurs disponibles ·
`Trumpf TruLaser` / Parc machines · `Toute la France` / Zone de livraison

> **Correction à appliquer.** La maquette annonce « 1 à 20 mm ». C'est faux et il ne faut pas
> le publier : le catalogue réel va de 0,5 à 15 mm en acier, 1 à 10 mm en inox, 0,5 à 12 mm
> en alu. Annoncer 20 mm génère des demandes qu'ADM doit refuser. Prends les valeurs de
> `catalogue.json`, et calcule-les depuis le fichier plutôt que de les écrire en dur.

**Capacités** — quatre cartes : Découpe laser · Pliage · Soudure TIG/MIG · Devis instantané.

**Matières et finitions disponibles** — six pastilles : Acier brut · Acier galvanisé ·
Corten · Inox brossé · Inox miroir · Aluminium.

**Devis en ligne**
> Votre prix, en quelques secondes.
>
> Choisissez la matière, l'épaisseur, la forme et les dimensions : le prix s'affiche
> instantanément. Pour une pièce complexe ou une grande série, notre équipe reprend la main
> par message.

Frise en 5 étapes : Matière → Épaisseur → Forme → Dimensions → Prix instantané.

**Réalisations** — trois cartes : Découpe acier sur mesure · Pièces inox brossé ·
Structures pliées & soudées. **Emplacements photo marqués, aucune fausse réalisation.**

**Appel final**
> Un plan à découper ? Discutons-en.
>
> Envoyez votre plan ou décrivez votre besoin — réponse sous 24 à 48 h pour les pièces hors
> configurateur.

### `/devis` — le configurateur, plein écran

### `/savoir-faire`
Découpe laser, pliage, soudure. Capacités machine, formats, matières, tolérances.
Les chiffres viennent de `catalogue.json`.

### `/matieres`
Les 14 nuances du catalogue avec leurs arguments commerciaux, tirés de
`reference/conseiller_matiere.py` (corten = rouille stabilisée esthétique dehors, larmé =
antidérapant pour marches extérieures, tôle bleue = très dure mais ne se plie pas…).
Plus le questionnaire à 5 questions, porté du même fichier. **C'est la page qui porte le
référencement longue traîne.**

### `/realisations`
Galerie. Photos à fournir par ADM : emplacements marqués `TODO`.

### `/contact`
Formulaire — nom, mail, téléphone, message, pièce jointe facultative — coordonnées, plan de
Vaires-sur-Marne. C'est aussi l'arrivée du bouton « Envoyer un plan ».

### `/mentions-legales` et `/cgv`
**Placeholders explicites, visibles.** Un bandeau qui dit que le texte est en cours de
rédaction. Ne rédige JAMAIS de mentions légales ou de CGV : elles viennent d'un juriste et un
faux SIRET dans une mention légale est un problème réel.

### Pied de page
> Atelier Décoration Métal · Vaires-sur-Marne (77), France · contact@adm-laser.fr ·
> [Téléphone — TODO]
>
> © 2026 ADM Laser — Tous droits réservés.

---

## Le moteur de prix

Porter `reference/moteur_devis.py` dans `src/lib/devis/`. TypeScript pur, sans dépendance,
exécutable dans un navigateur comme dans un test Node. La spécification détaillée est dans
`CLAUDE.md` ; ce qui suit est ce qui fait échouer un port.

### Les trois pièges

Les trois sont des découvertes imposées par 9 devis réels. Un port qui s'en écarte produit des
totaux **plausibles et faux**.

1. **La matière se facture sur le RECTANGLE ENGLOBANT, pas au poids net.** Un cadre 300×300
   avec un trou Ø250 est facturé comme une plaque pleine : la chute intérieure est perdue,
   elle est payée. `matiere_mode: "bounding_box"`.
2. **L'arrondi minute porte sur la COMMANDE ENTIÈRE, jamais sur chaque pièce.** Au-delà de
   10 secondes entamées, on compte la minute suivante. Calcul au niveau commande, puis
   division par la quantité pour l'unitaire.
   ```ts
   const m = Math.floor(totalSecondes / 60);
   const s = totalSecondes - m * 60;
   return s > 10 ? m + 1 : m;
   ```
3. **Le tarif de base (17,11 €) et le minimum de commande (27 €) sont deux choses
   différentes** qui coexistent : `total = max(base + variable, 27)`. Ne pas les fusionner.

Deux règles de plus :
- Le **coût tôle est à zéro**, c'est voulu : le chargement est déjà compris dans le temps
  machine arrondi. S'il devait réapparaître, il se facture **au prorata** (décimal), jamais
  par tôle entière avec un `ceil` — sinon la 64ᵉ pièce coûte plus cher l'unité que la 63ᵉ.
- `rectangle_coupe_coin` : le créneau ajoute autant de trajet qu'il en retire, le périmètre
  reste `2(L+l)`. Les deux formes `cadre_*` comptent **2 perçages**, les sept autres 1.

### Les tests

- Les **9 devis de `golden.json`** doivent tomber au centime : tolérance 0,01 € sur les
  totaux, 0,1 sur les grandeurs physiques. `pieces_par_tole` et `minutes_facturees` sont des
  entiers **exacts** — ce sont eux qui révèlent un piège mal porté.
- **Invariants, à tester en propriété et pas seulement en exemple :** prix unitaire
  décroissant de 1 à 400 pièces ; total strictement croissant de 1 à 400 ; aucune dent de
  scie aux bascules de tôle (tester 61→65 et 126→127) ; et **le prix ne doit jamais être
  identique pour 1 et 5 pièces** — défaut déjà repéré et corrigé, test de non-régression
  obligatoire.
- En cas de divergence, l'oracle est le Python : `cd reference && python3 valider.py`.
- **Ne modifie aucun coefficient de `tarifs.json`** pour faire passer un test. Ces valeurs
  sont calibrées sur de vrais devis et elles sont le contrat.

---

## Le configurateur

- Matière → nuance → épaisseur **en cascade** : ne propose que les épaisseurs qui existent
  réellement pour la nuance choisie. Ne jamais afficher un choix qui sera refusé ensuite.
- Les 9 formes de `catalogue.json`, avec **dessin technique SVG coté en direct** : la pièce se
  redessine et les cotes se mettent à jour à chaque changement. `fill-rule="evenodd"` pour les
  découpes intérieures.
- Curseurs et champs bornés par les `min`/`max` de `catalogue.json`.
- **Table de paliers** (1, 5, 10, 25, 50, 100) avec le gain en pourcentage, calculé par
  rapport à la **quantité courante** et non par rapport à 1 pièce — sinon tous les gros
  paliers saturent au même pourcentage et le tableau ne dit plus rien.
- Prix unitaire HT **et** total HT, mis à jour sans latence. Bascule HT/TTC visible.
- Bouton « Quelle matière choisir ? » → le questionnaire à 5 questions, qui rend un classement
  avec, pour chaque nuance, pourquoi elle convient **et** les réserves. Garder la règle de
  l'acier larmé : il reste proposé en extérieur — c'est LA tôle à marches — avec la réserve
  « à galvaniser ou peindre après découpe ». L'écarter dehors serait techniquement défendable
  et commercialement faux.
- Forme « Autres formes » : hors périmètre. Renvoi vers `/contact`.
- **Au bout : « Demander ce devis ».** Le formulaire part par mail avec la configuration
  complète et le prix calculé. Pas de paiement, pas de panier.

### Ce que le moteur doit REFUSER

Un refus n'est pas une erreur, c'est un devis à faire à la main. Message lisible par un
client, en français, sans jargon, et qui propose une issue.

- Épaisseur indisponible pour la nuance (galvanisé n'existe qu'en 1/2/3 mm, inox brossé en
  1/2/3/4 mm…) — le message liste les épaisseurs réelles
- **Trou plus petit que l'épaisseur de la tôle.** En 10 mm, le plus petit trou fait Ø10 mm.
  Règle d'atelier, sans exception.
- Pièce hors format tôle (3000 × 1500 mm)
- Cuivre et laiton : `devis_automatique: false`, renvoi vers le mail
- Découpe intérieure plus grande que la pièce

---

## Le SEO — dans le MVP, pas dans les finitions

Google met des mois à indexer : ce qui n'est pas écrit maintenant ne rapportera rien avant
longtemps. C'est un enjeu commercial réel pour un sous-traitant du 77, pas une case à cocher.

- `metadata` par page : `title` unique, `description` de 150 à 160 caractères, `canonical`
- Données structurées JSON-LD `LocalBusiness` : nom, adresse, zone desservie, horaires,
  prestations. Les champs inconnus restent vides avec un `TODO`, jamais inventés.
- `sitemap.ts` et `robots.ts` générés
- Un `<h1>` unique par page, une hiérarchie de titres propre
- Balises Open Graph et une image de partage
- Images en `next/image`, `alt` descriptif sur chacune
- Cibles : « découpe laser Seine-et-Marne », « découpe laser sur mesure »,
  « tôlerie Vaires-sur-Marne », « découpe laser 77 ». La page `/matieres` porte la longue
  traîne : « découpe corten », « tôle larmée sur mesure », « inox brossé découpe ».
- Aucune page en `noindex` sauf les placeholders juridiques, jusqu'à ce qu'ils soient remplis

---

## Ce que tu ne fais jamais

1. **Inventer une information manquante.** Téléphone, SIRET, adresse exacte, photos, mentions
   légales, CGV, réalisations, avis clients : `TODO` visible, et tu le signales.
2. **Rédiger des mentions légales ou des CGV.**
3. **Modifier un coefficient de `tarifs.json`.**
4. **Mettre un prix, une durée ou un seuil en dur** dans le code. Tout vient des JSON.
5. **Construire du paiement, un panier, un compte client ou du transport.** Hors périmètre.
6. **Annoncer une capacité qu'ADM n'a pas** — voir la correction sur les épaisseurs.
7. **Démarrer l'étape suivante** sans avoir rendu compte de la précédente.

---

## Les étapes

Après chacune : **tu t'arrêtes et tu rends compte.**

| | Étape | Fini quand |
|---|---|---|
| 1 | Projet Next.js + Tailwind avec les tokens de couleur et les deux polices | `npm run dev` affiche une page avec la bonne identité |
| 2 | Le moteur en TypeScript | `npm run test` vert sur les 9 devis **et** les invariants. **Aucune interface dans cette étape.** |
| 3 | Mise en page partagée : Header, Footer, Section, Button | Les composants existent et rendent la nav et le pied de la maquette |
| 4 | La page d'accueil, toutes ses sections | Fidèle à la maquette, lisible à 400 px de large, sans défilement horizontal |
| 5 | Le configurateur, avec le dessin coté et les paliers | Les 9 formes produisent un prix, les refus affichent le bon message |
| 6 | Les autres pages | `/savoir-faire` `/matieres` `/realisations` `/contact` + placeholders juridiques |
| 7 | Le SEO et le formulaire de devis par mail | Métadonnées, JSON-LD, sitemap, robots ; le formulaire envoie la config et le prix |

---

## Comment rendre compte

En quelques lignes : ce qui est fait, la sortie des tests, ce que tu as dû décider toi-même,
et les `TODO` laissés. Pas de liste des fichiers modifiés — ce qui compte, c'est l'écart
entre ce que disait ce brief et ce que tu as fait.

Si une consigne ici te paraît fausse ou contradictoire, **dis-le au lieu de la contourner.**
Certaines décisions ont coûté des semaines de calibrage et ne sont pas négociables, mais
toutes ne sont pas parfaites.
