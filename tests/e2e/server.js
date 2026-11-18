// Test-only identity service and disposable Postgres. Never imported by production.
import http from "node:http";
import { createServer } from "vite";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { testDatabase } from "../helpers/database.js";
import { createHandler } from "../../api/handler.js";
import { createApiServer } from "../../scripts/dev-api.js";

const fixture = await testDatabase();
const { privateKey, publicKey } = await generateKeyPair("EdDSA");
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "e2e",
  alg: "EdDSA",
  use: "sig",
};
const origin = "http://127.0.0.1:3002";
const user = {
  id: "test-owner",
  email: "owner@example.com",
  emailVerified: true,
  name: "Station Owner",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const token = await new SignJWT(user)
  .setProtectedHeader({ alg: "EdDSA", kid: "e2e" })
  .setSubject(user.id)
  .setIssuedAt()
  .setIssuer(origin)
  .setAudience(origin)
  .setExpirationTime("1h")
  .sign(privateKey);
process.env.NEON_AUTH_BASE_URL = `${origin}/auth`;
process.env.ADMIN_EMAILS = user.email;
process.env.VITE_NEON_AUTH_URL = `${origin}/auth`;
const auth = http.createServer(async (req, res) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin === "http://127.0.0.1:5173") {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type,authorization,x-neon-client-info",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const path = new URL(req.url, origin).pathname;
  if (path.endsWith("/.well-known/jwks.json")) {
    res.end(JSON.stringify({ keys: [jwk] }));
    return;
  }
  const signedIn = req.headers.cookie?.includes("e2e_session=1");
  if (path.endsWith("/get-session")) {
    res.end(
      JSON.stringify(
        signedIn
          ? {
              user,
              session: {
                id: "test-session",
                userId: user.id,
                token,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              },
            }
          : null,
      ),
    );
    return;
  }
  if (path.endsWith("/token")) {
    if (!signedIn) {
      res.writeHead(401);
      res.end(JSON.stringify({ message: "Unauthorized" }));
    } else res.end(JSON.stringify({ token }));
    return;
  }
  if (path.endsWith("/sign-in/email")) {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    if (body.password !== "test-password") {
      res.writeHead(401);
      res.end(
        JSON.stringify({
          code: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        }),
      );
      return;
    }
    res.setHeader(
      "Set-Cookie",
      "e2e_session=1; HttpOnly; Path=/; SameSite=Lax",
    );
    res.end(JSON.stringify({ user, token: "opaque-session", redirect: false }));
    return;
  }
  if (path.endsWith("/sign-out")) {
    res.setHeader("Set-Cookie", "e2e_session=; HttpOnly; Path=/; Max-Age=0");
    res.end(JSON.stringify({ success: true }));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ message: `Unknown test auth endpoint ${path}` }));
});
const backend = createApiServer(createHandler({ database: () => fixture.db }));
await new Promise((resolve) => auth.listen(3002, "127.0.0.1", resolve));
await new Promise((resolve) => backend.listen(3001, "127.0.0.1", resolve));
const vite = await createServer({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
await vite.listen();
console.log("E2E station ready at http://127.0.0.1:5173");
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await vite.close();
  await Promise.all([
    new Promise((r) => auth.close(r)),
    new Promise((r) => backend.close(r)),
  ]);
  await fixture.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
