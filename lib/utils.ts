import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats 0–1 or 0–100 mastery values as a whole-number percentage string. */
export function formatMastery(value: number): string {
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

/** Maps a 0–100 mastery score to the semantic mastery band used across the UI. */
export function masteryBand(score: number): "weak" | "medium" | "strong" {
  if (score >= 75) return "strong";
  if (score >= 45) return "medium";
  return "weak";
}
