/** Typed API endpoint path constants */
export const ENDPOINTS = {
  discovery: "/.well-known/trails-cool",

  auth: {
    token: "/api/v1/auth/token",
    devices: "/api/v1/auth/devices",
    device: (id: string) => `/api/v1/auth/devices/${id}` as const,
  },

  routes: {
    list: "/api/v1/routes",
    create: "/api/v1/routes",
    detail: (id: string) => `/api/v1/routes/${id}` as const,
    update: (id: string) => `/api/v1/routes/${id}` as const,
    delete: (id: string) => `/api/v1/routes/${id}` as const,
    compute: "/api/v1/routes/compute",
  },

  activities: {
    list: "/api/v1/activities",
    create: "/api/v1/activities",
    detail: (id: string) => `/api/v1/activities/${id}` as const,
    delete: (id: string) => `/api/v1/activities/${id}` as const,
  },

  uploads: {
    presign: "/api/v1/uploads",
  },

  push: {
    subscribe: "/api/v1/push/subscribe",
    unsubscribe: "/api/v1/push/unsubscribe",
  },
} as const;
