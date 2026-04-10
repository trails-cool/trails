import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DayStage } from "@trails-cool/gpx";

interface DayBreakdownProps {
  days: DayStage[];
  children: (dayStage: DayStage, waypointIndices: { start: number; end: number }) => React.ReactNode;
}

export function DayBreakdown({ days, children }: DayBreakdownProps) {
  const { t } = useTranslation();
  const [expandedDay, setExpandedDay] = useState(1);

  return (
    <div className="flex flex-col">
      {days.map((day) => {
        const isExpanded = expandedDay === day.dayNumber;
        return (
          <div key={day.dayNumber}>
            <button
              onClick={() => setExpandedDay(isExpanded ? -1 : day.dayNumber)}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span className="text-xs font-semibold text-gray-500">
                {t("planner.multiDay.dayLabel", { n: day.dayNumber })}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-gray-600">
                {day.startName && day.endName
                  ? `${day.startName} → ${day.endName}`
                  : day.startName || day.endName || ""}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-gray-500">
                {(day.distance / 1000).toFixed(1)} km
              </span>
              <span className="shrink-0 text-xs text-gray-400">
                {isExpanded ? "▾" : "▸"}
              </span>
            </button>

            {isExpanded && (
              <>
                <div className="flex gap-3 border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] text-gray-500">
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
