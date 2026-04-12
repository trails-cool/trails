export function maxspeedColor(speed: string): string {
  if (speed === "walk") return "#22c55e";
  if (speed === "none") return "#991b1b";
  const num = parseInt(speed, 10);
  if (isNaN(num)) return "#9ca3af"; // unknown/gray
  if (num <= 20) return "#22c55e";
  if (num <= 30) return "#22c55e";
  if (num <= 50) return "#eab308";
  if (num <= 70) return "#f97316";
  if (num <= 100) return "#ef4444";
  return "#991b1b"; // >100 dark red
}
