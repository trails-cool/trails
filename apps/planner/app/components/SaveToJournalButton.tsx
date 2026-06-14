import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { computeSurfaceBreakdown } from "@trails-cool/map-core";
import type { YjsState } from "~/lib/use-yjs";
import { buildPlanGpx } from "~/lib/gpx-export";
import { readComputedRoute } from "~/lib/route-data";

interface SaveToJournalButtonProps {
  yjs: YjsState;
  sessionId: string;
  returnUrl?: string;
}

export function SaveToJournalButton({ yjs, sessionId, returnUrl }: SaveToJournalButtonProps) {
  const { t } = useTranslation("planner");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Full plan GPX (track + waypoints + no-go areas + notes) so the
      // route round-trips correctly through the journal.
      const gpx = buildPlanGpx(yjs);

      // Distance-weighted surface/waytype breakdown from the BRouter waytags
      // already in routeData — sent alongside the GPX so the journal can show
      // it without re-deriving (route-surface-breakdown, Path 1).
      const route = readComputedRoute(yjs.routeData);
      const breakdown =
        route.coordinates && route.coordinates.length > 1
          ? computeSurfaceBreakdown(route.coordinates, route.surfaces, route.highways)
          : null;
      const surfaceBreakdown =
        breakdown && (Object.keys(breakdown.surface).length > 0 || Object.keys(breakdown.highway).length > 0)
          ? breakdown
          : undefined;

      // POST to the planner's server-side proxy. The proxy attaches the
      // journal Bearer token (stored on the session row) and forwards
      // the GPX. Token never leaves the planner server — see
      // routes/api.save-to-journal.ts.
      const response = await fetch("/api/save-to-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gpx, ...(surfaceBreakdown ? { surfaceBreakdown } : {}) }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Save failed");
      }

      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [yjs, sessionId]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? t("saving") : t("saveToJournal")}
      </button>
      {saved && <span className="text-xs text-green-600">{t("saved")}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
      {saved && returnUrl && (
        <a href={returnUrl} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200">
          {t("returnToJournal")}
        </a>
      )}
    </div>
  );
}
