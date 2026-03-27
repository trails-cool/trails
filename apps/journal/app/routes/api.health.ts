import { data } from "react-router";
import { withDb } from "@trails-cool/db";

const version = process.env.SENTRY_RELEASE ?? "dev";

export async function loader() {
  try {
    await withDb(async () => {});
    return data({ status: "ok", version, db: "connected" });
  } catch {
    return data({ status: "degraded", version, db: "unreachable" }, { status: 503 });
  }
}
