import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type AvatarSize = "sm" | "md";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  /** Per-user color (e.g. Yjs awareness color). Falls back to the accent. */
  color?: string;
  size?: AvatarSize;
}

const sizes: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
};

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function Avatar({
  name,
  color,
  size = "md",
  className,
  style,
  ...props
}: AvatarProps) {
  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-text-inv select-none",
        !color && "bg-accent",
        sizes[size],
        className,
      )}
      style={color ? { backgroundColor: color, ...style } : style}
      {...props}
    >
      {initial(name)}
    </span>
  );
}
