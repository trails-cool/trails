import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/register", "routes/auth.register.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/verify", "routes/auth.verify.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("api/auth/register", "routes/api.auth.register.ts"),
  route("api/auth/login", "routes/api.auth.login.ts"),
  route("routes", "routes/routes._index.tsx"),
  route("routes/new", "routes/routes.new.tsx"),
  route("routes/:id", "routes/routes.$id.tsx"),
  route("routes/:id/edit", "routes/routes.$id.edit.tsx"),
  route("api/routes/:id/callback", "routes/api.routes.$id.callback.ts"),
  route("api/routes/:id/edit-in-planner", "routes/api.routes.$id.edit-in-planner.ts"),
  route("api/routes/:id/gpx", "routes/api.routes.$id.gpx.ts"),
  route("users/:username", "routes/users.$username.tsx"),
] satisfies RouteConfig;
