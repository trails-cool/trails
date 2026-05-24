// Komoot Importer capability adapter. Implements the Importer seam against
// the Komoot tours API.
//
// Two credential modes:
//   public       — unauthenticated, public tours only
//   authenticated — email/password (password AES-256-GCM encrypted at rest)

import { decrypt } from "../../../crypto.server.ts";
import { fetchKomootTours, fetchKomootTourGpx } from "../../../komoot.server.ts";
import { isAlreadyImported, importActivity } from "../../../sync/imports.server.ts";
import { getServiceById } from "../../manager.ts";
import type {
  CapabilityContext,
  ImportableList,
  ImportResult,
  Importer,
} from "../../registry.ts";

type KomootCreds =
  | { mode: "public"; komootUserId: string }
  | { mode: "authenticated"; email: string; encryptedPassword: string; komootUserId: string };

function getBasicAuthToken(creds: KomootCreds): string | undefined {
  if (creds.mode !== "authenticated") return undefined;
  const password = decrypt(creds.encryptedPassword);
  return Buffer.from(`${creds.email}:${password}`).toString("base64");
}

export const komootImporter: Importer = {
  async listImportable(ctx: CapabilityContext, page: number): Promise<ImportableList> {
    return ctx.withFreshCredentials(async (rawCreds) => {
      const creds = rawCreds as KomootCreds;
      const basicAuthToken = getBasicAuthToken(creds);
      let result: Awaited<ReturnType<typeof fetchKomootTours>>;
      try {
        result = await fetchKomootTours(creds.komootUserId, page, basicAuthToken);
      } catch {
        // Komoot API unavailable or user not found — show empty list
        return { workouts: [], total: 0, page, perPage: 50 };
      }
      return {
        workouts: result.tours.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.sport,
          startedAt: t.date,
          duration: t.duration > 0 ? t.duration : null,
          distance: t.distance > 0 ? t.distance : null,
          // fileUrl not used for Komoot — GPX is fetched directly in the import route
        })),
        total: result.tours.length * result.totalPages,
        page,
        perPage: 50,
      };
    });
  },

  async importOne(ctx: CapabilityContext, tourId: string): Promise<ImportResult> {
    return ctx.withFreshCredentials(async (rawCreds) => {
      const creds = rawCreds as KomootCreds;

      const service = await getServiceById(ctx.serviceId);
      if (!service) throw new Error(`Connected service ${ctx.serviceId} not found`);

      const userId = service.userId;
      if (await isAlreadyImported(userId, "komoot", tourId)) {
        throw new Error(`Tour ${tourId} already imported`);
      }

      const basicAuthToken = getBasicAuthToken(creds);

      let gpx: string | undefined;
      try {
        gpx = await fetchKomootTourGpx(tourId, basicAuthToken);
      } catch {
        // GPX unavailable — import activity without geometry
      }

      // Fetch first page to find tour name; fall back to generic name
      let tourName = `Komoot tour ${tourId}`;
      try {
        const result = await fetchKomootTours(creds.komootUserId, 1, basicAuthToken);
        const tour = result.tours.find((t) => t.id === tourId);
        if (tour) tourName = tour.name;
      } catch {
        // Ignore — use fallback name
      }

      const { activityId } = await importActivity(userId, "komoot", tourId, {
        name: tourName,
        gpx,
      });

      return { activityId, hadGeometry: !!gpx };
    });
  },
};
