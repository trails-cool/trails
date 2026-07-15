import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-text-inv hover:bg-accent-dim",
  secondary:
    "border border-border bg-bg-raised text-text-hi hover:bg-bg-subtle",
  ghost: "text-text-md hover:bg-bg-subtle hover:text-text-hi",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
