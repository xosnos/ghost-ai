"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ArchitypeLogoProps {
  /** Size preset or custom pixel number */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Display variant:
   *  - 'icon': standalone SVG vector mark
   *  - 'mark': vector mark within an elevated glassmorphic container
   *  - 'full': mark + "Architype" typography + optional BETA badge
   */
  variant?: "icon" | "mark" | "full";
  /** Custom class for outer wrapper */
  className?: string;
  /** Custom class for the SVG element */
  iconClassName?: string;
  /** Display BETA tag next to text (in full variant) */
  showBadge?: boolean;
  /** Add dynamic cyber-glow filter */
  glow?: boolean;
}

const SIZE_MAP = {
  xs: 16,
  sm: 22,
  md: 28,
  lg: 36,
  xl: 48,
};

/**
 * High-Precision Isometric Neural 'A' Monomark
 * Features interlocking architectural pillars, dimensional crossbar portal,
 * and a glowing quantum diamond nexus core.
 */
export function ArchitypeIcon({
  size = 24,
  className,
  glow = false,
  ...props
}: {
  size?: number | string;
  className?: string;
  glow?: boolean;
} & React.SVGProps<SVGSVGElement>) {
  const pixelSize = typeof size === "number" ? size : parseInt(size, 10) || 24;
  const idPrefix = React.useId().replace(/:/g, "_");
  const leftPillarGradId = `architype-left-${idPrefix}`;
  const rightPillarGradId = `architype-right-${idPrefix}`;
  const crossbarGradId = `architype-cross-${idPrefix}`;
  const coreGradId = `architype-core-${idPrefix}`;
  const rimGradId = `architype-rim-${idPrefix}`;
  const glowFilterId = `architype-glow-${idPrefix}`;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none overflow-visible", className)}
      {...props}
    >
      <defs>
        {/* Left Architectural Pillar: Electric Cyan to Azure */}
        <linearGradient
          id={leftPillarGradId}
          x1="5"
          y1="3"
          x2="17"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00F5FF" />
          <stop offset="50%" stopColor="#00C8D4" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Right Architectural Pillar: Radiant Violet to Indigo */}
        <linearGradient
          id={rightPillarGradId}
          x1="27"
          y1="3"
          x2="15"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="45%" stopColor="#818CF8" />
          <stop offset="85%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>

        {/* Isometric Crossbar / Nexus Bridge */}
        <linearGradient
          id={crossbarGradId}
          x1="9"
          y1="16"
          x2="23"
          y2="23"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>

        {/* Quantum Core Highlight */}
        <linearGradient
          id={coreGradId}
          x1="13"
          y1="11"
          x2="19"
          y2="19"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>

        {/* Specular Rim Highlight Gradient */}
        <linearGradient id={rimGradId} x1="8" y1="4" x2="24" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </linearGradient>

        {/* Ambient Luminescence Glow */}
        <filter id={glowFilterId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#00F5FF" floodOpacity="0.5" />
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter={glow ? `url(#${glowFilterId})` : undefined}>
        {/* Right Pillar & Base Foundation */}
        <path
          d="M 16 3.5 L 26.5 24.5 C 27.2 25.8 26.3 27.5 24.8 27.5 L 20.2 27.5 C 19.4 27.5 18.6 27 18.2 26.2 L 16 21.8 L 20.2 21.8 L 16 13.5 L 14.5 16.5 L 12.8 13 L 16 3.5 Z"
          fill={`url(#${rightPillarGradId})`}
        />

        {/* Left Pillar & Apex Cap */}
        <path
          d="M 16 3.5 L 5.5 24.5 C 4.8 25.8 5.7 27.5 7.2 27.5 L 11.8 27.5 C 12.6 27.5 13.4 27 13.8 26.2 L 16 21.8 L 11.8 21.8 L 16 13.5 L 16 3.5 Z"
          fill={`url(#${leftPillarGradId})`}
        />

        {/* Isometric Crossbar Bridge / Portal */}
        <path
          d="M 10.5 19.5 L 21.5 19.5 C 22.2 19.5 22.8 20.1 22.5 20.8 L 21.5 22.8 C 21.2 23.3 20.7 23.6 20.2 23.6 L 11.8 23.6 C 11.3 23.6 10.8 23.3 10.5 22.8 L 9.5 20.8 C 9.2 20.1 9.8 19.5 10.5 19.5 Z"
          fill={`url(#${crossbarGradId})`}
        />

        {/* Inner Glass Prism Facet */}
        <path d="M 16 6 L 13.2 12 L 18.8 12 Z" fill="white" fillOpacity="0.12" />

        {/* Specular Apex Edge Rim */}
        <path
          d="M 8 22 L 16 5.5 L 24 22"
          stroke={`url(#${rimGradId})`}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Central Quantum Nexus Diamond */}
        <path d="M 16 13 L 18.5 17 L 16 21 L 13.5 17 Z" fill={`url(#${coreGradId})`} />

        {/* Central Quantum Flare */}
        <circle cx="16" cy="17" r="1.1" fill="#FFFFFF" />

        {/* Micro Apex Spark */}
        <path
          d="M 26.5 3 L 27.2 4.5 L 28.8 5.2 L 27.2 5.9 L 26.5 7.5 L 25.8 5.9 L 24.2 5.2 L 25.8 4.5 Z"
          fill="#38BDF8"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

