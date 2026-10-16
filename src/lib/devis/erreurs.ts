import type { CodeRefus } from "./types";

/** La pièce ne peut pas être chiffrée automatiquement — devis humain. Le message est pour le client. */
export class DevisImpossible extends Error {
  constructor(
    readonly code: CodeRefus,
    message: string,
  ) {
    super(message);
    this.name = "DevisImpossible";
  }
}
