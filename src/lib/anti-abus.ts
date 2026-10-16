import "server-only";

/** Limite simple anti-abus : N envois par adresse IP sur une fenêtre glissante (mémoire du process). */
const FENETRE_MS = 10 * 60 * 1000;
const MAX_ENVOIS = 5;
const envois = new Map<string, number[]>();

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
}

export function tropDEnvois(cle: string): boolean {
  const maintenant = Date.now();
  const recents = (envois.get(cle) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  recents.push(maintenant);
  envois.set(cle, recents);
  return recents.length > MAX_ENVOIS;
}
