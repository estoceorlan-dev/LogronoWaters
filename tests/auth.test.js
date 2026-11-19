import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { authenticate, authorizeClaims } from "../server/auth.js";
import { createHandler } from "../api/handler.js";
import { createApiServer } from "../scripts/dev-api.js";

test("authorization requires verified allowlisted email and ignores caller role claims", () => {
  const env = {
    ADMIN_EMAILS: "owner@example.com",
    STAFF_EMAILS: "staff@example.com",
  };
  const claims = {
    sub: "user",
    email: "staff@example.com",
    emailVerified: true,
    name: "Staff",
    role: "admin",
  };
  assert.equal(authorizeClaims(claims, env).role, "staff");
  assert.equal(
    authorizeClaims({ ...claims, email: "OWNER@example.com" }, env).role,
    "admin",
  );
  for (const payload of [
    { ...claims, emailVerified: false },
    { ...claims, banned: true },
    { ...claims, email: "stranger@example.com" },
    { ...claims, sub: "" },
  ])
    assert.throws(() => authorizeClaims(payload, env));
  assert.throws(() => authorizeClaims(claims, {}));
});
let server, privateKey, base;
before(async () => {
  const keys = await generateKeyPair("EdDSA");
  privateKey = keys.privateKey;
  const key = {
    ...(await exportJWK(keys.publicKey)),
    kid: "test-key",
    alg: "EdDSA",
    use: "sig",
  };
  server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [key] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.NEON_AUTH_BASE_URL = `${base}/auth`;
  process.env.NEON_AUTH_JWKS_URL = `${base}/auth/.well-known/jwks.json`;
  process.env.ADMIN_EMAILS = "owner@example.com";
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});
const signed = (overrides = {}) =>
  new SignJWT({ email: "owner@example.com", emailVerified: true, ...overrides })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setSubject("user-1")
    .setIssuedAt()
    .setIssuer(base)
    .setAudience(base)
    .setExpirationTime("5m")
    .sign(privateKey);
test("server verifies signature, issuer, audience and staff identity", async () => {
  const user = await authenticate({
    headers: { authorization: `Bearer ${await signed()}` },
  });
  assert.equal(user.role, "admin");
  await assert.rejects(authenticate({ headers: {} }), (e) => e.status === 401);
  await assert.rejects(
    authenticate({ headers: { authorization: "Bearer forged" } }),
    (e) => e.status === 401,
  );
  await assert.rejects(
    authenticate({
      headers: {
        authorization: `Bearer ${await signed({ email: "outsider@example.com" })}`,
      },
    }),
    (e) => e.status === 403,
  );
  const bad = await new SignJWT({
    email: "owner@example.com",
    emailVerified: true,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setSubject("user-1")
    .setIssuedAt()
    .setIssuer("https://evil.example")
    .setAudience(base)
    .setExpirationTime("5m")
    .sign(privateKey);
  await assert.rejects(
    authenticate({ headers: { authorization: `Bearer ${bad}` } }),
    (e) => e.status === 401,
  );
});
test("HTTP API denies unauthenticated requests before touching the database", async () => {
  let touched = false;
  const api = createApiServer(
    createHandler({
      database: () => {
        touched = true;
        throw new Error("Should not execute");
      },
    }),
  );
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${api.address().port}/api/`;
  try {
    const denied = await fetch(`${url}orders`);
    assert.equal(denied.status, 401);
    assert.equal(touched, false);
    assert.equal(denied.headers.get("cache-control"), "no-store");
    const health = await fetch(`${url}health`);
    assert.equal(health.status, 200);
    assert.equal(touched, false);
    const invalid = await fetch(`${url}orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await signed()}`,
        "content-type": "application/json",
      },
      body: "{broken",
    });
    assert.equal(invalid.status, 400);
    assert.equal(touched, false);
    const wrongType = await fetch(`${url}orders`, {
      method: "POST",
      headers: { authorization: `Bearer ${await signed()}` },
      body: "text",
    });
    assert.equal(wrongType.status, 415);
  } finally {
    await new Promise((resolve) => api.close(resolve));
  }
});
