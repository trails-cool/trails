import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type SelectSize = "sm" | "md";

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: SelectSize;
}

const base =
  "appearance-none rounded-md border border-border bg-bg-raised text-text-hi " +
  "transition-colors focus-visible:border-accent focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent-border " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const sizes: Record<SelectSize, string> = {
  sm: "h-7 pl-2.5 pr-7 text-xs",
  md: "h-9 pl-3 pr-8 text-sm",
};

/**
 * Token-styled wrapper around a native <select>. Uses `appearance-none` plus an
 * overlaid chevron so the closed control looks consistent across browsers while
 * keeping native option-list behaviour and accessibility.
 */
export function Select({ size = "md", className, children, ...props }: SelectProps) {
  return (
    <span className="relative inline-flex">
      <select className={cn(base, sizes[size], className)} {...props}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-md"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}
