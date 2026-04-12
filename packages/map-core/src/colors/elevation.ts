export function routeGradeColor(grade: number): string {
  const absGrade = Math.abs(grade);
  if (absGrade < 3) return "#22c55e";
  if (absGrade < 6) return "#eab308";
  if (absGrade < 10) return "#f97316";
  if (absGrade < 15) return "#ef4444";
  return "#991b1b";
}

export function elevationColor(t: number): string {
  // green (0) → yellow (0.5) → red (1)
  if (t <= 0.5) {
    const r = Math.round(255 * (t * 2));
    return `rgb(${r}, 200, 50)`;
  }
  const g = Math.round(200 * (1 - (t - 0.5) * 2));
  return `rgb(255, ${g}, 50)`;
}
