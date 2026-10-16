/**
 * Conseiller « Quelle matière choisir ? » — port de reference/conseiller_matiere.py.
 *
 * Le client répond à 5 questions, le conseiller classe les nuances du catalogue et rend pour
 * chacune : pourquoi elle convient, et ce sur quoi il faut faire attention.
 *
 * Règle à connaître : l'acier larmé reste proposé en extérieur — c'est LA tôle à marches — avec
 * la réserve « à galvaniser ou peindre après découpe ». L'écarter serait commercialement faux.
 *
 * Toute divergence avec le Python est un bug : test/conseiller.test.ts rejoue les 576
 * combinaisons de réponses contre l'oracle.
 */
import { catalogue } from "@/lib/devis/catalogue";

export const QUESTIONS = [
  {
    cle: "environnement",
    question: "Où la pièce va-t-elle vivre ?",
    reponses: [
      ["interieur", "À l'intérieur, au sec"],
      ["exterieur", "Dehors, sous la pluie"],
      ["marin", "En bord de mer"],
      ["humide", "Intérieur humide"],
    ],
  },
  {
    cle: "usage",
    question: "À quoi sert-elle ?",
    reponses: [
      ["structure", "Structure / mécanique"],
      ["marche", "Une marche, un sol"],
      ["decor", "Pièce visible, décorative"],
      ["indifferent", "Je ne sais pas encore"],
    ],
  },
  {
    cle: "pliage",
    question: "Faudra-t-il la plier ?",
    reponses: [
      ["oui", "Oui"],
      ["non", "Non"],
      ["inconnu", "Je ne sais pas"],
    ],
  },
  {
    cle: "soudure",
    question: "Faudra-t-il la souder ?",
    reponses: [
      ["oui", "Oui"],
      ["non", "Non"],
      ["inconnu", "Je ne sais pas"],
    ],
  },
  {
    cle: "priorite",
    question: "Qu'est-ce qui compte le plus ?",
    reponses: [
      ["prix", "Le prix"],
      ["resistance", "La résistance"],
      ["legerete", "La légèreté"],
      ["esthetique", "Le rendu visuel"],
    ],
  },
] as const satisfies readonly { cle: string; question: string; reponses: readonly (readonly [string, string])[] }[];

export type Reponses = Partial<Record<(typeof QUESTIONS)[number]["cle"], string>>;

type Props = {
  /** ne rouille pas */
  inox: boolean;
  /** antidérapant */
  antid: boolean;
  /** choisi pour être vu */
  esth: boolean;
  pliable: boolean;
  /** le plus économique de sa catégorie */
  eco: boolean;
  txt: string;
  /** conçu pour l'air salin */
  marin?: boolean;
  alu?: boolean;
};

// Arguments commerciaux dictés par l'atelier. L'ordre compte : il départage les ex aequo.
export const PROPS: Record<string, Props> = {
  "acier.brut": { inox: false, antid: false, esth: false, pliable: true, eco: true, txt: "résistant, économique, facile à souder" },
  "acier.noir": { inox: false, antid: false, esth: false, pliable: true, eco: true, txt: "comme le brut, mais non décapé" },
  "acier.bleue": { inox: false, antid: false, esth: false, pliable: false, eco: false, txt: "très dure — mais elle ne se plie pas" },
  "acier.galvanise": { inox: true, antid: false, esth: false, pliable: true, eco: true, txt: "ne rouille pas, économique, aspect galvanisé" },
  "acier.electrozingue": { inox: true, antid: false, esth: false, pliable: true, eco: true, txt: "ne rouille pas, économique, aspect zinc" },
  "acier.corten": { inox: true, antid: false, esth: true, pliable: true, eco: false, txt: "rouille stabilisée, très esthétique dehors" },
  "acier.larme": { inox: false, antid: true, esth: false, pliable: true, eco: true, txt: "antidérapant, parfait pour des marches extérieures" },
  "acier.perfore": { inox: false, antid: false, esth: true, pliable: true, eco: false, txt: "esthétique, perforations Ø10mm" },
  "inox.brut": { inox: true, antid: false, esth: false, pliable: true, eco: false, txt: "ne rouille pas, très résistant, soudable" },
  "inox.marin": { inox: true, antid: false, esth: false, pliable: true, eco: false, txt: "résiste mieux à l'air salin, soudable", marin: true },
  "inox.miroir": { inox: true, antid: false, esth: true, pliable: true, eco: false, txt: "esthétique, effet miroir" },
  "inox.brosse": { inox: true, antid: false, esth: true, pliable: true, eco: false, txt: "esthétique, effet brossé" },
  "alu.brut": { inox: true, antid: false, esth: false, pliable: true, eco: false, txt: "léger, ne rouille pas", alu: true },
  "alu.larme": { inox: true, antid: true, esth: false, pliable: true, eco: false, txt: "léger, ne rouille pas, antidérapant", alu: true },
};

