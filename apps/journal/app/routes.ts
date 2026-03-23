import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/register", "routes/auth.register.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/verify", "routes/auth.verify.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("api/auth/register", "routes/api.auth.register.ts"),
  route("api/auth/login", "routes/api.auth.login.ts"),
  route("users/:username", "routes/users.$username.tsx"),
] satisfies RouteConfig;
