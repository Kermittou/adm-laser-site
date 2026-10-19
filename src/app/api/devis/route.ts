import { NextResponse } from "next/server";
import { ipDe, sansCaracteresDeControle, tropDEnvois } from "@/lib/anti-abus";
import { devis, tarifs } from "@/lib/devis/moteur";
import { texteDevis, libellePiece } from "@/lib/devis/resume";
import type { Piece } from "@/lib/devis/types";
import { envoyerMail, mailPossible } from "@/lib/mail";
import { site } from "@/lib/site";

export const runtime = "nodejs";

const erreur = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });
const repli = `Écrivez-nous directement à ${site.email} ou appelez le ${site.telephone}.`;

type Corps = {
  piece?: Partial<Piece>;
  contact?: { nom?: string; email?: string; telephone?: string; message?: string; consentement?: boolean; site_web?: string };
};

export async function POST(req: Request) {
  if (tropDEnvois(ipDe(req))) return erreur(`Trop d'envois en peu de temps. ${repli}`, 429);

  let corps: Corps;
  try {
    corps = (await req.json()) as Corps;
  } catch {
    return erreur("La demande n'a pas pu être lue. Réessayez.");
  }

  const c = corps.contact ?? {};
  // Champ piège invisible : un robot le remplit, un humain non.
  if ((c.site_web ?? "").trim() !== "") return NextResponse.json({ ok: true });

  const nom = sansCaracteresDeControle(c.nom ?? "");
  const email = (c.email ?? "").trim();
  const telephone = (c.telephone ?? "").trim();
  const message = (c.message ?? "").trim();
  if (!nom || nom.length > 120) return erreur("Indiquez votre nom.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return erreur("Votre adresse mail ne semble pas valide.");
  if (telephone.length > 40) return erreur("Le numéro de téléphone est trop long.");
  if (message.length > 3000) return erreur("Votre message est trop long (3 000 caractères maximum).");
  if (c.consentement !== true) return erreur("Merci d'accepter que nous utilisions vos coordonnées pour vous répondre.");

  // Le prix est RECALCULÉ ici avec le même moteur : on ne fait jamais confiance au prix du navigateur.
  const p = corps.piece ?? {};
  const piece: Piece = {
    matiere: String(p.matiere ?? ""),
    nuance: String(p.nuance ?? ""),
    epaisseur_mm: Number(p.epaisseur_mm),
    forme: String(p.forme ?? ""),
    dimensions: Object.fromEntries(Object.entries(p.dimensions ?? {}).map(([k, v]) => [k, Number(v)])),
    quantite: Number(p.quantite),
  };
  const resultat = devis(piece);
  if (!resultat.ok) return erreur(resultat.message);

  if (!mailPossible()) {
    console.error("[devis] SMTP non configuré : demande non envoyée.");
    return erreur(`L'envoi en ligne est momentanément indisponible. ${repli}`, 503);
  }

  try {
    await envoyerMail({
      sujet: `[Devis en ligne] ${piece.quantite} × ${libellePiece(piece)} — ${resultat.total_ht.toFixed(2)} € HT`,
      repondreA: email,
      texte: [
        `Demande de devis depuis le configurateur.`,
        "",
        `Nom : ${nom}`,
        `Mail : ${email}`,
        `Téléphone : ${telephone || "—"}`,
        "",
        texteDevis(piece, resultat, tarifs.tva_taux),
        "",
        "Message du client :",
        message || "—",
      ].join("\n"),
    });
  } catch (e) {
    console.error("[devis] échec d'envoi", e);
    return erreur(`Votre demande n'a pas pu partir. ${repli}`, 502);
  }

  return NextResponse.json({ ok: true, total_ht: resultat.total_ht });
}
