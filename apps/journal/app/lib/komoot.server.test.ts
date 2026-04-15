import { describe, it, expect } from "vitest";
import { parseTourResponse } from "./komoot.server";

describe("komoot", () => {
  describe("parseTourResponse", () => {
    it("parses a page of tours", () => {
      const data = {
        _embedded: {
          tours: [
            {
              id: 12345,
              name: "Morning hike in the Alps",
              sport: "hike",
              date: "2026-03-15T08:30:00.000Z",
              distance: 15234.5,
              duration: 18900,
              elevation_up: 850,
              elevation_down: 830,
            },
            {
              id: 67890,
              name: "Cycling to work",
              sport: "touringbicycle",
              date: "2026-03-14T07:00:00.000Z",
              distance: 8500,
              duration: 1800,
              elevation_up: 45,
              elevation_down: 50,
            },
          ],
        },
      };

      const tours = parseTourResponse(data);
      expect(tours).toHaveLength(2);
      expect(tours[0]).toEqual({
        id: "12345",
        name: "Morning hike in the Alps",
        sport: "hike",
        date: "2026-03-15T08:30:00.000Z",
        distance: 15234.5,
        duration: 18900,
        elevationUp: 850,
        elevationDown: 830,
      });
    });

    it("handles empty response", () => {
      expect(parseTourResponse({})).toEqual([]);
      expect(parseTourResponse({ _embedded: {} })).toEqual([]);
      expect(parseTourResponse({ _embedded: { tours: [] } })).toEqual([]);
    });
  });
});
