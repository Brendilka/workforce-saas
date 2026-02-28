import type { DayPeriodConfig } from "@/lib/types/database";

/** Default hex colors used when period.color is not set (by index). */
export const DEFAULT_PERIOD_COLORS = [
  "#1e3a5f", // blue-900
  "#ca8a04", // yellow-600
  "#9ca3af", // gray-400
  "#ea580c", // orange-600
  "#7c3aed", // violet-600
  "#059669", // emerald-600
  "#e11d48", // rose-600
  "#0891b2", // cyan-600
  "#d97706", // amber-600
  "#475569", // slate-600
];

export function getPeriodColor(period: DayPeriodConfig | undefined, index: number): string {
  const hex = period?.color?.trim();
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  return DEFAULT_PERIOD_COLORS[index % DEFAULT_PERIOD_COLORS.length];
}

/** Luminance (0–1); >0.4 suggests use white text on this background. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Lighten hex by mixing with white (factor 0–1; 0.85 = light background). */
export function lightenHex(hex: string, factor: number = 0.85): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mix = 1 - factor;
  const R = Math.round((r * factor + mix) * 255);
  const G = Math.round((g * factor + mix) * 255);
  const B = Math.round((b * factor + mix) * 255);
  return `#${R.toString(16).padStart(2, "0")}${G.toString(16).padStart(2, "0")}${B.toString(16).padStart(2, "0")}`;
}

export function getPeriodHeaderStyle(period: DayPeriodConfig | undefined, index: number): { backgroundColor: string; color: string } {
  const bg = getPeriodColor(period, index);
  return {
    backgroundColor: bg,
    color: luminance(bg) > 0.4 ? "#111827" : "#ffffff",
  };
}

export function getPeriodCardStyle(period: DayPeriodConfig | undefined, index: number): { backgroundColor: string; borderColor: string } {
  const bg = getPeriodColor(period, index);
  return {
    backgroundColor: lightenHex(bg, 0.92),
    borderColor: lightenHex(bg, 0.6),
  };
}

/** Text color for tile: dark on light background, white on dark. Use with getPeriodCardStyle for tiles. */
export function getPeriodTileTextColor(period: DayPeriodConfig | undefined, index: number): string {
  const bg = getPeriodColor(period, index);
  const lightBg = lightenHex(bg, 0.92);
  return luminance(lightBg) > 0.5 ? "#111827" : "#ffffff";
}
