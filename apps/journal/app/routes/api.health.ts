import { data } from "react-router";
import { withDb } from "@trails-cool/db";

export async function loader() {
  try {
    await withDb(async () => {
      // withDb creates a connection — if it succeeds, DB is reachable
    });
    return data({ status: "ok", db: "connected" });
  } catch {
    return data({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
