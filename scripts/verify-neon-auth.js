import "./env.js";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

// Opt-in live verification. Credentials and the user-supplied OTP stay in an
// ignored local file; no test identity or authorization bypass is installed.
const credentialPath = new URL("../.neon-verification.local", import.meta.url);
const email = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
if (!email || !process.env.NEON_AUTH_BASE_URL || !process.env.DATABASE_URL) {
  throw new Error(
    "Configure Neon environment variables and ADMIN_EMAILS first.",
  );
}
let credentials;
try {
  credentials = JSON.parse(await readFile(credentialPath, "utf8"));
  if (credentials.email !== email)
    throw new Error("Verification account does not match ADMIN_EMAILS.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  credentials = {
    email,
    password: randomBytes(32).toString("base64url"),
    registered: false,
  };
  await writeFile(credentialPath, JSON.stringify(credentials), { mode: 0o600 });
}
// A previous run's code may have expired or been consumed. Only accept a new
// code supplied after this run starts; keep the account password unchanged.
delete credentials.otp;
await writeFile(credentialPath, JSON.stringify(credentials), { mode: 0o600 });

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto("http://localhost:5173");
  if (!credentials.registered) {
    await page.getByRole("button", { name: "Create staff account" }).click();
    await page.getByLabel("Full name").fill("Station Administrator");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(credentials.password);
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/sign-up/email") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    if (!(await response).ok())
      throw new Error(
        "Live signup failed. Inspect the app's account error before retrying; no existing password was changed.",
      );
    credentials.registered = true;
    await writeFile(credentialPath, JSON.stringify(credentials), {
      mode: 0o600,
    });
    console.log(
      "PASS: Live Neon account signup accepted; verification email requested.",
    );
  } else {
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }

  const state = await Promise.race([
    page
      .getByRole("heading", { name: "Verify your email", exact: true })
      .waitFor()
      .then(() => "verify"),
    page
      .getByRole("heading", { name: "Dashboard overview", exact: true })
      .waitFor()
      .then(() => "signed-in"),
  ]);
  if (state === "verify") {
    console.log(
      "WAITING_FOR_EMAIL_CODE: Enter the received verification code into the otp field in .neon-verification.local.",
    );
    // Keep the browser ready across user turns; individual OTP lifetimes are
    // enforced by Neon and rejected codes can be replaced without restarting.
    const expires = Date.now() + 60 * 60 * 1000;
    let verified = false;
    while (Date.now() < expires) {
      const current = JSON.parse(await readFile(credentialPath, "utf8"));
      if (!current.otp) {
        await delay(1000);
        continue;
      }
      const otp = String(current.otp);
      await writeFile(credentialPath, JSON.stringify(credentials), {
        mode: 0o600,
      });
      await page.getByLabel(`Verification code for ${email}`).fill(otp);
      const response = page.waitForResponse(
        (r) =>
          r.url().includes("/email-otp/verify-email") &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Verify email", exact: true })
        .click();
      const result = await response;
      if (result.ok()) {
        verified = true;
        break;
      }
      // Keep the live browser open when a code expires instead of terminating
      // the flow. The app's resend action requests a replacement through Neon.
      console.log(
        `VERIFICATION_CODE_REJECTED: HTTP ${result.status()}; requesting a fresh email code.`,
      );
      await page
        .getByRole("button", { name: "Resend verification code", exact: true })
        .click();
      console.log(
        "WAITING_FOR_EMAIL_CODE: Use the newest code from the replacement email.",
      );
    }
    if (!verified)
      throw new Error(
        "Email verification remains pending: no accepted code was supplied within one hour.",
      );
    await expect(
      page.getByRole("heading", { name: "Welcome back", exact: true }),
    ).toBeVisible();
    console.log("PASS: Live Neon email verification completed.");
    await writeFile(credentialPath, JSON.stringify(credentials), {
      mode: 0o600,
    });
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Dashboard overview", exact: true }),
  ).toBeVisible();
  console.log(
    "PASS: Real Neon sign-in loaded the production Postgres dashboard.",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dashboard overview", exact: true }),
  ).toBeVisible();
  console.log("PASS: Managed Auth session survived a page reload.");
  for (const [name, heading] of [
    ["Orders", "Orders management"],
    ["Customers", "Customer directory"],
    ["Inventory", "Inventory monitor"],
    ["Settings", "Station settings"],
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await expect(page.getByLabel("Station name")).toBeVisible();
  console.log(
    "PASS: Orders, customers, inventory, and administrator settings loaded through the real authenticated API.",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  // Wait for the sign-out request and state update before navigating; otherwise
  // page.goto can cancel the in-flight request and leave the session active.
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await page.goto("http://localhost:5173/orders");
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  const denied = await context.request.get("http://localhost:5173/api/orders");
  if (denied.status() !== 401)
    throw new Error("Signed-out API access was not denied.");
  console.log(
    "PASS: Sign-out protected the page and unauthenticated API requests returned HTTP 401.",
  );
} finally {
  await browser.close();
}
