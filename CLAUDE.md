# ADM Laser — site vitrine + devis instantané

## Le projet en trois phrases

ADM Laser (Atelier Décoration Métal, Vaires-sur-Marne) fait de la découpe laser, du pliage
et de la soudure en sous-traitance. Le site à construire est une vitrine dont la pièce
maîtresse est un **configurateur de devis instantané** : le client choisit sa matière, son
épaisseur, sa forme, ses cotes et sa quantité, et obtient un prix HT immédiat, sans attendre
un commercial. Le moteur de prix reprend **les réglages réels du logiciel de devis interne
d'ADM** (prix au kg, tarifs de coupe en €/min, frais de plan, minimum de commande, imbrication
de l'atelier) — voir « LE MOTEUR » plus bas. Ces réglages ont été validés avec Quentin le
15/10/2026 ; ils ne se retouchent pas sans relancer `valider.py`.

---

## Stack — décidé, ne pas rediscuter

- **Next.js (App Router) + TypeScript**, déployé sur le VPS Dokploy existant.
- **Aucun backend séparé.** Pas de FastAPI, pas de service Python en production.
- **Tailwind** pour le style. Pas de librairie de composants lourde.
- **Vitest** pour les tests. Les tests d'acceptation plus bas sont non négociables.
- Pas de base de données pour l'instant. Le catalogue et les tarifs sont des fichiers JSON.

Pourquoi Next.js et pas un back Python : le moteur doit tourner **côté client** pour que le
prix bouge en direct quand le client tire un curseur, **et** côté serveur pour que le devis
envoyé par mail soit fiable. Le même code TypeScript sert aux deux. Un aller-retour HTTP à
chaque frappe rendrait le configurateur poussif, et c'est précisément l'argument de vente.

---

## Ce qui est fourni

| Fichier | Rôle |
|---|---|
| `catalogue.json` | Matières, nuances, épaisseurs réellement disponibles, vitesses de coupe réelles (en m/min), 9 formes paramétrées, contraintes |
| `tarifs.json` | Tous les euros et toutes les secondes : **réglages du logiciel ADM** + livraison |
| `golden.json` | 12 devis réels du logiciel ADM avec valeurs intermédiaires attendues |
| `moteur_devis.py` | **La référence.** Le moteur Python, source de vérité. À porter en TS, pas à déployer. |
| `valider.py` | Rejoue les 12 devis contre le moteur Python |
| `generer_golden.py` / `generer_oracle.py` | Recalculent `golden.json` (« attendu ») et `test/fixtures/moteur_oracle.json` (3 000 devis aléatoires) depuis le Python |
| `conseiller_matiere.py` | Questionnaire « quelle matière choisir ? », à porter aussi |
| `DevisConfigurateur.dc.html` | Maquette du configurateur (artboard de design). Référence **visuelle et fonctionnelle**, pas du code de production. |

Le Python reste dans le repo sous `reference/`. Il sert d'oracle : si un jour un prix TS
diverge, on relance le Python pour savoir qui a raison. L'ancien modèle calibré (taux horaire
unique, rectangle englobant, tarif de base 17,11 €) est archivé dans
`archives/calibrage-2026-09-29/`.

---

## LE MOTEUR — spécification exacte

### Principe

Réglages du logiciel de devis ADM, sans grille de remise. La dégressivité vient uniquement
des coûts fixes par commande (frais de plan, bande de chute, minimum) répartis sur la
quantité, et de l'arrondi minute sur la commande entière. Ne jamais ajouter de remise en %
par-dessus. Seule exception, décidée par ADM le 15/10/2026 : l'**atténuation de la
dégressivité** (voir le tableau), qui *réduit* les remises au lieu d'en ajouter.

### Formule

