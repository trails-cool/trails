import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production",
);

const ISSUER = process.env.ORIGIN ?? "http://localhost:3000";

export async function createRouteToken(routeId: string, permissions: string[] = ["read", "write"]): Promise<string> {
  return new SignJWT({ route_id: routeId, permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyRouteToken(token: string): Promise<{ routeId: string; permissions: string[] }> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: ISSUER,
  });

  return {
    routeId: payload.route_id as string,
    permissions: payload.permissions as string[],
  };
}
