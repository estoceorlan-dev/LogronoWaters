import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";

export const authClient = import.meta.env.VITE_NEON_AUTH_URL
  ? createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
      adapter: BetterAuthReactAdapter({
        fetchOptions: { credentials: "include" },
      }),
    })
  : null;
