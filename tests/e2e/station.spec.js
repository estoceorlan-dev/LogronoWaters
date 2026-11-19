import { test, expect } from "@playwright/test";

test("unverified sign-in opens the email-code form after a normalized SDK error", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill("unverified@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verify your email", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Verification code for unverified@example.com"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resend verification code" }),
  ).toBeVisible();
});

async function login(page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard overview" }),
  ).toBeVisible();
}

test("sign-in, customer, stock, order, payment, settings and reload work together", async ({
  page,
}) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await login(page);
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.getByLabel("Full name").fill("Maria Santos");
  await page.getByLabel("Phone", { exact: true }).fill("09171234567");
  await page.getByLabel("Delivery address").fill("25 Rizal Street");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add customer", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Maria Santos", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Adjust stock", exact: true }).click();
  await page.getByLabel("Stock item").selectOption("filled");
  await page.getByLabel("Quantity change").fill("25");
  await page.getByLabel("Reason", { exact: true }).fill("Opening stock");
  await page.getByRole("button", { name: "Record stock adjustment" }).click();
  await expect(
    page.getByRole("cell", { name: "Opening stock", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await page.getByRole("button", { name: "New order", exact: true }).click();
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Maria Santos · 09171234567" });
  await page.getByLabel("5-gallon containers", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Create order and reserve stock" })
    .click();
  await expect(
    page.getByRole("cell", {
      name: "Maria Santos Station pickup",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page.getByLabel("Order status").selectOption("completed");
  await page.getByLabel("Payment collected").check();
  await page.getByRole("button", { name: "Update order", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Completed", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Paid", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("aquaflow-orders.csv");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText("₱90.00", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Station name").fill("AquaFlow Test Station");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Station settings saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Station name")).toHaveValue(
    "AquaFlow Test Station",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("wrong password and mobile navigation have usable feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Orders management" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inventory monitor" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-inventory.png",
    fullPage: true,
  });
});

test("production, suppliers, maintenance and theme controls persist changes", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  for (const [item, reason] of [
    ["empty", "Returned empties"],
    ["caps", "New caps"],
  ]) {
    await page
      .getByRole("button", { name: "Adjust stock", exact: true })
      .click();
    await page.getByLabel("Stock item").selectOption(item);
    await page.getByLabel("Quantity change").fill("10");
    await page.getByLabel("Reason", { exact: true }).fill(reason);
    await page.getByRole("button", { name: "Record stock adjustment" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Record refill production", exact: true })
    .click();
  await page.getByLabel("Number of 5-gallon containers filled").fill("5");
  await page
    .getByRole("button", { name: "Record production", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Refill production", exact: true }),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  await page.getByLabel("Supplier name").fill("Clean Water Supplies");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Clean Water Supplies", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configure stock alert & supplier" })
    .first()
    .click();
  await page.getByLabel("Low-stock threshold").fill("8");
  await page
    .getByLabel("Preferred supplier")
    .selectOption({ label: "Clean Water Supplies" });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Supplier: Clean Water Supplies", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Maintenance", exact: true }).click();
  await page
    .getByRole("button", { name: "Schedule maintenance", exact: true })
    .click();
  await page.getByLabel("Equipment", { exact: true }).fill("RO membrane");
  await page.getByLabel("Task", { exact: true }).fill("Replace filter");
  await page.getByLabel("Due date", { exact: true }).fill("2020-01-01");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Schedule maintenance", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "RO membrane", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-maintenance.png",
    fullPage: true,
  });
});
