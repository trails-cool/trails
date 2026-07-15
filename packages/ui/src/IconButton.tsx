import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type IconButtonVariant = "ghost" | "secondary";
export type IconButtonSize = "sm" | "md";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required accessible name — the button has no visible text. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const base =
  "inline-flex items-center justify-center rounded-md transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-1 focus-visible:ring-offset-bg " +
  "disabled:pointer-events-none disabled:opacity-30";

const variants: Record<IconButtonVariant, string> = {
  ghost: "text-text-md hover:bg-bg-subtle hover:text-text-hi",
  secondary:
    "border border-border bg-bg-raised text-text-hi hover:bg-bg-subtle",
};

const sizes: Record<IconButtonSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
};

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
