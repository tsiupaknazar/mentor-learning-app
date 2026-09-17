export function masteryBand(score: number): "weak" | "medium" | "strong" {
  if (score >= 75) return "strong";
  if (score >= 45) return "medium";
  return "weak";
}
