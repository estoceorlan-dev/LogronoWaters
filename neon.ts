import { defineConfig } from "@neon/config/v1";

// Link the intended Neon project/branch before applying this configuration.
// Postgres is included with the project; Vercel hosts the application API.
export default defineConfig({ auth: true });
