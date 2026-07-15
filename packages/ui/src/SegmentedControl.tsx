import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export type SegmentedSize = "sm" | "md";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedSize;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
}

const sizes: Record<SegmentedSize, string> = {
  sm: "h-7 text-xs",
  md: "h-9 text-sm",
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-bg-subtle p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center rounded px-3 font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              sizes[size],
              selected
                ? "bg-bg-raised text-text-hi shadow-sm"
                : "text-text-md hover:text-text-hi",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
