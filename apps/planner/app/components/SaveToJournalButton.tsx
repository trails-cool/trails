import { useState, useCallback } from "react";
import * as Y from "yjs";
import type { YjsState } from "~/lib/use-yjs";
import { generateGpx } from "@trails-cool/gpx";
import type { TrackPoint } from "@trails-cool/gpx";

interface SaveToJournalButtonProps {
  yjs: YjsState;
  callbackUrl: string;
  callbackToken: string;
  returnUrl?: string;
}

export function SaveToJournalButton({ yjs, callbackUrl, callbackToken, returnUrl }: SaveToJournalButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Build GPX from current Yjs state
      const waypoints = yjs.waypoints.toArray().map((yMap: Y.Map<unknown>) => ({
        lat: yMap.get("lat") as number,
        lon: yMap.get("lon") as number,
        name: yMap.get("name") as string | undefined,
      }));

      let tracks: TrackPoint[][] = [];
      const geojsonStr = yjs.routeData.get("geojson") as string | undefined;
      if (geojsonStr) {
        try {
          const geojson = JSON.parse(geojsonStr);
          const coords: number[][] = geojson.features?.[0]?.geometry?.coordinates ?? [];
          if (coords.length > 0) {
            tracks = [coords.map((c) => ({ lat: c[1]!, lon: c[0]!, ele: c[2] }))];
          }
        } catch { /* invalid geojson */ }
      }

      const gpx = generateGpx({ name: "trails.cool route", waypoints, tracks });

      // POST to Journal callback
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${callbackToken}`,
        },
        body: JSON.stringify({ gpx }),
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
  }, [yjs, callbackUrl, callbackToken]);

  if (saved) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-green-600">Saved!</span>
        {returnUrl && (
          <a href={returnUrl} className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200">
            Return to Journal
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save to Journal"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
