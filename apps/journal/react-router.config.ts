import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  future: {
    // Route middleware — used for ActivityPub content negotiation on
    // /users/:username (see app/lib/federation.server.ts). No loader or
    // action reads the `context` arg, so the flag's type change to
    // RouterContextProvider is a no-op for existing code.
    v8_middleware: true,
  },
} satisfies Config;
