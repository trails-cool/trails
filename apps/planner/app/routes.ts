import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/sessions", "routes/api.sessions.ts"),
  route("session/:id", "routes/session.$id.tsx"),
] satisfies RouteConfig;
