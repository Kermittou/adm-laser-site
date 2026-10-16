import catalogueJson from "@data/catalogue.json";

export type Nuance = {
  label: string;
  epaisseurs: number[];
  epaisseur_masse_mm?: number;
};

export type Matiere = {
  label: string;
  densite_kg_dm3: number;
  devis_automatique: boolean;
  message_devis?: string;
  vitesses_m_min?: Record<string, number>;
  nuances: Record<string, Nuance>;
};

export type ParametreForme = { cle: string; label: string; min: number; max: number; defaut: number };

export type Forme = {
  label: string;
  parametres: ParametreForme[];
  percages: number;
  editeur_en_ligne?: boolean;
  description?: string;
};

export type Catalogue = {
  matieres: Record<string, Matiere>;
  contraintes: {
    format_tole_max_mm: [number, number];
    diametre_trou_min_regle: string;
    diametre_trou_min_note: string;
  };
  formes: Record<string, Forme>;
};

export const catalogue = catalogueJson as unknown as Catalogue;

/** Plage d'épaisseurs réellement disponible pour une matière, toutes nuances confondues. */
export function plageEpaisseurs(matiere: string): { min: number; max: number } | null {
  const m = catalogue.matieres[matiere];
  const toutes = Object.values(m?.nuances ?? {}).flatMap((n) => n.epaisseurs);
  if (toutes.length === 0) return null;
  return { min: Math.min(...toutes), max: Math.max(...toutes) };
}

/** Plage d'épaisseurs sur l'ensemble des matières chiffrées automatiquement. */
export function plageEpaisseursGlobale(): { min: number; max: number } {
  const plages = Object.entries(catalogue.matieres)
    .filter(([, m]) => m.devis_automatique)
    .map(([cle]) => plageEpaisseurs(cle))
    .filter((p): p is { min: number; max: number } => p !== null);
  return { min: Math.min(...plages.map((p) => p.min)), max: Math.max(...plages.map((p) => p.max)) };
}

/** Format français : 0,5 · 1,5 · 12. */
export function mm(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/** Liste lisible : « 1, 2 et 3 mm ». */
export function listeEpaisseurs(epaisseurs: number[]): string {
  const v = epaisseurs.map(mm);
  if (v.length === 1) return `${v[0]} mm`;
  return `${v.slice(0, -1).join(", ")} et ${v[v.length - 1]} mm`;
}

export function formatTole(): string {
  const [l, h] = catalogue.contraintes.format_tole_max_mm;
  return `${mm(l)} × ${mm(h)} mm`;
}
