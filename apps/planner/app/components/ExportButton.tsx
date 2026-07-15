import { useCallback, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { YjsState } from "~/lib/use-yjs";
import {
  buildDayGpxFiles,
  buildPlanGpx,
  buildRouteGpx,
  hasDayBreaks,
} from "~/lib/gpx-export";

function download(gpx: string, filename: string) {
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ yjs }: { yjs: YjsState }) {
  const { t } = useTranslation("planner");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside mousedown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExportRoute = useCallback(() => {
    download(buildRouteGpx(yjs), "route.gpx");
    setOpen(false);
  }, [yjs]);

  const handleExportPlan = useCallback(() => {
    download(buildPlanGpx(yjs), "route-plan.gpx");
    setOpen(false);
  }, [yjs]);

  const handleExportDays = useCallback(() => {
    for (const file of buildDayGpxFiles(yjs)) {
      download(file.gpx, file.filename);
    }
    setOpen(false);
  }, [yjs]);

  const hasMultipleDays = hasDayBreaks(yjs);

  const item =
    "block w-full px-3 py-1.5 text-left transition-colors hover:bg-bg-subtle";
  const split =
    "h-7 border border-border bg-bg-raised text-sm font-medium text-text-hi transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div ref={ref} className="relative z-[1001]">
      <div className="flex">
        <button
          onClick={handleExportRoute}
          className={`${split} rounded-l-md border-r-0 px-3`}
        >
          {t("exportGpx")}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          aria-label={t("exportOptions")}
          aria-expanded={open}
          className={`${split} rounded-r-md px-2 text-text-md`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-bg-raised py-1 shadow-md">
          <button onClick={handleExportRoute} className={item}>
            <span className="text-sm text-text-hi">{t("exportRoute")}</span>
            <span className="block text-xs text-text-lo">{t("exportRouteDesc")}</span>
          </button>
          <button onClick={handleExportPlan} className={item}>
            <span className="text-sm text-text-hi">{t("exportPlan")}</span>
            <span className="block text-xs text-text-lo">{t("exportPlanDesc")}</span>
          </button>
          {hasMultipleDays && (
            <button onClick={handleExportDays} className={item}>
              <span className="text-sm text-text-hi">{t("exportDays")}</span>
              <span className="block text-xs text-text-lo">{t("exportDaysDesc")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
