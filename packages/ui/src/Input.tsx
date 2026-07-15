import type { InputHTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const base =
  "h-9 w-full rounded-md border border-border bg-bg-raised px-3 text-sm " +
  "text-text-hi placeholder:text-text-lo transition-colors " +
  "focus-visible:border-accent focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent-border " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, type = "text", ...props }: InputProps) {
  return <input type={type} className={cn(base, className)} {...props} />;
}
