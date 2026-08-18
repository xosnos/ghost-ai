"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface GhostLogoProps {
  /** Size preset or custom pixel number */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Display variant:
   *  - 'icon': standalone SVG vector mark
   *  - 'mark': vector mark within an elevated glassmorphic container
   *  - 'full': mark + "Ghost AI" typography + optional BETA badge
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
 * Modern High-Tech Ghost AI Geometric Monomark
 * Features interlocking dimensional ribbons, quantum diamond nexus,
 * and aerodynamic spectral contours.
 */
export function GhostIcon({
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
  const cyanGradId = `ghost-cyan-${idPrefix}`;
  const indigoGradId = `ghost-indigo-${idPrefix}`;
  const coreGradId = `ghost-core-${idPrefix}`;
  const rimGradId = `ghost-rim-${idPrefix}`;
  const glowFilterId = `ghost-glow-${idPrefix}`;

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
        {/* Left Wing / Apex Gradient: Electric Cyan to Azure */}
        <linearGradient
          id={cyanGradId}
          x1="5"
          y1="3"
          x2="18"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00F5FF" />
          <stop offset="50%" stopColor="#00C8D4" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Right Wing / Shroud Gradient: Radiant Purple to Indigo */}
        <linearGradient
          id={indigoGradId}
          x1="27"
          y1="3"
          x2="14"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="40%" stopColor="#818CF8" />
          <stop offset="80%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>

        {/* Quantum Diamond Core Gradient */}
        <linearGradient
          id={coreGradId}
          x1="13"
          y1="9"
          x2="19"
          y2="17"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>

        {/* Specular Rim Highlight Gradient */}
        <linearGradient id={rimGradId} x1="8" y1="4" x2="24" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </linearGradient>

        {/* Ambient Luminescence Filter */}
        <filter id={glowFilterId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#00F5FF" floodOpacity="0.5" />
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter={glow ? `url(#${glowFilterId})` : undefined}>
        {/* Right Spectral Wing & Base Fold */}
        <path
          d="M 16 3 C 22 3 26.5 7.5 27 15.5 C 27.3 20 26.5 24 25.5 27 C 25 28.2 23.5 28.4 22.5 27.4 L 19.8 24.5 C 18.5 23.2 16.5 23.2 15.2 24.5 L 14.5 25.2 C 16.8 21.5 20.2 19 24 18 C 24.5 13 21 8.5 16 5.5 Z"
          fill={`url(#${indigoGradId})`}
        />

        {/* Left Spectral Wing & Aerodynamic Hood */}
        <path
          d="M 16 3 C 9.8 3 5.2 7.8 5 15.5 C 4.8 20 5.6 24 6.6 27 C 7.1 28.2 8.6 28.4 9.6 27.4 L 12.5 24.5 C 13.8 23.2 15.8 23.2 17.1 24.5 L 18.5 26 C 16.5 27.8 14 28.2 12.2 27.2 L 9.8 25 C 8.5 23.8 8 20.5 8 16 C 8 10 11.5 5 16 3 Z"
          fill={`url(#${cyanGradId})`}
        />

        {/* Inner Facet / Dimensional Glass Ribbon */}
        <path
          d="M 16 4.5 C 11.5 6.5 8.5 11 8.5 16.5 C 8.5 20.5 9.2 23.5 10.5 25 C 11.8 21.5 14.5 19 18 18 C 21.5 17 24 13.5 24.5 9 C 22.5 6 19.5 4.5 16 4.5 Z"
          fill="white"
          fillOpacity="0.08"
        />

        {/* Specular Apex Edge Line */}
        <path
          d="M 9.5 14 C 10.2 8.5 12.8 4.8 16 4.2 C 19 4.8 21.5 8 22.8 13"
          stroke={`url(#${rimGradId})`}
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Quantum Diamond Nexus / Neural Eye Core */}
        <path d="M 16 9.5 L 19.5 14 L 16 18.5 L 12.5 14 Z" fill={`url(#${coreGradId})`} />

        {/* Central Quantum Flare Sparkle */}
        <circle cx="16" cy="14" r="1.2" fill="#FFFFFF" />

        {/* Micro Satellite Spark at Top-Right */}
        <path
          d="M 26.5 2.5 L 27.3 4.2 L 29 5 L 27.3 5.8 L 26.5 7.5 L 25.7 5.8 L 24 5 L 25.7 4.2 Z"
          fill="#38BDF8"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

/**
 * Ghost AI Logo Component
 */
export function GhostLogo({
  size = "md",
  variant = "mark",
  className,
  iconClassName,
  showBadge = true,
  glow = false,
}: GhostLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 28;

  // Icon only
  if (variant === "icon") {
    return <GhostIcon size={pixelSize} className={cn(iconClassName, className)} glow={glow} />;
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
        <GhostIcon size={pixelSize} className={cn("relative z-10", iconClassName)} glow={glow} />
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
        <GhostIcon size={pixelSize} className={cn("relative z-10", iconClassName)} glow={glow} />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="font-bold tracking-tight text-[var(--text-primary)] transition-colors"
          style={{
            fontSize: Math.max(15, Math.round(pixelSize * 0.62)),
          }}
        >
          Ghost AI
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
