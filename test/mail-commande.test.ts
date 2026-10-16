import { describe, expect, it } from "vitest";
import { mailAtelier, mailClient, mailSuiviClient, plusJoursOuvres, referenceCommande, type DonneesCommande } from "@/lib/mail-commande";
import type { Piece } from "@/lib/devis/types";

const piece: Piece = { matiere: "acier", nuance: "brut", epaisseur_mm: 3, forme: "rectangle", dimensions: { longueur: 300, largeur: 200 }, quantite: 10 };

const base: DonneesCommande = {
  reference: "AB12CD34",
  date: new Date("2026-10-16T10:00:00+02:00"), // vendredi
  piece,
  livraison: { cle: "express", libelle: "Expédition en 2 jours", prixHt: "10.00" },
  montantTtc: 91.99,
  lienPaiement: "https://dashboard.stripe.com/test/payments/pi_123",
  client: { nom: "Client Test", societe: "Métal Test SARL", email: "client@exemple.test", telephone: "+33612345678", tva: "FR00123456789" },
  destinataire: { nom: "Client Test", adresse: { ligne1: "1 rue de l'Essai", codePostal: "77360", ville: "Vaires-sur-Marne", pays: "FR" } },
};

describe("mail de commande à l'atelier", () => {
  it("joint le DXF de la pièce, nommé avec la référence, la matière, l'épaisseur et la quantité", () => {
    const m = mailAtelier(base);
    expect(m.piecesJointes).toHaveLength(1);
    expect(m.piecesJointes[0].nom).toBe("ADM-AB12CD34-acier-brut-3mm-x10.dxf");
    expect(m.piecesJointes[0].contenu.toString("ascii")).toMatch(/ENTITIES[\s\S]*LINE[\s\S]*EOF/);
  });

  it("met en avant l'épaisseur, la quantité, le délai et la date limite d'expédition", () => {
    const m = mailAtelier(base);
    expect(m.sujet).toMatch(/\[Commande AB12CD34\] EXPRESS Expédition en 2 jours/);
    expect(m.sujet).toMatch(/10 × Acier brut 3 mm/);
    expect(m.texte).toMatch(/ÉPAISSEUR\s+: 3 mm/);
    expect(m.texte).toMatch(/QUANTITÉ\s+: 10 pièces/);
    // commande le vendredi 16 → 2 jours ouvrés → mardi 20
    expect(m.texte).toMatch(/à expédier au plus tard le mardi 20 octobre 2026/);
  });

  it("donne les informations d'envoi et du client", () => {
    const t = mailAtelier(base).texte;
    expect(t).toMatch(/Envoi\s+: 1 colis — Colissimo Domicile avec signature \(J\+2\) · pièce la plus longue 30 cm/);
    expect(t).toMatch(/colis 1\s+: 10 pièces — 16,56 kg emballage compris/);
    expect(t).toMatch(/1 rue de l'Essai, 77360 Vaires-sur-Marne/);
    expect(t).toMatch(/Métal Test SARL/);
    expect(t).toMatch(/FR00123456789/);
    expect(t).toMatch(/PAIEMENT BLOQUÉ/);
    expect(t).toMatch(/pi_123/);
  });

  it("détaille une commande en plusieurs colis", () => {
    const t = mailAtelier({ ...base, piece: { ...piece, dimensions: { longueur: 300, largeur: 300 }, quantite: 45 } }).texte;
    expect(t).toMatch(/Envoi\s+: 4 colis \(4 envois séparés\)/);
    expect(t).toMatch(/colis 1\s+: 12 pièces — 29,81 kg/);
    expect(t).toMatch(/colis 4\s+: 11 pièces — 27,32 kg/);
  });

  it("pièce de 1,3 m : colis volumineux, dimensions indiquées à l'atelier", () => {
    const t = mailAtelier({ ...base, piece: { ...piece, epaisseur_mm: 1, dimensions: { longueur: 1300, largeur: 100 }, quantite: 1 } }).texte;
    expect(t).toMatch(/Envoi\s+: 1 colis — .* pièce la plus longue 130 cm/);
    expect(t).toMatch(/colis 1\s+: 1 pièce — 1,2 kg emballage compris — 134 × 14 × 5 cm — VOLUMINEUX/);
  });

  it("envoi sur palette : à commander sur Boxtal, signalé dans le sujet", () => {
    const m = mailAtelier({ ...base, piece: { ...piece, dimensions: { longueur: 300, largeur: 300 }, quantite: 45 }, livraison: { ...base.livraison, envoi: "palette" } });
    expect(m.sujet).toMatch(/PALETTE/);
    expect(m.texte).toMatch(/Envoi\s+: PALETTE — TNT Express National Palette \(J\+3\) · 111,8 kg facturés/);
    expect(m.texte).toMatch(/commander la palette sur le compte Boxtal/);
    expect(m.texte).not.toMatch(/colis 1/);
  });

  it("adresse en Corse ou DOM-TOM : alerte hors zone", () => {
    const m = mailAtelier({ ...base, destinataire: { nom: "Client", adresse: { ligne1: "1 rue X", codePostal: "20000", ville: "Ajaccio" } } });
    expect(m.texte).toMatch(/HORS ZONE : 20000/);
    expect(mailAtelier(base).texte).not.toMatch(/HORS ZONE/);
  });

  it("retrait à l'atelier : pas d'envoi, pas de bordereau, prévenir le client", () => {
    const m = mailAtelier({ ...base, livraison: { cle: "retrait", libelle: "Retrait à l'atelier", prixHt: "0.00" }, destinataire: null });
    expect(m.sujet).toMatch(/RETRAIT ATELIER/);
    expect(m.texte).toMatch(/RETRAIT À L'ATELIER — pas d'envoi, pas de bordereau/);
    expect(m.texte).toMatch(/prévenir le client/);
    expect(m.texte).not.toMatch(/Bordereau/);
    expect(m.texte).not.toMatch(/à expédier au plus tard/);
    expect(m.piecesJointes.map((p) => p.nom)).toEqual(["ADM-AB12CD34-acier-brut-3mm-x10.dxf"]);
  });

  it("une épaisseur décimale reste lisible dans le nom de fichier", () => {
    const m = mailAtelier({ ...base, piece: { ...piece, nuance: "corten", epaisseur_mm: 1.5 } });
    expect(m.piecesJointes[0].nom).toBe("ADM-AB12CD34-acier-corten-1,5mm-x10.dxf");
  });

  it("joint le bordereau Boxtal quand il est prêt", () => {
    const m = mailAtelier({ ...base, bordereau: { colis: [{ pdf: Buffer.from("%PDF-1.4"), idBoxtal: "2440000000POFR", prixHt: 8.9, livraisonEstimee: "2026-10-22" }] } });
    expect(m.piecesJointes.map((p) => p.nom)).toEqual(["ADM-AB12CD34-acier-brut-3mm-x10.dxf", "ADM-AB12CD34-bordereau.pdf"]);
    expect(m.texte).toMatch(/Bordereau\s+: ADM-AB12CD34-bordereau\.pdf \(joint\) — réf\. Boxtal 2440000000POFR · transport 8,90 € HT · livraison estimée le jeudi 22 octobre 2026/);
  });

  it("un bordereau par colis", () => {
    const pdf = Buffer.from("%PDF-1.4");
    const m = mailAtelier({
      ...base,
      piece: { ...piece, dimensions: { longueur: 300, largeur: 300 }, quantite: 45 },
      bordereau: { colis: [{ pdf, idBoxtal: "A" }, { pdf, idBoxtal: "B" }, { pdf, idBoxtal: "C" }, { idBoxtal: "D", erreur: "pas encore prêt" }] },
    });
    expect(m.piecesJointes.map((p) => p.nom).slice(1)).toEqual([
      "ADM-AB12CD34-bordereau-1-sur-4.pdf",
      "ADM-AB12CD34-bordereau-2-sur-4.pdf",
      "ADM-AB12CD34-bordereau-3-sur-4.pdf",
    ]);
    expect(m.texte).toMatch(/Bordereau 4\/4: NON GÉNÉRÉ — pas encore prêt — réf\. Boxtal D/);
  });

  it("dit pourquoi le bordereau manque", () => {
    const m = mailAtelier({ ...base, bordereau: { raison: "clés Boxtal absentes" } });
    expect(m.piecesJointes).toHaveLength(1);
    expect(m.texte).toMatch(/Bordereau\s+: NON GÉNÉRÉ — clés Boxtal absentes/);
  });

  it("reste lisible si la configuration est illisible", () => {
    const m = mailAtelier({ ...base, piece: null });
    expect(m.piecesJointes).toHaveLength(0);
    expect(m.texte).toMatch(/pas de DXF/);
  });
});

describe("utilitaires", () => {
  it("jours ouvrés : le week-end ne compte pas", () => {
    const vendredi = new Date("2026-10-16T10:00:00+02:00");
    expect(plusJoursOuvres(vendredi, 2).getDate()).toBe(20);
    expect(plusJoursOuvres(vendredi, 5).getDate()).toBe(23);
  });

  it("référence courte depuis l'identifiant Stripe", () => {
    expect(referenceCommande("cs_test_a1hBFDSQudENXf9qXLgTzv1uRxne")).toBe("ZV1URXNE");
    expect(referenceCommande("cs_live_ABCDEFGH12345678")).toBe("12345678");
  });
});

it("pas de ligne vide parasite dans le bloc expédition", () => {
  const t = mailAtelier(base).texte;
  expect(t).not.toMatch(/Adresse\s+: .*\n\n\s+Téléphone/);
});

describe("mail de confirmation au client", () => {
  it("récapitule la commande et les étapes, sans rien d'interne", () => {
    const m = mailClient(base);
    expect(m.sujet).toBe("ADM Laser — votre commande AB12CD34 est bien reçue");
    expect(m.texte).toMatch(/Bonjour Client Test,/);
    expect(m.texte).toMatch(/Quantité\s+: 10 pièces/);
    expect(m.texte).toMatch(/Prix\s+: 79,00 € HT\n/);
    expect(m.texte).toMatch(/Total payé\s+: 150,00 € TTC|Total payé\s+: [\d ,]+ € TTC\n/);
    expect(m.texte).toMatch(/Livraison\s+: Expédition en 2 jours — 1 colis Colissimo — 10,00 € HT/);
    expect(m.texte).toMatch(/Livré à\s+: .*1 rue de l'Essai, 77360 Vaires-sur-Marne/);
    expect(m.texte).toMatch(/il n'est débité qu'après cette/);
    expect(m.texte).toMatch(/Expédition prévue au plus tard le mardi 20 octobre 2026/);
    // rien d'interne : ni temps machine, ni coûts de revient, ni lien Stripe
    expect(m.texte).not.toMatch(/min factur|pièces par tôle|Masse facturée|stripe\.com|frais de plan|la pièce|matière \d|découpe \d/i);
  });

  it("retrait à l'atelier : adresse et horaires, pas de date d'expédition", () => {
    const m = mailClient({ ...base, livraison: { cle: "retrait", libelle: "Retrait à l'atelier", prixHt: "0.00" }, destinataire: null });
    expect(m.texte).toMatch(/Livraison\s+: Retrait à l'atelier — gratuit/);
    expect(m.texte).toMatch(/3 Impasse de la Centrale, 77360 Vaires-sur-Marne/);
    expect(m.texte).toMatch(/lundi – jeudi 07h30–17h00/);
    expect(m.texte).not.toMatch(/Expédition prévue/);
  });
});

describe("mails de suivi au client (capture / annulation dans Stripe)", () => {
  it("validée : en fabrication, montant débité, date d'expédition", () => {
    const m = mailSuiviClient(base, "validee");
    expect(m.sujet).toBe("ADM Laser — votre commande AB12CD34 est validée");
    expect(m.texte).toMatch(/notre atelier a validé votre commande AB12CD34 \(10 × Acier brut · 3 mm · Rectangle\)/);
    expect(m.texte).toMatch(/a été débité/);
    expect(m.texte).toMatch(/Expédition prévue au plus tard le mardi 20 octobre 2026/);
  });

  it("validée en retrait : on prévient quand c'est prêt, pas de date d'expédition", () => {
    const m = mailSuiviClient({ ...base, livraison: { cle: "retrait", libelle: "Retrait à l'atelier", prixHt: "0.00" } }, "validee");
    expect(m.texte).toMatch(/prête à retirer à l'atelier : 3 Impasse de la Centrale/);
    expect(m.texte).not.toMatch(/Expédition prévue/);
  });

  it("annulée : montant libéré, rien de débité, invitation à recontacter", () => {
    const m = mailSuiviClient(base, "annulee");
    expect(m.sujet).toBe("ADM Laser — votre commande AB12CD34 est annulée");
    expect(m.texte).toMatch(/a été libéré : rien n'a été débité/);
    expect(m.texte).toMatch(/contactez-nous/);
  });
});