export type Recommandation = {
  matiere: string;
  nuance: string;
  label: string;
  score: number;
  raisons: string[];
  reserves: string[];
  resume: string;
  epaisseurs: number[];
};

/** Classe les nuances selon les réponses. Renvoie les retenues, meilleures d'abord. */
export function conseiller(rep: Reponses): Recommandation[] {
  const env = rep.environnement ?? "interieur";
  const usage = rep.usage ?? "indifferent";
  const pliage = rep.pliage ?? "inconnu";
  const prio = rep.priorite ?? "prix";

  const out: Recommandation[] = [];
  for (const [cle, p] of Object.entries(PROPS)) {
    const [mk, nk] = cle.split(".");
    const inoxydable = p.inox;
    // L'acier larmé se traite après découpe : on ne l'écarte pas dehors.
    const traitable = p.antid;

    // --- exclusions dures ---
    if (pliage === "oui" && !p.pliable) continue;
    if (usage === "marche" && !p.antid) continue;
    if (env === "marin" && !inoxydable) continue;
    if ((env === "exterieur" || env === "humide") && !inoxydable && !traitable) continue;

    let score = 0;
    const raisons: string[] = [];
    const reserves: string[] = [];

    // --- environnement ---
    if (env === "marin") {
      if (p.marin) {
        score += 40;
        raisons.push("conçu pour résister à l'air salin");
      } else if (inoxydable) {
        score += 20;
        raisons.push("ne rouille pas");
      }
    } else if (env === "exterieur" || env === "humide") {
      if (nk === "corten") {
        score += 22;
        raisons.push("sa rouille se stabilise d'elle-même — c'est fait pour rester dehors");
      } else if (inoxydable) {
        score += 22;
        raisons.push("ne rouille pas");
      } else {
        score += 10;
        reserves.push("à galvaniser ou peindre après découpe pour tenir dehors");
      }
    } else {
      score += 8;
      if (!inoxydable) raisons.push("à l'abri, l'acier non traité suffit largement");
    }

    // --- usage ---
    if (usage === "marche") {
      score += 35;
      raisons.push("antidérapant, prévu pour être marché dessus");
    } else if (usage === "decor") {
      if (p.esth) {
        score += 30;
        raisons.push("choisi pour être vu");
      } else {
        score += 4;
        reserves.push("aspect brut — prévoyez une finition si la pièce est visible");
      }
    } else if (usage === "structure") {
      if (p.alu) {
        score += 8;
        reserves.push("l'alu se raye plus vite et encaisse moins bien les chocs");
      } else if (mk === "inox") {
        score += 20;
        raisons.push("très résistant");
      } else {
        score += 16;
        raisons.push("résistant");
      }
    } else {
      score += 6;
    }

    // --- pliage / soudure ---
    if (pliage === "oui") {
      score += 6;
      raisons.push("se plie sans problème");
    }
    if (rep.soudure === "oui") {
      score += 6;
      raisons.push("soudable");
    }

    // --- priorité ---
    if (prio === "prix") {
      if (p.eco) {
        score += 26;
        raisons.push("le plus économique de sa catégorie");
      } else if (mk === "inox") {
        score -= 12;
        reserves.push("l'inox reste nettement plus cher que l'acier");
      } else {
        score += 14;
      }
    } else if (prio === "resistance") {
      if (mk === "inox") {
        score += 26;
        raisons.push("le plus résistant du catalogue");
      } else if (p.alu) {
        score += 4;
        reserves.push("moins résistant aux chocs que l'acier ou l'inox");
      } else {
        score += 20;
        raisons.push("très bonne tenue mécanique");
      }
    } else if (prio === "legerete") {
      if (p.alu) {
        score += 30;
        raisons.push("environ 3x plus léger que l'acier à volume égal");
      } else {
        score -= 8;
        reserves.push("lourd — l'aluminium serait 3x plus léger");
      }
    } else if (prio === "esthetique") {
      if (p.esth) {
        score += 28;
        raisons.push("l'un des rendus les plus soignés du catalogue");
      } else {
        score -= 4;
      }
    }

    const matiere = catalogue.matieres[mk];
    const nuance = matiere.nuances[nk];
    out.push({
      matiere: mk,
      nuance: nk,
      label: `${matiere.label} ${nuance.label}`,
      score,
      raisons,
      reserves,
      resume: p.txt,
      epaisseurs: nuance.epaisseurs,
    });
  }

  // Tri stable, comme sorted() en Python : les ex aequo gardent l'ordre de PROPS.
  return out.sort((a, b) => b.score - a.score);
}

export const MESSAGE_AUCUNE_MATIERE =
  "Aucune matière du catalogue ne coche toutes ces cases — écrivez-nous, on trouvera la bonne solution ensemble.";

export function recommander(reponses: Reponses, nb = 3): { recommandations: Recommandation[]; message: string | null } {
  const classement = conseiller(reponses);
  if (classement.length === 0) return { recommandations: [], message: MESSAGE_AUCUNE_MATIERE };
  return { recommandations: classement.slice(0, nb), message: null };
}