```
geo            = géométrie de la forme (surface nette, périmètre, encombrement, nb de perçages)

# MATIÈRE — imbrication réelle de l'atelier, en colonnes (« bande »)
H              = hauteur de tôle (1500)
rangs          = floor((H − 2×marge_bord + écart) / (h + écart))        écart 10, bord 10
surface_piece  = H × (w + écart) / rangs        meilleure des deux orientations (w, h)
prix_matiere   = surface_piece × épaisseur_masse × densité × prix_kg      [€ / pièce]
bande_chute    = H × (ecart_coupe_chute − écart)    = 1500 × (20 − 10), UNE fois par commande

# DÉCOUPE — vitesses du catalogue, taux du logiciel
temps_piece_s  = perimetre / vitesse_mm_s + percages × temps_percage(épaisseur)
minutes        = ARRONDI(temps_piece_s × quantite)   ← commande entière, règle des 10 s
prix_coupe_cmd = minutes × taux_coupe_eur_min(matière, épaisseur)

# TOTAL
pieces         = prix_matiere × quantite + prix_coupe_cmd
pieces        ×= 1,15 si le plus grand côté > 1000 mm         (grande_piece)
attenuation    = 0 si quantite = 1, sinon 2 % × total d'une pièce seule, PAR pièce
total_ht       = max(pieces + prix(bande_chute) + frais_plan (20 €) + features
                     + attenuation × quantite, 27 €)
total_ht       = arrondi à l'euro SUPÉRIEUR (arrondi_total_ht_eur = 1)
prix_unitaire  = total_ht / quantite
```

| Réglage (`tarifs.json`) | Valeur |
|---|---|
| Prix au kg (brut) | acier 2 €, inox 8 €, alu 9 €, laiton 18 € — nuances : écart relatif d'origine |
| Densités (`catalogue.json`) | acier 8,0 · inox 8,0 · alu 2,7 · laiton 8,5 |
| Taux de coupe €/min (« petite qté » seulement) | acier/inox : ≤4 mm 10,3 · ≤10 mm 7,3 · ≤12 mm 5,9 · ≤15 mm 4,8 — alu/laiton/cuivre : ≤1,5 mm 8,9 · ≤5 mm 7,5 · ≤12 mm 9,6 |
| Vitesses | celles du catalogue (inox 8 mm = 1 m/min, confirmé sur le logiciel de coupe) |
| Perçage (s) | ≤2 mm 0,3 · ≤4 mm 0,6 · ≤6 mm 1 · ≤8 mm 1,5 · ≤10 mm 6 · ≤15 mm 6 (à confirmer) |
| Frais de plan | 20 € par commande, **ajoutés** |
| Minimum de commande | 27 € HT, **plancher**, manutention (chargement, tri) comprise → temps de tri/chargement à 0 |
| Imbrication | 10 mm entre pièces, 10 mm du bord, coupe de chute à 20 mm des pièces |
| Coupe de chute | bande facturée ; **temps de coupe non facturé** (`coupe_chute: false`) — prouvé : 1 pièce 200×200 acier 10 mm = 37 € au logiciel, 36,90 € ainsi, 44,20 € avec le temps |
| Grandes pièces | +15 % sur matière + découpe au-delà de 1 m (compense la chute de tôle des grands formats) |
| Arrondi | `arrondi_total_ht_eur` 1 : total HT des pièces à l'euro supérieur (décision ADM 16/10/2026) ; `arrondi_livraison_eur` 1 : frais d'envoi et supplément du délai à l'euro supérieur. Le détail par pièce affiche une ligne « Arrondi ». |
| Atténuation de la dégressivité | `attenuation_degressivite_pct` 0,02 : la réduction par rapport à 1 pièce baisse de 2 points à toutes les quantités (ex. 100 pièces −69 % → −67 %). Choix commercial : le site devient plus cher que le logiciel ADM dès 2 pièces. Libellé client : « Préparation de série ». 0 = prix du logiciel. |

### Les pièges

**1. L'arrondi minute porte sur la COMMANDE ENTIÈRE, jamais sur chaque pièce.**
Règle de l'atelier : au-delà de 10 secondes entamées, on compte la minute suivante.
5 min 23 s se facturent 6 minutes ; une pièce seule de moins de 10 s de coupe = 0 minute.

```ts
function minutesFacturees(totalSecondes: number): number {
  const m = Math.floor(totalSecondes / 60);
  const s = totalSecondes - m * 60;
  return s > 10 ? m + 1 : m;
}
```

