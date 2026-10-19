import { NextResponse } from "next/server";
import { ipDe, sansCaracteresDeControle, tropDEnvois } from "@/lib/anti-abus";
import { envoyerMail, mailPossible } from "@/lib/mail";
import { site } from "@/lib/site";

export const runtime = "nodejs";

const TAILLE_MAX_PJ = 10 * 1024 * 1024;
const EXTENSIONS_PJ = ["dxf", "dwg", "pdf", "step", "stp", "png", "jpg", "jpeg"];

const erreur = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });
const repli = `Écrivez-nous directement à ${site.email} ou appelez le ${site.telephone}.`;

export async function POST(req: Request) {
  // En premier : inutile de lire une pièce jointe de 10 Mo pour la jeter ensuite.
  if (tropDEnvois(ipDe(req))) return erreur(`Trop d'envois en peu de temps. ${repli}`, 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return erreur("Le formulaire n'a pas pu être lu. Réessayez.");
  }

  // Champ piège invisible : un robot le remplit, un humain non. On répond « ok » sans rien envoyer.
  if (String(form.get("site_web") ?? "").trim() !== "") return NextResponse.json({ ok: true });

  const nom = sansCaracteresDeControle(String(form.get("nom") ?? ""));
  const email = String(form.get("email") ?? "").trim();
  const telephone = String(form.get("telephone") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const consentement = form.get("consentement") === "on";
  const fichier = form.get("plan");

  if (!nom || nom.length > 120) return erreur("Indiquez votre nom.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return erreur("Votre adresse mail ne semble pas valide.");
  if (telephone.length > 40) return erreur("Le numéro de téléphone est trop long.");
  if (message.length < 5 || message.length > 5000) return erreur("Décrivez votre besoin en quelques mots (5 000 caractères maximum).");
  if (!consentement) return erreur("Merci d'accepter que nous utilisions vos coordonnées pour vous répondre.");

  const piecesJointes: { nom: string; contenu: Buffer; type?: string }[] = [];
  if (fichier instanceof File && fichier.size > 0) {
    const ext = fichier.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSIONS_PJ.includes(ext)) return erreur(`Format de fichier non accepté. Formats possibles : ${EXTENSIONS_PJ.join(", ").toUpperCase()}.`);
    if (fichier.size > TAILLE_MAX_PJ) return erreur(`Le fichier dépasse 10 Mo. Envoyez-le directement à ${site.email}.`);
    piecesJointes.push({ nom: fichier.name, contenu: Buffer.from(await fichier.arrayBuffer()), type: fichier.type || undefined });
  }

  if (!mailPossible()) {
    console.error("[contact] SMTP non configuré : message non envoyé.");
    return erreur(`L'envoi en ligne est momentanément indisponible. ${repli}`, 503);
  }

  try {
    await envoyerMail({
      sujet: `[Site] Demande de ${nom}${piecesJointes.length ? " — plan joint" : ""}`,
      repondreA: email,
      texte: [
        `Nom : ${nom}`,
        `Mail : ${email}`,
        `Téléphone : ${telephone || "—"}`,
        `Pièce jointe : ${piecesJointes[0]?.nom ?? "aucune"}`,
        "",
        message,
      ].join("\n"),
      piecesJointes,
    });
  } catch (e) {
    console.error("[contact] échec d'envoi", e);
    return erreur(`Votre message n'a pas pu partir. ${repli}`, 502);
  }

  return NextResponse.json({ ok: true });
}
