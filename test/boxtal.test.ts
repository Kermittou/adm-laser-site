import { describe, expect, it } from "vitest";
import { CONFIG_BOXTAL, construireExpedition, dimensionsColis, separerAdresse, separerNom, telephoneInternational } from "@/lib/boxtal";
import { calculer } from "@/lib/devis/moteur";
import type { Piece } from "@/lib/devis/types";

const piece: Piece = { matiere: "acier", nuance: "brut", epaisseur_mm: 3, forme: "rectangle", dimensions: { longueur: 300, largeur: 200 }, quantite: 10 };
const r = calculer(piece);
const cfg = { ...CONFIG_BOXTAL, categorie_contenu: "content:v1:99999" };

const demande = {
  reference: "AB12CD34",
  resultat: r,
  epaisseurMm: 3,
  valeurHt: r.total_ht,
  dateRemise: "2026-10-20",
  destinataire: {
    nom: "Jean-Pierre Dupont",
    societe: "Métal Test SARL",
    email: "client@exemple.test",
    telephone: "06 12 34 56 78",
    ligne1: "12 bis rue de l'Essai",
    ligne2: "Bâtiment B",
    codePostal: "77360",
    ville: "Vaires-sur-Marne",
    pays: "FR",
  },
};

describe("Boxtal — colis", () => {
  it("dimensions : pièces empilées + 2 cm d'emballage de chaque côté, poids facturé (pièces × 1,15)", () => {
    // 300 × 200 mm, 10 × 3 mm = 3 cm de pile
    expect(dimensionsColis(r, 3)).toEqual({ length: 34, width: 24, height: 7, weight: 16.56 });
  });

  it("une pièce longue donne la longueur du colis", () => {
    const long = calculer({ ...piece, dimensions: { longueur: 980, largeur: 120 }, quantite: 2 });
    expect(dimensionsColis(long, 3).length).toBe(102);
  });
});

describe("Boxtal — utilitaires d'adresse", () => {
  it.each([
    ["12 bis rue de l'Essai", { number: "12 bis", street: "rue de l'Essai" }],
    ["3 Impasse de la Centrale", { number: "3", street: "Impasse de la Centrale" }],
    ["ZAC du Gué de Launay", { street: "ZAC du Gué de Launay" }],
  ])("%s", (ligne, attendu) => {
    expect(separerAdresse(ligne)).toEqual(attendu);
  });

  it("prénom / nom", () => {
    expect(separerNom("Jean-Pierre Dupont")).toEqual({ firstName: "Jean-Pierre", lastName: "Dupont" });
    expect(separerNom("Marie Claire Martin")).toEqual({ firstName: "Marie Claire", lastName: "Martin" });
    expect(separerNom("Dupont")).toEqual({ firstName: "Dupont", lastName: "Dupont" });
  });

  it("téléphone au format international", () => {
    expect(telephoneInternational("06 12 34 56 78")).toBe("+33612345678");
    expect(telephoneInternational("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(telephoneInternational("0033612345678")).toBe("+33612345678");
    expect(telephoneInternational("")).toBeNull();
  });
});

describe("Boxtal — requête de création d'expédition", () => {
  it("respecte le schéma POST /shipping/v3.1/shipping-order", () => {
    const b = construireExpedition(demande, cfg);
    expect(b.shippingOfferCode).toBe("POFR-ColissimoExpert");
    expect(b.expectedTakingOverDate).toBe("2026-10-20");
    expect(b.shipment.externalId).toBe("AB12CD34");
    const [colis] = b.shipment.packages;
    expect(colis).toMatchObject({ type: "PARCEL", length: 34, width: 24, height: 7, weight: 16.56, value: { value: 79, currency: "EUR" } });
    expect(colis.content.id).toBe("content:v1:99999");
    expect(b.shipment.toAddress).toEqual({
      type: "BUSINESS",
      contact: { email: "client@exemple.test", phone: "+33612345678", company: "Métal Test SARL", firstName: "Jean-Pierre", lastName: "Dupont" },
      location: { number: "12 bis", street: "rue de l'Essai", postalCode: "77360", city: "Vaires-sur-Marne", countryIsoCode: "FR" },
      additionalInformation: "Bâtiment B",
    });
    expect(b.shipment.fromAddress.location).toEqual({
      number: "3",
      street: "Impasse de la Centrale",
      postalCode: "77360",
      city: "Vaires-sur-Marne",
      countryIsoCode: "FR",
    });
  });

  it("un envoi par colis : quantité, poids, valeur au prorata, référence numérotée", () => {
    const r45 = calculer({ ...piece, dimensions: { longueur: 300, largeur: 300 }, quantite: 45 });
    const b = construireExpedition({ ...demande, resultat: r45, valeurHt: r45.total_ht, colis: { quantite: 12, numero: 1, total: 4 } }, cfg);
    const [colis] = b.shipment.packages;
    expect(b.shipment.externalId).toBe("AB12CD34-1");
    expect(colis).toMatchObject({ length: 34, width: 34, height: 8, weight: 29.808 });
    expect(colis.value.value).toBeCloseTo((388 * 12) / 45, 2);
  });

  it("particulier : adresse résidentielle, pas de société", () => {
    const b = construireExpedition({ ...demande, destinataire: { ...demande.destinataire, societe: null } }, cfg);
    expect(b.shipment.toAddress.type).toBe("RESIDENTIAL");
    expect(b.shipment.toAddress.contact).not.toHaveProperty("company");
  });

  it("refuse clairement si la catégorie de contenu n'est pas configurée", () => {
    expect(() => construireExpedition(demande, { ...cfg, categorie_contenu: null })).toThrow(/catégorie de contenu/);
  });

  it("refuse clairement sans téléphone destinataire", () => {
    expect(() => construireExpedition({ ...demande, destinataire: { ...demande.destinataire, telephone: null } }, cfg)).toThrow(/téléphone/);
  });
});
