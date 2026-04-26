import { redirect } from "react-router";

// /settings lands on the Profile section. Keeps deep-link friendliness
// (every section has a stable URL) without making the bare /settings
// URL feel empty.
export function loader() {
  return redirect("/settings/profile");
}
