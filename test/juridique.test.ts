import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { site } from "@/lib/site";

describe("pages juridiques", () => {
  it("restent hors du sitemap tant que les textes ne sont pas validés", () => {
    const urls = sitemap().map((p) => p.url);
    const juridiques = urls.filter((u) => /\/(cgv|confidentialite|mentions-legales)$/.test(u));
    expect(juridiques).toHaveLength(site.textesJuridiquesValides ? 3 : 0);
  });

  it("médiateur : soit absent, soit complet (nom, adresse, site en https)", () => {
    const m = site.mediateur;
    if (m) {
      expect(m.nom.trim()).not.toBe("");
      expect(m.adresse.trim()).not.toBe("");
      expect(m.site).toMatch(/^https:\/\//);
    }
  });
});
