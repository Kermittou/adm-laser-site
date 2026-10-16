/**
 * Vérifie les clés Boxtal (.env.local) et liste les catégories de contenu (lecture seule).
 *   npm run boxtal:categories                → toutes les catégories
 *   npm run boxtal:categories -- metal       → filtrées sur un mot
 * L'id choisi va dans data/expedition.json → categorie_contenu.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2")]),
);
const base = (env.BOXTAL_API_URL || "https://api.boxtal.build").replace(/\/$/, "");
if (!env.BOXTAL_ACCESS_KEY || !env.BOXTAL_SECRET_KEY) {
  console.error("BOXTAL_ACCESS_KEY / BOXTAL_SECRET_KEY manquantes dans .env.local");
  process.exit(1);
}

const basic = Buffer.from(`${env.BOXTAL_ACCESS_KEY}:${env.BOXTAL_SECRET_KEY}`).toString("base64");
const t = await fetch(`${base}/iam/account-app/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, Accept: "application/json" } });
if (!t.ok) {
  console.error(`Authentification refusée par ${base} : ${t.status} ${await t.text()}`);
  process.exit(1);
}
const { accessToken, expiresIn } = await t.json();
console.log(`Authentification OK sur ${base} (jeton valable ${expiresIn} s)`);

const r = await fetch(`${base}/shipping/v3.1/content-category`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
const corps = await r.json();
if (!r.ok) {
  console.error(`Catégories : ${r.status} ${JSON.stringify(corps).slice(0, 500)}`);
  process.exit(1);
}
const filtre = (process.argv[2] ?? "").toLowerCase();
const liste = (corps.content ?? corps).filter((c) => !filtre || JSON.stringify(c).toLowerCase().includes(filtre));
for (const c of liste) console.log(`${c.id}\t${c.label ?? c.name ?? JSON.stringify(c)}`);
console.log(`${liste.length} catégorie(s)`);