**2. Frais de plan (20 €) et minimum de commande (27 €) sont DEUX choses différentes.**
Le premier s'ajoute une fois par commande, le second est un plancher :
`total = max(pièces + 20 + chute, 27)`. Ne pas fusionner les deux.

**3. La matière se facture sur la tôle consommée, pas au poids net.** La chute intérieure
d'un cadre est payée (cadre 300×300 Ø250 = plaque pleine), et l'écart entre pièces aussi.

### Le coût tôle est à ZÉRO — c'est voulu

Pas de poste « coût tôle » : la tôle est dans la matière (bande) et la manutention dans le
minimum. Si un jour on en rajoute un, il se facture **au prorata** (`quantite /
pieces_par_tole`, décimal), **jamais** par tôle entière avec un `ceil` — sinon la 64ᵉ pièce,
qui ouvre une 2ᵉ tôle, coûte plus cher l'unité que la 63ᵉ.

### Les 9 formes

`rectangle`, `triangle`, `disque`, `rectangle_coupe_coin`, `cadre_coupe_circulaire`,
`cadre_coupe_rectangle`, `demi_disque_allonge`, `trapeze`, `personnalisee`.

Géométrie exacte : voir `geometrie()` dans `moteur_devis.py`. Deux subtilités à ne pas rater :

- `rectangle_coupe_coin` : le créneau ajoute autant de trajet qu'il en retire, le périmètre
  reste `2(L+l)`. Seule la surface change.
