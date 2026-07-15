import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";

interface DayBreakdownProps {
  days: DayStage[];
  children: (dayStage: DayStage, waypointIndices: { start: number; end: number }) => React.ReactNode;
}

export function DayBreakdown({ days, children }: DayBreakdownProps) {
  const { t } = useTranslation("planner");
  const [expandedDay, setExpandedDay] = useState(1);

  return (
    <div className="flex flex-col">
      {days.map((day) => {
        const isExpanded = expandedDay === day.dayNumber;
        return (
          <div key={day.dayNumber}>
            <button
              onClick={() => setExpandedDay(isExpanded ? -1 : day.dayNumber)}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-left transition-colors hover:bg-bg-subtle"
            >
              <span className="text-xs font-semibold text-text-md">
                {t("multiDay.dayLabel", { n: day.dayNumber })}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-text-md">
                {day.startName && day.endName
                  ? `${day.startName} → ${day.endName}`
                  : day.startName || day.endName || ""}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-md">
                {(day.distance / 1000).toFixed(1)} km
              </span>
              <span className="shrink-0 text-xs text-text-lo">
                {isExpanded ? "▾" : "▸"}
              </span>
            </button>

            {isExpanded && (
              <>
                <div className="flex gap-3 border-b border-border bg-bg-subtle px-4 py-1.5 font-mono text-[10px] text-text-md">
                  <span>↑ {day.ascent} m</span>
                  <span>↓ {day.descent} m</span>
                </div>
                {children(day, { start: day.startWaypointIndex, end: day.endWaypointIndex })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
