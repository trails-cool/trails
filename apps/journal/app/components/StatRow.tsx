import type { StatItem } from "~/lib/stats";

/**
 * The one shared headline-stat presentation. Surfaces pass an ordered list of
 * {value, label} items (built via `activityStatItems`); the component never
 * fetches or formats. `size="lg"` is the detail-page treatment; the default
 * compact size is for feed cards and the profile list.
 */
export function StatRow({
  items,
  size = "sm",
  className,
}: {
  items: StatItem[];
  size?: "sm" | "lg";
  className?: string;
}) {
  if (items.length === 0) return null;
  const valueCls =
    size === "lg"
      ? "text-2xl font-bold text-gray-900"
      : "text-sm font-semibold text-gray-900";
  const gap = size === "lg" ? "gap-6" : "gap-x-4 gap-y-1";
  return (
    <dl className={`flex flex-wrap ${gap}${className ? ` ${className}` : ""}`}>
      {items.map((it) => (
        <div key={it.label}>
          <dd className={valueCls}>{it.value}</dd>
          <dt className="text-xs text-gray-500">{it.label}</dt>
        </div>
      ))}
    </dl>
  );
}
