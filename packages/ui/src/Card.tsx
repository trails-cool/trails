import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Raised surface with a soft shadow (topbar/sidebar panels). */
  raised?: boolean;
}

export function Card({ raised = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4",
        raised ? "bg-bg-raised shadow-sm" : "bg-bg-subtle",
        className,
      )}
      {...props}
    />
  );
}
