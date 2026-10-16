# Mise en ligne du site ADM Laser (Dokploy)

Guide pas à pas pour passer du site de test (sur le PC) au vrai site sur adm-laser.fr.
Tout ce qui est marqué **[ADM]** demande un accès ou une décision d'ADM.

---

## 0. Avant de commencer — à avoir sous la main

| Élément | Où le trouver | État |
|---|---|---|
| CGV + mentions de vente à distance + politique de confidentialité | juriste **[ADM]** | à rédiger — sans CGV, ne pas ouvrir la vente |
| Hébergeur du serveur Dokploy (pour les mentions légales) | facture du serveur **[ADM]** | à fournir |
| Clés Stripe **live** (`sk_live_…`) | dashboard.stripe.com → Développeurs → Clés API **[ADM]** | compte Stripe à activer |
| Clés Boxtal **production** | developer.boxtal.com → application API v3 en production **[ADM]** | à créer |
| Mot de passe de commandes@adm-laser.fr | espace client IONOS **[ADM]** | déjà en place en test |

---

## 1. Créer l'application dans Dokploy

1. Dokploy → **Create Application** → source : le dépôt Git du projet (ou upload du dossier).
2. **Build type : Dockerfile** (le fichier `Dockerfile` est à la racine du projet).
   - Le build lance les tests (`npm run test`) : s'ils échouent, rien n'est déployé.
   - Build argument (facultatif) : `NEXT_PUBLIC_SITE_URL=https://www.adm-laser.fr`.
3. **Port : 3000.**
4. **Domains** : ajouter `www.adm-laser.fr` et `adm-laser.fr`, HTTPS activé (certificat Let's Encrypt
   automatique), et rediriger `adm-laser.fr` vers `www.adm-laser.fr`.

## 2. Variables d'environnement (onglet Environment de Dokploy)

Jamais dans le code ni dans le Dockerfile. Le fichier `.env.local` du PC ne part PAS sur le serveur.

```
NEXT_PUBLIC_SITE_URL=https://www.adm-laser.fr

# Stripe — clés LIVE en production
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…            # donné par Stripe à l'étape 3

# Mails (IONOS)
SMTP_HOST=smtp.ionos.fr
SMTP_PORT=587
SMTP_USER=commandes@adm-laser.fr
SMTP_PASS=…                              # mot de passe de la boîte ; un « $ » s'écrit « \$ »
MAIL_FROM="ADM Laser" <commandes@adm-laser.fr>
MAIL_TO=contact@adm-laser.fr             # formulaires contact / devis
MAIL_COMMANDES=commandes@adm-laser.fr    # commandes payées (DXF + bordereaux)

# Boxtal — PRODUCTION
BOXTAL_ACCESS_KEY=…
BOXTAL_SECRET_KEY=…
BOXTAL_API_URL=https://api.boxtal.com
```

> En production, sans SMTP valide, les mails ne partent pas (la boîte d'envoi locale
> `boite-envoi/` n'existe qu'en développement).

## 3. Brancher le webhook Stripe (indispensable)

Sans lui, une commande payée ne déclenche NI le mail atelier, NI le bordereau, NI les mails client.

1. dashboard.stripe.com (mode **live**) → Développeurs → Webhooks → **Ajouter un endpoint**.
2. URL : `https://www.adm-laser.fr/api/stripe/webhook`
3. Événements à cocher :
   - `checkout.session.completed` — commande payée → Boxtal + mail atelier + confirmation client
   - `payment_intent.succeeded` — paiement capturé par l'atelier → mail « commande validée »
   - `payment_intent.canceled` — paiement annulé → envois Boxtal annulés + mail « commande annulée »
4. Copier le **secret de signature** (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET` (étape 2), redéployer.

## 4. Boxtal en production

1. `BOXTAL_API_URL=https://api.boxtal.com` et les clés de production (étape 2).
2. Vérifier les clés et la catégorie de contenu, depuis le PC avec les clés de prod dans `.env.local` :
   `npm run boxtal:categories` → mettre l'id retenu dans `data/expedition.json` (`categorie_contenu`).
3. Vérifier `data/expedition.json` → `expediteur` (adresse et téléphone de l'atelier).

## 5. Basculer le domaine

Aujourd'hui `adm-laser.fr` pointe sur IONOS (`217.160.0.56`, `www` → `217.160.0.222`).

1. Espace IONOS → Domaines → adm-laser.fr → DNS : remplacer les enregistrements **A** de `@` et `www`
   par l'adresse IP du serveur Dokploy.
2. **Ne pas toucher** aux enregistrements MX, SPF (`v=spf1 include:_spf-eu.ionos.com ~all`), DKIM
   (`s1-ionos._domainkey`, `s2-ionos._domainkey`) et DMARC : ils font marcher les mails, et sont corrects.
3. Attendre la propagation (quelques minutes à quelques heures), puis vérifier le cadenas HTTPS.

## 6. Contrôles après mise en ligne

- [ ] Les pages s'affichent : accueil, devis, savoir-faire, matières, réalisations, contact, mentions légales, CGV, confidentialité.
- [ ] Formulaire de contact → mail reçu sur `MAIL_TO`.
- [ ] Une vraie commande de faible montant, en **retrait atelier** : mail atelier + mail client reçus,
      puis **Annuler** dans Stripe → mail « commande annulée » reçu, aucun débit.
- [ ] Une commande en **livraison colis** : bordereau Boxtal joint au mail atelier ; annuler ensuite.
- [ ] Google Search Console : déclarer `https://www.adm-laser.fr/sitemap.xml`.
- [ ] Une fois les textes du juriste en place : retirer le `noindex` des pages juridiques et les
      ajouter au sitemap (`src/app/sitemap.ts`).

## 7. Au quotidien

- Chaque commande arrive sur commandes@ avec le DXF et le(s) bordereau(x).
- Dans Stripe : **Capturer** (le client reçoit « commande validée ») ou **Annuler** (le client reçoit
  « commande annulée », les envois Boxtal sont annulés). Capture possible pendant 7 jours maximum.
- Palette : à commander à la main sur Boxtal (le mail atelier le rappelle).
- Modifier un prix au kg, un taux de coupe, la grille de livraison : fichiers `data/*.json`, puis
  `npm run test` et redéployer (voir CLAUDE.md, « Règles de travail »).
