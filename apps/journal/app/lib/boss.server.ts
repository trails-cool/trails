import type { createBoss } from "@trails-cool/jobs";

type Boss = ReturnType<typeof createBoss>;

let boss: Boss | null = null;

export function setBoss(instance: Boss): void {
  boss = instance;
}

export function getBoss(): Boss {
  if (!boss) throw new Error("pg-boss not initialized — server still starting?");
  return boss;
}
