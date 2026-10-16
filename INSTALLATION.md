# Reprendre le projet ADM Laser sur un autre PC

## 1. Installer les outils (une fois)

- **Node.js 22** (LTS) : https://nodejs.org — version 20.9 minimum.
- **Python 3** (facultatif) : seulement pour les scripts de référence du moteur de prix (`reference/`).
- **Claude Code** ou VS Code : ouvrir le dossier du projet. Les consignes du projet sont dans
  `CLAUDE.md` : Claude les lit automatiquement.

## 2. Installer le projet

Dézipper l'archive, puis dans un terminal ouvert dans le dossier `adm-laser-mvp` :

```bash
npm install
```

(Sous Windows PowerShell, si « l'exécution de scripts est désactivée » : utiliser `npm.cmd` à la
place de `npm`.)

## 3. Recréer le fichier des clés `.env.local`

Il n'est PAS dans l'archive : il contient le mot de passe de la messagerie et les clés Stripe et
Boxtal. Deux solutions :

- **Copier** `.env.local` depuis l'ancien PC (dossier `adm-laser-mvp`) par clé USB, puis le
  supprimer de la clé ;
- ou **le recréer** : copier `.env.example` en `.env.local` et remplir les valeurs secrètes
  (`SMTP_PASS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BOXTAL_ACCESS_KEY`, `BOXTAL_SECRET_KEY`).

Sans ce fichier, le site marche mais sans paiement, sans mails et sans Boxtal.

## 4. Lancer

```bash
npm run dev
```

Puis ouvrir http://localhost:3000.

```bash
npm run test
```

Doit afficher environ 760 tests réussis.

## 5. Où en est le projet

- `CLAUDE.md` : toutes les règles et décisions (prix, livraison, mails, informations manquantes).
- `DEPLOIEMENT.md` : la mise en ligne sur Dokploy, étape par étape.
- Test de commande complet : payer avec la carte de test Stripe `4242 4242 4242 4242` ; sans
  mot de passe SMTP, les mails sont écrits dans `boite-envoi/` au lieu d'être envoyés.
