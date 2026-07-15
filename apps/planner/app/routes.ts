import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("new", "routes/new.tsx"),
  route("api/sessions", "routes/api.sessions.ts"),
  route("api/route", "routes/api.route.ts"),
  route("api/route-segments", "routes/api.route-segments.ts"),
  route("api/pois", "routes/api.pois.ts"),
  route("api/save-to-journal", "routes/api.save-to-journal.ts"),
  route("session/:id", "routes/session.$id.tsx"),
  // Dev-only component gallery for the shared @trails-cool/ui primitives —
  // our lightweight stand-in for Storybook. Not compiled in production builds.
  ...(process.env.NODE_ENV === "production"
    ? []
    : [route("dev/ui", "routes/dev.ui.tsx")]),
] satisfies RouteConfig;
