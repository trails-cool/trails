import { redirect } from "react-router";

// Folded into /notifications as the Requests tab. Kept as a 301 so any
// pre-existing bookmark, email link, or notification deep-link still
// resolves.
export function loader() {
  return redirect("/notifications?tab=requests", 301);
}
