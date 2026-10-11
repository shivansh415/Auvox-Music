import type { SVGProps } from "react";

/**
 * Minimal 1px stroke motifs, one per Journey step. Every stroke carries `.jr-stroke` so the section can DrawSVG them;
 * `non-scaling-stroke` keeps the line 1px at any rendered size. Tan strokes use `text-tan`, the rest inherit ink.
 */

type Props = { className?: string };

const svgProps: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 96 96",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const S = { className: "jr-stroke", vectorEffect: "non-scaling-stroke" } as const;
const T = { className: "jr-stroke text-tan", vectorEffect: "non-scaling-stroke" } as const;

/** 1 — guitar + keys */
export function Instrument({ className }: Props) {
  return (
    <svg {...svgProps} className={className}>
      {/* guitar body (figure eight) + sound hole */}
      <path {...S} d="M30 46c-7 0-12 5-12 11 0 4 2 7 5 9-3 2-6 6-6 10 0 7 6 12 13 12s13-5 13-12c0-4-3-8-6-10 3-2 5-5 5-9 0-6-5-11-12-11z" />
      <circle {...S} cx="30" cy="66" r="4" />
      {/* neck + head */}
      <path {...S} d="M34 44 60 14" />
      <path {...S} d="M38 48 64 18" />
      <path {...S} d="M58 12l8-6 6 6-6 8" />
      {/* keys */}
      <rect {...S} x="56" y="58" width="34" height="26" rx="2" />
      <path {...S} d="M64.5 58v26M73 58v26M81.5 58v26" />
      <rect {...T} x="62.5" y="58" width="4" height="14" />
      <rect {...T} x="71" y="58" width="4" height="14" />
      <rect {...T} x="79.5" y="58" width="4" height="14" />
    </svg>
  );
}

/** 2 — calendar / demo tile */
export function Demo({ className }: Props) {
  return (
    <svg {...svgProps} className={className}>
      <rect {...S} x="18" y="22" width="60" height="56" rx="3" />
      <path {...S} d="M18 36h60" />
      <path {...S} d="M32 16v10M64 16v10" />
      <path {...S} d="M26 48h4M38 48h4M50 48h4M62 48h4M26 58h4M38 58h4M26 68h4M38 68h4M50 68h4M62 68h4" />
      <circle {...T} cx="56" cy="60" r="7" />
      <path {...T} d="M54 56.5v7l6-3.5z" />
    </svg>
  );
}

/** 3 — two package tiers */
export function Tiers({ className }: Props) {
  return (
    <svg {...svgProps} className={className}>
      <rect {...S} x="14" y="38" width="30" height="42" rx="3" />
      <path {...S} d="M21 50h16M21 58h12M21 66h14" />
      <rect {...S} x="52" y="24" width="30" height="56" rx="3" />
      <path {...S} d="M59 40h16M59 48h12M59 56h14M59 64h10" />
      <path {...T} d="M59 72h16" />
      <path {...T} d="M67 10v8M63 14h8M64.2 11.2l5.6 5.6M69.8 11.2l-5.6 5.6" />
    </svg>
  );
}

/** 4 — a box with a wave */
export function Kit({ className }: Props) {
  return (
    <svg {...svgProps} className={className}>
      <path {...S} d="M48 16 78 30 48 44 18 30z" />
      <path {...S} d="M18 30v30l30 14V44" />
      <path {...S} d="M78 30v30L48 74" />
      <path {...T} d="M28 30c4-6 8-6 12 0s8 6 12 0 8-6 12 0" />
    </svg>
  );
}

/** 5 — live-class waveform */
export function Live({ className }: Props) {
  return (
    <svg {...svgProps} className={className}>
      <path {...S} d="M14 48v8" />
      <path {...S} d="M20 43v18" />
      <path {...S} d="M26 38v28" />
      <path {...S} d="M32 45v14" />
      <path {...S} d="M38 34v36" />
      <path {...S} d="M44 41v22" />
      <path {...S} d="M50 30v44" />
      <path {...S} d="M56 43v18" />
      <path {...S} d="M62 37v30" />
      <path {...S} d="M68 46v12" />
      <path {...S} d="M74 40v24" />
      <path {...S} d="M80 48v8" />
      <circle {...T} cx="80" cy="18" r="2.5" />
      <circle {...T} cx="80" cy="18" r="7" />
    </svg>
  );
}

export const MOTIFS = [Instrument, Demo, Tiers, Kit, Live] as const;
