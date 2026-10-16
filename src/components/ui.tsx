import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* ------------------------------------------------------------------ Conteneur & sections */

export function Container({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-site px-5 md:px-12 ${className}`}>{children}</div>;
}

const tons = {
  blanc: "bg-blanc",
  surface: "bg-surface",
  sombre: "bg-hero text-blanc",
} as const;

export function Section({
  id,
  ton = "blanc",
  className = "",
  children,
  "aria-labelledby": labelledBy,
}: {
  id?: string;
  ton?: keyof typeof tons;
  className?: string;
  children: ReactNode;
  "aria-labelledby"?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-[72px] py-16 md:py-24 ${tons[ton]} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

export function SurTitre({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-4 text-[13px] font-semibold tracking-[0.18em] text-accent uppercase ${className}`}>{children}</p>;
}

export function EnTete({
  id,
  surTitre,
  titre,
  children,
  sombre = false,
  className = "",
}: {
  id?: string;
  surTitre?: string;
  titre: ReactNode;
  children?: ReactNode;
  sombre?: boolean;
  className?: string;
}) {
  return (
    <div className={`max-w-[760px] ${className}`}>
      {surTitre && <SurTitre>{surTitre}</SurTitre>}
      <h2 id={id} className={`text-[34px] md:text-[44px] ${sombre ? "text-blanc" : "text-steel"}`}>
        {titre}
      </h2>
      {children && (
        <div className={`mt-5 space-y-4 text-[17px] leading-relaxed ${sombre ? "text-gris-clair-3" : "text-texte-doux"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Bouton */

const variantes = {
  primary: "bg-accent text-blanc hover:bg-accent-hover",
  outline: "border border-blanc/35 text-blanc hover:border-blanc hover:bg-blanc/8",
  "outline-sombre": "border border-steel/25 text-steel hover:border-steel hover:bg-steel/5",
} as const;

const tailles = {
  md: "rounded-btn px-4 py-2.5 text-[15px]",
  lg: "rounded-btn-lg px-6 py-3.5 text-base",
} as const;

type ButtonProps = {
  variante?: keyof typeof variantes;
  taille?: keyof typeof tailles;
  className?: string;
  children: ReactNode;
};

function classesBouton({ variante = "primary", taille = "lg", className = "" }: Omit<ButtonProps, "children">) {
  return `inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${variantes[variante]} ${tailles[taille]} ${className}`;
}

export function Button({ href, ...props }: ButtonProps & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className">) {
  const { variante, taille, className, children, ...rest } = props;
  return (
    <Link href={href} className={classesBouton({ variante, taille, className })} {...rest}>
      {children}
    </Link>
  );
}

export function SubmitButton({ variante, taille, className, children, ...rest }: ButtonProps & ComponentProps<"button">) {
  return (
    <button className={`${classesBouton({ variante, taille, className })} cursor-pointer disabled:cursor-wait disabled:opacity-60`} {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Carte */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-card border border-bordure bg-blanc p-6 md:p-7 ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------------ Informations manquantes */

/** Information à fournir par ADM : toujours visible, jamais remplacée par du plausible. */
export function Todo({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-dashed border-steel-night/40 bg-or px-1.5 py-0.5 align-middle text-xs font-semibold text-steel-night">
      <span aria-hidden>⚑</span> TODO · {children}
    </span>
  );
}

/** Emplacement photo clairement marqué — aucune fausse réalisation. */
export function PhotoVide({ sujet, ratio = "aspect-[4/3]", className = "" }: { sujet: string; ratio?: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Emplacement photo à fournir : ${sujet}`}
      className={`photo-vide flex ${ratio} w-full flex-col items-center justify-center gap-3 rounded-card border border-dashed border-gris-clair-2 p-4 text-center ${className}`}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gris-clair" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M8 5l1.5-2h5L16 5" />
      </svg>
      <span className="text-sm font-medium text-texte-doux">{sujet}</span>
      <Todo>photo à fournir par ADM</Todo>
    </div>
  );
}
