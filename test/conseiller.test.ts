import { describe, expect, it } from "vitest";
import { conseiller, recommander, type Reponses } from "@/lib/conseiller";
import oracle from "./fixtures/conseiller_oracle.json";

// Fixture générée par reference/conseiller_matiere.py sur les 576 combinaisons de réponses.
type CasOracle = {
  reponses: Reponses;
  classement: { matiere: string; nuance: string; score: number; raisons: string[]; reserves: string[] }[];
};

describe("conseiller matière — identique à l'oracle Python", () => {
  it.each((oracle as unknown as CasOracle[]).map((c) => [JSON.stringify(c.reponses), c] as const))("%s", (_, cas) => {
    const ts = conseiller(cas.reponses).map(({ matiere, nuance, score, raisons, reserves }) => ({
      matiere,
      nuance,
      score,
      raisons,
      reserves,
    }));
    expect(ts).toEqual(cas.classement);
  });
});

describe("règles métier du conseiller", () => {
  it("garde l'acier larmé pour une marche extérieure, avec la réserve de traitement", () => {
    const { recommandations } = recommander({
      environnement: "exterieur",
      usage: "marche",
      pliage: "non",
      soudure: "non",
      priorite: "resistance",
    });
    const larme = recommandations.find((r) => r.matiere === "acier" && r.nuance === "larme");
    expect(larme).toBeDefined();
    expect(larme!.reserves).toContain("à galvaniser ou peindre après découpe pour tenir dehors");
  });

  it("n'expose que des nuances présentes au catalogue", () => {
    for (const r of conseiller({})) expect(r.epaisseurs.length).toBeGreaterThan(0);
  });
});
