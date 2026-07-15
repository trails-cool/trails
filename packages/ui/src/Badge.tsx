import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type BadgeTone = "neutral" | "accent" | "stop";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const base =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-bg-subtle text-text-md",
  accent: "bg-accent-bg text-accent",
  stop: "bg-stop-bg text-stop",
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span className={cn(base, tones[tone], className)} {...props} />;
}
