import { redirect } from "react-router";

export function loader() {
  return redirect("/legal/privacy", 301);
}
