import "server-only";

/** Limite simple anti-abus : N envois par adresse IP sur une fenêtre glissante (mémoire du process). */
const FENETRE_MS = 10 * 60 * 1000;
const MAX_ENVOIS = 5;
/** Au-delà, on purge les entrées périmées : sans cela, un attaquant qui change d'IP fait grossir la Map sans fin. */
const MAX_CLES = 10_000;
const envois = new Map<string, number[]>();

/**
 * Adresse IP du visiteur, lue dans `x-forwarded-for`.
 *
 * On prend la DERNIÈRE valeur, pas la première : le site tourne derrière un seul reverse proxy
 * (Traefik, sur Dokploy), qui AJOUTE l'IP réelle à la fin de l'en-tête. Si le client envoie
 * lui-même `x-forwarded-for: 1.2.3.4`, le proxy produit « 1.2.3.4, <IP réelle> » — prendre la
 * première valeur laisserait n'importe qui choisir son identité et contourner la limite.
 *
 * Si un jour le site passe derrière plusieurs proxies (CDN devant Traefik), cette position change :
 * il faudra compter les sauts de confiance.
 */
export function ipDe(req: Request): string {
  const chaine = req.headers.get("x-forwarded-for");
  if (!chaine) return req.headers.get("x-real-ip")?.trim() || "inconnue";
  const sauts = chaine.split(",");
  return sauts[sauts.length - 1]?.trim() || "inconnue";
}

function purger(maintenant: number): void {
  for (const [cle, dates] of envois) {
    if (dates.every((t) => maintenant - t >= FENETRE_MS)) envois.delete(cle);
  }
}

export function tropDEnvois(cle: string): boolean {
  const maintenant = Date.now();
  if (envois.size > MAX_CLES) purger(maintenant);
  const recents = (envois.get(cle) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  recents.push(maintenant);
  envois.set(cle, recents);
  return recents.length > MAX_ENVOIS;
}

/** Caractères de contrôle retirés avant de faire voyager une saisie client dans un en-tête de mail. */
export function sansCaracteresDeControle(valeur: string): string {
  // eslint-disable-next-line no-control-regex
  return valeur.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}