- Les deux `cadre_*` comptent **2 perçages** (le contour extérieur + l'amorçage intérieur),
  toutes les autres formes en comptent 1.

---

## Tests d'acceptation — non négociables

`golden.json` contient 12 devis réels sortis du logiciel de devis d'ADM. Les écarts
ci-dessous sont mesurés **sans l'atténuation de la dégressivité** (le test le fait aussi) :
ils mesurent la fidélité au logiciel, pas le choix commercial. Le port TypeScript
doit reproduire chaque `attendu` (calculé par le Python, `generer_golden.py`) **au centime**
(tolérance 0,01 € sur les totaux, 0,1 sur les grandeurs physiques), et les 3 000 devis de
l'oracle Python.

```
devis                              logiciel ADM   moteur     écart
45 platines 300×300 acier 3 mm         330.00 €   354.22 €   +7.3 %
45 platines 300×300 acier 8 mm         836.00 €   888.62 €   +6.3 %
45 cadres 300×300 Ø250 acier 1 mm      138.04 €   145.14 €   +5.1 %
5 platines 300×300 acier 3 mm           50.00 €    58.92 €  +17.8 %
10 platines 300×300 acier 3 mm          91.00 €    97.12 €   +6.7 %
45 platines 300×300 acier 4 mm         450.00 €   479.36 €   +6.5 %
50 platines 300×300 alu 5 mm           929.00 €   930.54 €   +0.2 %
50 platines 300×300 inox 8 mm         3151.00 €  3456.28 €   +9.7 %
9 cadres 1300×1300 int.56 acier 8 mm  2915.10 €  2826.63 €   -3.0 %
1 platine 200×200 acier 10 mm           37.00 €    36.90 €   -0.3 %
10 platines 200×200 acier 10 mm        140.00 €   138.20 €   -1.3 %
100 platines 200×200 acier 10 mm      1145.00 €  1143.90 €   -0.1 %
```

Perçage 8-10 mm porté à 6 s (au lieu de 2 s) : c'est ce qui fait tomber les trois devis
200×200 en 10 mm à moins de 1,3 %, vitesses du catalogue inchangées. 12-15 mm mis à 6 s
par défaut, à confirmer sur un devis réel.

Écart connu, **accepté par ADM le 19/10/2026** : le site est trop cher en 3 mm (≈ 7,5 s de coupe
facturés par le logiciel par platine 300×300 contre 10,1 s ici). On le laisse tel quel. Si un jour
il faut le réduire, **se caler sur les temps de coupe par pièce affichés par le logiciel ADM**,
pas sur des coefficients bidouillés.

`test/golden.test.ts` borne ces écarts : un changement qui les fait sortir doit être expliqué.

---

## Invariants — à tester en propriété, pas seulement en exemple

1. **Le prix unitaire décroît** quand la quantité monte. Vérifier de 1 à 400 pièces.
   (L'arrondi minute sur la commande peut faire remonter l'unitaire de quelques centimes ;
   les tests bornent cet artefact à « une minute répartie sur la commande ». Les versions
   strictes sont désactivées « [À ARBITRER] ».)
2. **Le total croît strictement** quand la quantité monte. De 1 à 400.
3. **Pas de dent de scie aux bascules de tôle.** Tester les quantités 61 à 65 et 126-127 sur
   une pièce dont `pieces_par_tole` vaut 36 ou 63 : l'unitaire ne doit jamais remonter.
4. **Jamais en dessous du coût marginal.** Si une remise commerciale est activée, elle est
   bridée par `marge_minimum_pct`.
5. **Le prix ne peut pas être identique pour 1 et 5 pièces.** C'est le défaut qui avait été
   repéré et corrigé : quand un plancher aplatit toute une plage de quantités, c'est qu'un
   coût fixe manque au modèle. Test de non-régression obligatoire.

---

## Garde-fous — ce que le moteur doit REFUSER

Un refus n'est pas une erreur : c'est un devis à faire à la main. Le message doit être
lisible par un client, en français, et proposer le contact.

- Épaisseur indisponible pour la nuance (galvanisé n'existe qu'en 1/2/3 mm, inox brossé en
  1/2/3/4 mm…). Le message liste les épaisseurs réelles.
- **Trou plus petit que l'épaisseur de la tôle.** En 10 mm, le plus petit trou possible fait
  Ø10 mm. Règle d'atelier, sans exception.
- Pièce hors format tôle (3000 × 1500 mm).
- Cuivre et laiton : `devis_automatique: false`, message de renvoi vers le mail.
- Découpe intérieure plus grande que la pièce.

---

## Le configurateur

`DevisConfigurateur.dc.html` est la maquette de référence. À reproduire en React :

- Choix matière → nuance → épaisseur, **en cascade** : les épaisseurs proposées sont
  seulement celles qui existent pour la nuance choisie. Ne jamais afficher un choix qui sera
  refusé ensuite.
- Choix de la forme parmi les 9, avec **dessin technique SVG coté en direct** : la pièce se
  redessine et les cotes se mettent à jour quand on change un paramètre.
  Utiliser `fill-rule="evenodd"` pour les découpes intérieures.
- Curseurs de cotes bornés par les `min`/`max` de `catalogue.json`.
- Quantité, et **table de paliers** (1, 5, 10, 25, 50, 100) montrant le gain en %.
  L'écart se calcule par rapport à la **quantité courante**, pas par rapport à 1 pièce —
  sinon tous les gros paliers saturent au même pourcentage et le tableau ne dit plus rien.
- Prix affiché : unitaire HT **et** total HT, mis à jour à chaque changement, sans latence.
  **Aucun détail du calcul côté client** (décision ADM 16/10/2026) : ni matière, découpe, frais de
  plan, chute, arrondi… sur le site, la page Stripe ou le mail client. Le détail reste dans les
  mails internes (atelier, demande de devis).
- Bouton « Quelle matière choisir ? » → le questionnaire à 5 questions de
  `conseiller_matiere.py`. Il rend un classement avec, pour chaque nuance, pourquoi elle
  convient **et** les réserves. Garder la règle de l'acier larmé : il reste proposé en
  extérieur (c'est LA tôle à marches) avec la réserve « à galvaniser ou peindre après
  découpe ». L'écarter dehors serait techniquement défendable et commercialement faux.
- Forme « Autres formes » : éditeur de tracé en ligne. **Hors périmètre de cette itération** —
  mettre un renvoi vers le contact, et prévoir l'entrée moteur (`surface_mm2`, `perimetre_mm`,
  `encombrement_x`, `encombrement_y`, `percages`) qui est déjà spécifiée.

---

## Les pages du site

Direction artistique : **pro-moderne**. Un sous-traitant industriel sérieux, pas un gadget.
Sobre, contrasté, typographie lisible, photos d'atelier en grand. Le configurateur est la
pièce maîtresse : tout le reste y conduit.

Palette validée : acier `#1F6E9C`, accent `#D8342A` (mode clair) — `#4E9CC8` / `#F2564A` en
mode sombre.

| Page | Contenu |
|---|---|
| `/` | Accroche, promesse « votre devis en 30 secondes », entrée directe dans le configurateur, trois savoir-faire, preuves (photos, années d'existence), appel au contact |
| `/devis` | Le configurateur, plein écran |
| `/savoir-faire` | Découpe laser, pliage, soudure. Capacités machine, formats, matières, tolérances |
| `/realisations` | Galerie de pièces réelles **(photos à fournir par Quentin — mettre des emplacements clairement marqués, ne pas inventer de fausses réalisations)** |
| `/contact` | Formulaire + coordonnées + plan Vaires-sur-Marne |
| `/mentions-legales`, `/cgv`, `/confidentialite` | **Placeholders explicites.** Textes à fournir, ne pas rédiger de fausses mentions légales. `/confidentialite` contient l'inventaire technique des données (à tenir à jour), pas de texte juridique. |

SEO : métadonnées par page, données structurées `LocalBusiness`, sitemap, `robots.txt`. Cibler
« découpe laser Seine-et-Marne », « découpe laser sur mesure », « tôlerie Vaires-sur-Marne ».
C'est un vrai enjeu commercial, pas une case à cocher.

---

## Commande en ligne et livraison — décidé

- **Paiement Stripe Checkout**, capture **manuelle** : l'argent est bloqué, l'atelier vérifie la
  pièce puis capture (7 jours max) ou annule. Clés de test uniquement en dev (`.env.local`).
- **Mail atelier** à `commandes@adm-laser.fr` (`MAIL_COMMANDES`) : DXF de la pièce, épaisseur,
  quantité, délai, infos client, colis et bordereau(x).
- **Mails client** (`src/lib/mail-commande.ts`) : confirmation après paiement (`mailClient`), puis
  « commande validée » à la capture et « commande annulée » à l'annulation dans Stripe
  (`mailSuiviClient`, événements `payment_intent.succeeded` / `.canceled`, une seule fois chacun,
  jamais pour un paiement abandonné). Aucun détail de calcul dans ces mails.
- **Choix avant paiement (structure validée, ne jamais la masquer) :** 1. retrait à l'atelier,
  gratuit — 2. livraison : 2.1 envoi en colis ou sur palette, 2.2 délai **7 jours + 0 €** ou
  **2 jours + 15 % du prix des pièces**, 2.3 le prix du délai s'ajoute aux frais d'envoi.
- **Frais d'envoi = grille ADM `data/grille-livraison.json`** (tarifs Boxtal du compte ADM,
  15/10/2026, marge et emballage inclus) : prix client HT lus tels quels par tranche de poids
  (1/3/5/10/20/30 kg), arrondis à l'euro supérieur. Poids facturé = poids net × 1,15. Aucune
  livraison gratuite. Remplacer la grille = remplacer ce fichier.
- **Dimensions Colissimo (La Poste, colis emballé = pièces empilées + 2 cm par côté) :** standard
  si L ≤ 100 cm et L+l+h ≤ 150 cm ; **volumineux** si L > 100 cm ou 150 < L+l+h ≤ 200 cm → tarif
  « grand format » de la grille (décision ADM) ; au-delà de 200 cm → palette. Le site choisit le
  découpage en colis le moins cher ; le mail atelier donne les dimensions de chaque colis.
- **Colis :** 30 kg facturés, dimensions Colissimo ci-dessus, plusieurs colis si besoin. **Palette TNT 129,90 € HT**
  proposée dès que la commande dépasse un colis (le client choisit colis ou palette) et seule
  solution si une pièce dépasse 30 kg ou 200 cm cumulés une fois emballée. Limites de la palette (`_calcul.palette_*`) : **120 × 80 × 150 cm, 999 kg**,
  relevées sur la page transporteur Boxtal le 19/10/2026 — une pièce qui déborde du plateau passe
  en livraison sur devis (le retrait reste proposé). 120 cm retenus contre les 130 cm de son guide
  emballage, tranché par ADM le 19/10/2026. null = aucune limite appliquée. Hors zone : Corse et DOM-TOM
  (alerte dans le mail atelier, pas de bordereau).
- **Transport : Boxtal** (API v3, Colissimo Expert ; jeton Bearer obtenu avec les clés via
  `/iam/account-app/token`, testé sur api.boxtal.build le 15/10/2026). Bordereaux colis générés après paiement ;
  la palette se commande à la main sur Boxtal (le mail atelier le rappelle).

---

## Informations manquantes — à demander, pas à inventer

Ne pas combler ces trous avec du plausible. Mettre un `TODO` visible et le signaler.

Tranché par ADM le 19/10/2026 (ne plus demander) : catégorie Boxtal 50380 « chaudronnerie »,
palette TNT 120 cm, **inox 10 mm maximum** (le « 12 mm » d'adm-laser.fr est à corriger sur
l'ancien site), écart de prix en 3 mm accepté, soudure repoussée.

Trouvé sur adm-laser.fr et la fiche Google le 16/10/2026 (ne plus demander) : coordonnées,
SIRET/RCS/TVA, horaires, machines, logo (`public/images/`), photos d'atelier,
11 photos vitrine de pièces fournies par ADM (`public/images/vitrine-*.webp`, 16/10/2026),
note Google 5,0 / 6 avis, **alu 10 mm maximum**.

Encore manquant :
- Hébergeur du NOUVEAU site (société qui héberge le VPS Dokploy) — l'actuel 1&1 ne vaut que pour l'ancien site
- Soudure : procédés, matières et épaisseurs soudées (« TIG/MIG » retiré : non sourcé)
  — reporté par ADM le 19/10/2026, `/savoir-faire` reste volontairement général
- Tolérances de découpe et de pliage
- CGV et mentions de vente à distance (juriste)

---

## Règles de travail

1. **Aucun prix, aucune durée, aucun coefficient en dur dans le code.** Tout vit dans
   `tarifs.json` et `catalogue.json`. Quentin doit pouvoir changer un prix au kg sans
   ouvrir un fichier `.ts`.
2. **Ne pas retoucher les réglages** sans relancer `valider.py`, puis `generer_golden.py` et
   `generer_oracle.py`, et constater que les 12 devis restent dans leurs bornes.
3. **Le moteur est du TypeScript pur**, sans dépendance, dans `lib/devis/`. Il doit pouvoir
   tourner dans un navigateur comme dans un test Node.
4. Les messages d'erreur du moteur sont **destinés au client final** : en français, sans
   jargon, et ils proposent une issue.
5. Tests avant UI. Le moteur porté et vert sur `golden.json` d'abord, l'interface ensuite.

---

## Mise en ligne

`DEPLOIEMENT.md` : Dokploy (Dockerfile, port 3000), variables d'environnement, webhook Stripe
(3 événements), Boxtal production, bascule DNS (sans toucher MX/SPF/DKIM/DMARC, corrects),
contrôles après mise en ligne. `next.config.ts` exclut de l'image `boite-envoi/` (données de test).

## Démarrage attendu

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # les 12 devis golden + l'oracle + les invariants doivent passer
npm run webhook:rejouer   # dev : rejoue le dernier paiement Stripe (test) sur le webhook local
npm run webhook:rejouer -- annulation   # dev : rejoue la dernière annulation (annule les envois Boxtal)
npm run boxtal:categories # vérifie les clés Boxtal et liste les catégories de contenu
```

Test de commande de A à Z en local : payer sur le site avec la carte de test Stripe
4242 4242 4242 4242. Stripe ne peut pas joindre le webhook sur localhost : **en développement**,
la page « Commande reçue » déclenche elle-même le traitement (Boxtal + mails,
`src/lib/traitement-commande.ts`). Chaque paiement n'est traité qu'une fois (marque
`commande_traitee` sur le PaymentIntent). `npm run webhook:rejouer` reste disponible.
Sans SMTP, en développement, les mails sont déposés dans `boite-envoi/`.

La toute première chose à livrer : `npm run test` vert sur `golden.json`. Tant que ce n'est
pas le cas, l'interface ne sert à rien.
