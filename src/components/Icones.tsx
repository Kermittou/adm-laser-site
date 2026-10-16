import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconeLaser(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M9 2h6v5l-3 3-3-3z" />
      <path d="M12 10v7" />
      <path d="M3 21h18" />
      <path d="M9.5 18.5L12 17l2.5 1.5" />
    </svg>
  );
}

export function IconePliage(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 18h9l7-9" />
      <path d="M12 18l-2-6h6" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function IconeSoudure(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M4 20l7-7" />
      <path d="M10 10l4 4" />
      <path d="M13 7l4 4 3-3-4-4z" />
      <path d="M5 13l-1-2M8 15l-2 1M3 16h2" />
    </svg>
  );
}

export function IconeDevis(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <path d="M8 6.5h8" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5" />
    </svg>
  );
}

export function IconeQualite(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </svg>
  );
}

export function IconeFleche(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} strokeWidth={2} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconeTelephone(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z" />
    </svg>
  );
}

export function IconeMail(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function IconeLieu(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <path d="M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export function IconeHorloge(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconeCheck(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={16} height={16} strokeWidth={2.2} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
