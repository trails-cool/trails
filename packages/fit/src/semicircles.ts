const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;

export function degToSemicircles(deg: number): number {
  return Math.round(deg * SEMICIRCLES_PER_DEGREE);
}

export function semicirclesToDeg(semi: number): number {
  return semi / SEMICIRCLES_PER_DEGREE;
}
