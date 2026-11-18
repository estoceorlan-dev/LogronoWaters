import { createRemoteJWKSet, jwtVerify } from "jose";
import { assert, HttpError } from "./errors.js";

let jwks;
export function authorizeClaims(payload, env = process.env) {
  assert(
    payload.sub &&
      payload.email &&
      payload.emailVerified === true &&
      !payload.banned,
    403,
    "A verified staff email is required.",
  );
  const email = payload.email.toLowerCase();
  const admins = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const staff = (env.STAFF_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  assert(
    admins.includes(email) || staff.includes(email),
    403,
    "Your account does not have station access. Contact the administrator.",
  );
  return {
    id: payload.sub,
    email,
    name: payload.name || email,
    role: admins.includes(email) ? "admin" : "staff",
  };
}

export async function authenticate(req) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  assert(token, 401, "Please sign in to continue.");
  const base = process.env.NEON_AUTH_BASE_URL;
  assert(
    base,
    503,
    "Authentication is not configured. Contact the administrator.",
  );
  jwks ??= createRemoteJWKSet(
    new URL(
      process.env.NEON_AUTH_JWKS_URL ||
        `${base.replace(/\/$/, "")}/.well-known/jwks.json`,
    ),
  );
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      algorithms: ["EdDSA"],
      issuer: new URL(base).origin,
      audience: new URL(base).origin,
      requiredClaims: ["sub", "exp", "iat"],
    }));
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  return authorizeClaims(payload);
}

export function requireAdmin(user) {
  assert(user.role === "admin", 403, "Administrator access is required.");
}
