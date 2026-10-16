// Envoie un mail de test (l'exemple de commande atelier, DXF joint) pour vérifier la configuration SMTP.
// Usage : npm run mail:test            → vers MAIL_COMMANDES, sinon commandes@adm-laser.fr
//         npm run mail:test -- a@b.fr  → vers une autre adresse
import fs from "node:fs";
import nextEnv from "@next/env";
import nodemailer from "nodemailer";

// Lecture de .env.local par Next.js lui-même : mêmes règles que le site (guillemets, « \$ »…).
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const env = process.env;

for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
  if (!env[k]) {
    console.error(`✗ ${k} est vide dans .env.local — rien n'a été envoyé.`);
    process.exit(1);
  }
}

const destinataire = process.argv[2] || env.MAIL_COMMANDES || "commandes@adm-laser.fr";
const port = Number(env.SMTP_PORT || 587);
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

const exemple = fs.readFileSync("exemples-commande/mail-atelier-exemple.txt", "utf8");
const objet = exemple.match(/^Objet : (.*)$/m)?.[1] ?? "Commande exemple";
const corps = exemple.split(/\r?\n\r?\n/).slice(1).join("\n\n");
const dxf = fs.readdirSync("exemples-commande").find((f) => /^ADM-.*\.dxf$/.test(f));

await transport.verify();
const info = await transport.sendMail({
  from: env.MAIL_FROM || `"Site ADM Laser" <${env.SMTP_USER}>`,
  to: destinataire,
  subject: `[TEST] ${objet}`,
  text: `Mail de TEST envoyé depuis le site en développement — aucune commande réelle.\n\n${corps}`,
  attachments: dxf ? [{ filename: dxf, path: `exemples-commande/${dxf}` }] : [],
});
console.log(`✓ Mail de test envoyé à ${destinataire} (${info.messageId})${dxf ? `, pièce jointe ${dxf}` : ""}.`);
