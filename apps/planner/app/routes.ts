import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("new", "routes/new.tsx"),
  route("api/sessions", "routes/api.sessions.ts"),
  route("api/route", "routes/api.route.ts"),
  route("api/route-segments", "routes/api.route-segments.ts"),
  route("api/overpass", "routes/api.overpass.ts"),
  route("api/save-to-journal", "routes/api.save-to-journal.ts"),
  route("session/:id", "routes/session.$id.tsx"),
] satisfies RouteConfig;