/**
 * Architype Logo Component
 */
export function ArchitypeLogo({
  size = "md",
  variant = "mark",
  className,
  iconClassName,
  showBadge = true,
  glow = false,
}: ArchitypeLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 28;

  // Icon only
  if (variant === "icon") {
    return <ArchitypeIcon size={pixelSize} className={cn(iconClassName, className)} glow={glow} />;
  }

  // Mark within glowing glassmorphic container
  if (variant === "mark") {
    return (
      <div
        className={cn(
          "group relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[var(--bg-elevated)] to-[var(--bg-surface)] border border-[var(--border-default)] shadow-[0_2px_10px_rgba(0,0,0,0.2)] transition-all duration-200 hover:border-[var(--accent-primary)]/50 hover:shadow-[0_0_20px_rgba(0,200,212,0.2)] hover:scale-105",
          className,
        )}
        style={{
          width: pixelSize + 10,
          height: pixelSize + 10,
        }}
      >
        {/* Subtle Ambient Radial Highlight inside badge */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-[var(--accent-ai)]/10 via-transparent to-[var(--accent-primary)]/15 opacity-60 group-hover:opacity-100 transition-opacity" />
        <ArchitypeIcon
          size={pixelSize}
          className={cn("relative z-10", iconClassName)}
          glow={glow}
        />
      </div>
    );
  }

  // Full variant: Mark + Modern Typography + Optional BETA pill
  return (
    <div className={cn("inline-flex items-center gap-3 select-none", className)}>
      <div
        className="group relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[var(--bg-elevated)] to-[var(--bg-surface)] border border-[var(--border-default)] shadow-[0_2px_10px_rgba(0,0,0,0.2)] transition-all duration-200 hover:border-[var(--accent-primary)]/50 hover:shadow-[0_0_20px_rgba(0,200,212,0.2)]"
        style={{
          width: pixelSize + 10,
          height: pixelSize + 10,
        }}
      >
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-[var(--accent-ai)]/10 via-transparent to-[var(--accent-primary)]/15 opacity-60" />
        <ArchitypeIcon
          size={pixelSize}
          className={cn("relative z-10", iconClassName)}
          glow={glow}
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="font-bold tracking-tight text-[var(--text-primary)] transition-colors"
          style={{
            fontSize: Math.max(15, Math.round(pixelSize * 0.62)),
          }}
        >
          Architype
        </span>

        {showBadge && (
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            BETA
          </span>
        )}
      </div>
    </div>
  );
}

// Backwards-compatible aliases
export const GhostIcon = ArchitypeIcon;
export const GhostLogo = ArchitypeLogo;
export type GhostLogoProps = ArchitypeLogoProps;
