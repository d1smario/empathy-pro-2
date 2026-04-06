"use client";

import { useId, type ReactNode } from "react";
import type { SportGlyphId } from "@/lib/training/builder/sport-glyph-id";

export type { SportGlyphId };

/** Icone disciplina: forme piene, più colori, stile “app / illustrazione” (non solo stroke). viewBox 36×36. */
function S({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export function SportDisciplineGlyph({ glyph, className }: { glyph: SportGlyphId; className?: string }) {
  const c = className ?? "h-9 w-9";
  const uid = useId().replace(/:/g, "");

  switch (glyph) {
    case "soccer":
      return (
        <S className={c}>
          <circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.75" />
          <path fill="#0f172a" d="M18 8l2.8 5.2 5.8 1-4 4.2 1 5.8-5.6-3-5.6 3 1-5.8-4-4.2 5.8-1z" />
          <path fill="#0f172a" d="M8 14a14 14 0 0116-10l-1.2 3A11 11 0 008 14z" opacity="0.85" />
          <path fill="#0f172a" d="M28 22a14 14 0 01-16 10l1.2-3a11 11 0 0014.8-7z" opacity="0.85" />
        </S>
      );

    case "basketball":
      return (
        <S className={c}>
          <circle cx="18" cy="18" r="15.5" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />
          <path stroke="#1c1917" strokeWidth="1.2" d="M18 2.5v31M2.5 18h31" />
          <path stroke="#1c1917" strokeWidth="1" d="M5 7q13 11 26 0M5 29q13-11 26 0" />
        </S>
      );

    case "volleyball":
      return (
        <S className={c}>
          <circle cx="18" cy="18" r="15.5" fill="#fefce8" stroke="#ca8a04" strokeWidth="0.75" />
          <path fill="#2563eb" d="M18 2.5a16 16 0 0110 4.5 16 16 0 00-10 11V2.5z" opacity="0.9" />
          <path fill="#ca8a04" d="M18 33.5a16 16 0 01-10-4.5 16 16 0 0010-11v15.5z" opacity="0.85" />
          <path stroke="#1e3a8a" strokeWidth="1" d="M2.5 18h31" />
        </S>
      );

    case "tennis":
      return (
        <S className={c}>
          <circle cx="18" cy="18" r="15" fill="#d9f99d" stroke="#65a30d" strokeWidth="0.75" />
          <path fill="#ecfccb" d="M18 4c8 4 12 10 12 14s-4 10-12 14V4z" opacity="0.95" />
          <ellipse cx="22" cy="14" rx="4" ry="5.5" fill="none" stroke="#ffffff" strokeWidth="1.4" transform="rotate(-25 22 14)" />
        </S>
      );

    case "boxing":
      return (
        <S className={c}>
          <path
            fill="#dc2626"
            d="M10 12c-1 6 0 12 4 14 4 2 9 1 12-2 3-4 2-9-1-12-3-4-8-5-12-2-2 1-3 2-3 2z"
          />
          <path fill="#fecaca" d="M22 10l6-2 2 4-5 4z" />
          <ellipse cx="14" cy="11" rx="3" ry="2.5" fill="#fca5a5" />
        </S>
      );

    case "roadBike":
      return (
        <S className={c}>
          <circle cx="11" cy="24" r="6.5" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          <circle cx="11" cy="24" r="3" fill="#94a3b8" />
          <circle cx="26" cy="24" r="6.5" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          <circle cx="26" cy="24" r="3" fill="#94a3b8" />
          <path stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" d="M11 24l5-11h6l4 11" />
          <path stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" d="M16 13l-2-5M22 13l3-4 3-1" />
          <path stroke="#64748b" strokeWidth="1.5" d="M18 18v6" />
        </S>
      );

    case "runner":
      return (
        <S className={c}>
          <circle cx="14" cy="9" r="4" fill="#fdba74" />
          <path fill="#3b82f6" d="M12 13l2 7-2 9h3l2-8 4 2 3 6h3l-4-8-6-3 1-3z" />
          <path fill="#1e40af" d="M10 22l-3 8h3l2-6zM23 18l5 10h3l-5-11z" />
          <path fill="#fdba74" d="M17 14l5-2 3 1-2 3z" />
        </S>
      );

    case "mtb":
      return (
        <S className={c}>
          <circle cx="10" cy="25" r="7" fill="#14532d" stroke="#052e16" strokeWidth="0.75" />
          <circle cx="10" cy="25" r="3.5" fill="#4ade80" />
          <circle cx="27" cy="25" r="7" fill="#14532d" stroke="#052e16" strokeWidth="0.75" />
          <circle cx="27" cy="25" r="3.5" fill="#4ade80" />
          <path stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" d="M10 25l6-14h5l6 14" />
          <path stroke="#86efac" strokeWidth="1.8" d="M16 11l-3-5M21 11l4-5" />
        </S>
      );

    case "gravel":
      return (
        <S className={c}>
          <path fill="#78716c" d="M2 32h32v4H2z" opacity="0.5" />
          <ellipse cx="10" cy="30" rx="3" ry="1" fill="#a8a29e" />
          <ellipse cx="24" cy="31" rx="4" ry="1.2" fill="#a8a29e" />
          <circle cx="12" cy="24" r="5.5" fill="#292524" stroke="#57534e" />
          <circle cx="12" cy="24" r="2.5" fill="#d6d3d1" />
          <circle cx="25" cy="24" r="5.5" fill="#292524" stroke="#57534e" />
          <circle cx="25" cy="24" r="2.5" fill="#d6d3d1" />
          <path stroke="#f59e0b" strokeWidth="2" d="M12 24l5-10h4l4 10" />
          <path stroke="#d6d3d1" strokeWidth="1.5" d="M17 14l-2-4M21 14l3-4" />
        </S>
      );

    case "triathlon":
      return (
        <S className={c}>
          <path fill="#38bdf8" d="M4 14c4-3 8-2 12 0-4 3-8 4-12 1v-1z" />
          <circle cx="9" cy="12" r="2.5" fill="#fdba74" />
          <circle cx="25" cy="22" r="5" fill="#1e293b" />
          <circle cx="25" cy="22" r="2.2" fill="#facc15" />
          <path stroke="#facc15" strokeWidth="2" d="M25 22l-4-7h6l3 7" />
          <path fill="#ef4444" d="M14 26l3 8h2.5l-2-7 4-2 2 6h2.5l-3-9z" />
          <circle cx="15" cy="24" r="2" fill="#fdba74" />
        </S>
      );

    case "swim":
      return (
        <S className={c}>
          <path fill="#0ea5e9" d="M2 20c4-2 6-2 10 0s6 2 10 0 6-2 10 0v3c-4-2-6-2-10 0s-6 2-10 0-6-2-10 0v-3z" opacity="0.9" />
          <path fill="#38bdf8" d="M2 26c4-2 6-2 10 0s6 2 10 0 6-2 10 0v2H2v-2z" opacity="0.7" />
          <circle cx="26" cy="12" r="3.5" fill="#fdba74" />
          <path fill="#fdba74" d="M23 13l-4 2v2l5-1z" />
        </S>
      );

    case "xcSki":
      return (
        <S className={c}>
          <path stroke="#e2e8f0" strokeWidth="2" d="M4 30l28-3" />
          <path stroke="#cbd5e1" strokeWidth="1.5" d="M6 32l26-3" />
          <circle cx="18" cy="8" r="3" fill="#fdba74" />
          <path fill="#f97316" d="M16 11l-2 12 2 1 2-10 4 8 2-1-5-11z" />
          <path stroke="#7c2d12" strokeWidth="1.5" d="M12 6l-2-3M24 6l2-3" />
        </S>
      );

    case "alpine":
      return (
        <S className={c}>
          <path fill="#4ade80" d="M2 32h32v4H2z" />
          <path fill="#64748b" d="M6 32L18 6l8 10 10 16H6z" />
          <path fill="#f8fafc" d="M18 6L14 14l4 3 4-3-4-8z" />
          <path fill="#94a3b8" d="M26 16l6 16H20l6-16z" />
        </S>
      );

    case "canoe":
      return (
        <S className={c}>
          <path fill="#0ea5e9" opacity="0.35" d="M2 24h32v10H2z" />
          <path fill="#92400e" d="M4 20q14 8 28 0v4q-14 6-28 0v-4z" />
          <path fill="#78350f" d="M8 20h20v2H8z" />
          <path stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" d="M20 10v8M18 8l4 4 4-4" />
        </S>
      );

    case "gym":
      return (
        <S className={c}>
          <rect x="4" y="14" width="5" height="8" rx="1" fill="#475569" stroke="#334155" />
          <rect x="27" y="14" width="5" height="8" rx="1" fill="#475569" stroke="#334155" />
          <rect x="9" y="16" width="18" height="4" rx="1" fill="#94a3b8" stroke="#64748b" />
          <rect x="15" y="12" width="6" height="12" rx="0.5" fill="#cbd5e1" />
        </S>
      );

    case "hyrox":
      return (
        <S className={c}>
          <path fill="#f97316" d="M18 4c2 6 1 12-2 16-2 3-5 4-5 4s3 2 7 2 7-2 9-5c3-5 4-12 1-17-2-4-6-6-10-4z" />
          <path fill="#ea580c" d="M14 22c2 4 5 6 8 6h-6c-3 0-5-3-2-6z" />
          <rect x="8" y="26" width="20" height="5" rx="1" fill="#57534e" />
          <rect x="10" y="31" width="3" height="3" fill="#292524" />
          <rect x="23" y="31" width="3" height="3" fill="#292524" />
        </S>
      );

    case "crossfit":
      return (
        <S className={c}>
          <path fill="#171717" d="M18 8c-4 0-7 4-6 9l2 12h8l2-12c1-5-2-9-6-9z" />
          <path fill="#dc2626" d="M14 10h8v4h-3v14h-2V14h-3v-4z" />
          <path fill="#facc15" d="M12 28h12v2H12z" />
        </S>
      );

    case "barbell":
      return (
        <S className={c}>
          <rect x="2" y="14" width="6" height="8" rx="1" fill="#1e293b" />
          <rect x="28" y="14" width="6" height="8" rx="1" fill="#1e293b" />
          <rect x="8" y="16" width="20" height="4" rx="0.5" fill="#94a3b8" />
          <rect x="12" y="13" width="2" height="10" fill="#64748b" />
          <rect x="18" y="13" width="2" height="10" fill="#64748b" />
          <rect x="24" y="13" width="2" height="10" fill="#64748b" />
        </S>
      );

    case "karate":
      return (
        <S className={c}>
          <path fill="#fafafa" d="M12 30h12v4H12z" />
          <path fill="#fafafa" d="M14 14l-2 16h12l-2-16-4-6-4 6z" />
          <circle cx="18" cy="8" r="4" fill="#fdba74" />
          <path fill="#171717" d="M14 20h8v3H14z" />
          <path stroke="#171717" strokeWidth="1.5" d="M10 12h16M12 10l12-2" />
        </S>
      );

    case "judo":
      return (
        <S className={c}>
          <path fill="#1d4ed8" d="M13 30h10v4H13z" />
          <path fill="#2563eb" d="M12 16l-1 14h14l-1-14-5-8-6 0-5 8z" />
          <circle cx="18" cy="7" r="3.5" fill="#fdba74" />
          <path fill="#fbbf24" d="M14 18h8v2h-8z" />
        </S>
      );

    case "muay":
      return (
        <S className={c}>
          <ellipse cx="18" cy="28" rx="10" ry="2" fill="#422006" opacity="0.4" />
          <path fill="#fdba74" d="M14 8h8v6h-8z" />
          <circle cx="18" cy="7" r="3" fill="#fdba74" />
          <path fill="#ea580c" d="M12 14h12l1 8-2 10H13l-2-10z" />
          <path fill="#fbbf24" d="M14 16h8v3h-8z" />
          <line x1="10" y1="10" x2="7" y2="4" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" />
          <line x1="26" y1="10" x2="29" y2="4" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" />
        </S>
      );

    case "yoga":
      return (
        <S className={c}>
          <defs>
            <linearGradient id={`${uid}-yg`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <ellipse cx="18" cy="32" rx="14" ry="3" fill={`url(#${uid}-yg)`} opacity="0.35" />
          <circle cx="18" cy="10" r="4" fill="#fdba74" />
          <path fill="#c084fc" d="M18 14c-6 2-8 8-8 14h16c0-6-2-12-8-14z" />
          <path fill="#e879f9" d="M12 22l-4 6h3l3-5zM24 22l4 6h-3l-3-5z" />
        </S>
      );

    case "pilates":
      return (
        <S className={c}>
          <path fill="#5eead4" d="M6 30h24v4H6z" opacity="0.5" />
          <circle cx="18" cy="9" r="3.5" fill="#fdba74" />
          <path fill="#14b8a6" d="M18 12c-8 2-10 10-9 18h18c1-8-1-16-9-18z" />
          <path fill="#0d9488" d="M14 20l-3 10h3l2-8M22 20l3 10h-3l-2-8" />
        </S>
      );

    case "meditation":
      return (
        <S className={c}>
          <defs>
            <linearGradient id={`${uid}-med`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
          <circle cx="18" cy="18" r="16" fill={`url(#${uid}-med)`} opacity="0.25" />
          <ellipse cx="18" cy="22" rx="10" ry="6" fill="#6366f1" opacity="0.6" />
          <circle cx="18" cy="12" r="5" fill="#fdba74" />
          <path fill="#a5b4fc" d="M12 18h12v2H12z" />
        </S>
      );

    case "breath":
      return (
        <S className={c}>
          <defs>
            <linearGradient id={`${uid}-br`} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${uid}-br)`}
            opacity="0.85"
            d="M18 6c-8 4-10 12-8 18 2 6 8 10 8 10s6-4 8-10c2-6 0-14-8-18z"
          />
          <path fill="#e0f2fe" opacity="0.5" d="M12 16h12v4H12z" />
        </S>
      );

    case "mobility":
      return (
        <S className={c}>
          <path stroke="#34d399" strokeWidth="2.5" fill="none" d="M6 12 Q18 6 30 12" />
          <path stroke="#fbbf24" strokeWidth="2.5" fill="none" d="M6 24 Q18 30 30 24" />
          <circle cx="18" cy="18" r="5" fill="#6ee7b7" stroke="#059669" strokeWidth="1" />
          <circle cx="18" cy="18" r="2" fill="#fef08a" />
        </S>
      );

    case "stretch":
      return (
        <S className={c}>
          <circle cx="12" cy="8" r="3.5" fill="#fdba74" />
          <path fill="#fb7185" d="M12 11l2 8-1 12h3l1-10 8-6 2 8h3l-3-12-10 4-1-4z" />
          <path fill="#fda4af" d="M22 9l6-4 2 3-7 5z" />
        </S>
      );

    default:
      return (
        <S className={c}>
          <circle cx="18" cy="18" r="14" fill="#64748b" />
        </S>
      );
  }
}
