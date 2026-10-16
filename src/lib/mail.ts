import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { site } from "@/lib/site";

/**
 * Envoi de mail via SMTP. Configuration par variables d'environnement (voir .env.example) :
 * aucun identifiant dans le code.
 */
export function smtpConfigure(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Sans SMTP, en développement uniquement : les mails sont écrits dans boite-envoi/ (un dossier par
 * mail : message.txt + pièces jointes) au lieu d'être perdus. Jamais en production.
 */
export function boiteEnvoiLocale(): boolean {
  return !smtpConfigure() && process.env.NODE_ENV !== "production";
}

/** Un mail peut partir : SMTP configuré, ou boîte d'envoi locale en développement. */
export function mailPossible(): boolean {
  return smtpConfigure() || boiteEnvoiLocale();
}

const nomSur = (s: string) => s.normalize("NFD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 80);

async function deposerDansBoiteEnvoi(m: Parameters<typeof envoyerMail>[0], de: string, a: string): Promise<void> {
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const dossier = path.join(process.cwd(), "boite-envoi", `${horodatage}-${nomSur(m.sujet)}`);
  await mkdir(dossier, { recursive: true });
  const entete = [`De : ${de}`, `À : ${a}`, m.repondreA ? `Répondre à : ${m.repondreA}` : null, `Sujet : ${m.sujet}`]
    .concat(m.piecesJointes?.length ? [`Pièces jointes : ${m.piecesJointes.map((p) => p.nom).join(", ")}`] : [])
    .filter(Boolean)
    .join("\n");
  await writeFile(path.join(dossier, "message.txt"), `${entete}\n\n${m.texte}\n`, "utf-8");
  for (const p of m.piecesJointes ?? []) await writeFile(path.join(dossier, nomSur(p.nom)), p.contenu);
  console.info(`[mail] SMTP non configuré (développement) : mail déposé dans ${dossier}`);
}

export async function envoyerMail(message: {
  sujet: string;
  texte: string;
  /** Par défaut : l'atelier (MAIL_TO, sinon le mail de contact). */
  destinataire?: string;
  repondreA?: string;
  piecesJointes?: { nom: string; contenu: Buffer; type?: string }[];
}): Promise<void> {
  // || et non ?? : une variable présente mais vide dans .env (MAIL_FROM=) doit retomber sur le défaut.
  const de = process.env.MAIL_FROM || `"Site ${site.nom}" <${process.env.SMTP_USER || "non-configure"}>`;
  const a = message.destinataire || process.env.MAIL_TO || site.email;
  if (boiteEnvoiLocale()) return deposerDansBoiteEnvoi(message, de, a);

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transport.sendMail({
    from: de,
    to: a,
    replyTo: message.repondreA,
    subject: message.sujet,
    text: message.texte,
    attachments: message.piecesJointes?.map((p) => ({ filename: p.nom, content: p.contenu, contentType: p.type })),
  });
  console.info(`[mail] envoyé à ${a} : ${message.sujet}${message.piecesJointes?.length ? ` (${message.piecesJointes.length} pièce(s) jointe(s))` : ""}`);
}
