export { API_VERSION } from "./version.ts";
export { ENDPOINTS } from "./endpoints.ts";

// Error schemas
export {
  ApiErrorResponseSchema, FieldErrorSchema, ERROR_CODES,
  zodIssuesToFieldErrors,
  type ApiErrorResponse, type FieldError,
} from "./errors.ts";

// Pagination
export {
  PaginationQuerySchema, PaginatedResponseSchema,
  type PaginationQuery, type PaginatedResponse,
} from "./pagination.ts";

// Discovery
export {
  DiscoveryResponseSchema,
  type DiscoveryResponse,
} from "./discovery.ts";

// Auth
export {
  TokenExchangeRequestSchema, TokenResponseSchema,
  DeviceSchema, DeviceListResponseSchema,
  type TokenExchangeRequest, type TokenResponse,
  type Device, type DeviceListResponse,
} from "./auth.ts";

// Routes
export {
  RouteSummarySchema, RouteDetailSchema, RouteVersionSchema,
  RouteListResponseSchema,
  CreateRouteRequestSchema, UpdateRouteRequestSchema,
  ComputeRouteRequestSchema,
  type RouteSummary, type RouteDetail, type RouteVersion,
  type RouteListResponse,
  type CreateRouteRequest, type UpdateRouteRequest,
  type ComputeRouteRequest,
} from "./routes.ts";

// Activities
export {
  ActivitySummarySchema, ActivityDetailSchema,
  ActivityListResponseSchema,
  CreateActivityRequestSchema,
  type ActivitySummary, type ActivityDetail,
  type ActivityListResponse,
  type CreateActivityRequest,
} from "./activities.ts";

// Uploads
export {
  PresignedUploadRequestSchema, PresignedUploadResponseSchema,
  type PresignedUploadRequest, type PresignedUploadResponse,
} from "./uploads.ts";
