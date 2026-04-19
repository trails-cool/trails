import { z } from "zod";

export const TokenExchangeRequestSchema = z.object({
  grant_type: z.enum(["authorization_code", "refresh_token"]),
  code: z.string().optional(),
  code_verifier: z.string().optional(),
  refresh_token: z.string().optional(),
  client_id: z.string(),
  redirect_uri: z.string().optional(),
  device_name: z.string().max(100).optional(),
});

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number(),
});

export const DeviceSchema = z.object({
  id: z.string(),
  deviceName: z.string().nullable(),
  lastActiveAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  isCurrent: z.boolean(),
});

export const DeviceListResponseSchema = z.object({
  devices: z.array(DeviceSchema),
});

export type TokenExchangeRequest = z.infer<typeof TokenExchangeRequestSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type DeviceListResponse = z.infer<typeof DeviceListResponseSchema>;
