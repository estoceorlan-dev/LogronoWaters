import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/database.js";
import { route } from "../server/router.js";
import {
  createOrder,
  updateOrder,
  stockOperation,
  dashboard,
} from "../server/service.js";
import { orderSchema } from "../server/validation.js";

const admin = {
  id: "admin-1",
  email: "owner@example.com",
  role: "admin",
  name: "Owner",
};
const staff = {
  id: "staff-1",
  email: "staff@example.com",
  role: "staff",
  name: "Staff",
};
let fixture, db, customer;
before(async () => {
  fixture = await testDatabase();
  db = fixture.db;
});
after(async () => {
  await fixture?.close();
});
beforeEach(async () => {
  await db.query(
    "TRUNCATE stock_movements, stock_operations, orders, customers, maintenance RESTART IDENTITY CASCADE",
  );
  await db.query(
    "UPDATE inventory SET quantity=100, reorder_level=20, supplier_id=NULL",
  );
  await db.query("DELETE FROM suppliers");
  await db.query(
    "UPDATE station_settings SET price_cents=3000, delivery_fee_cents=1500, timezone='Asia/Manila'",
  );
  customer = (
    await route({
      db,
      user: admin,
      method: "POST",
      path: "customers",
      body: {
        name: "Juan Dela Cruz",
        phone: "09123456789",
        address: "123 Main Street",
        notes: "",
      },
    })
  ).data;
});
const input = (overrides = {}) =>
  orderSchema.parse({
    request_id: randomUUID(),
    customer_id: customer.id,
    quantity: 5,
    fulfillment: "pickup",
    ...overrides,
  });
const stock = async (id) =>
  (await db.query("SELECT quantity FROM inventory WHERE id=$1", [id])).rows[0]
    .quantity;
const call = (method, path, body = {}, user = admin, query = {}) =>
  route({ db, user, method, path, body, query });

test("migration can be reapplied without resetting business data", async () => {
  const client = await db.connect();
  try {
    const { migrate } = await import("../scripts/migrate.js");
    await migrate(client);
  } finally {
    client.release();
  }
  assert.equal((await call("GET", "customers")).data.total, 1);
});
test("order price and delivery fee come from the server and reserve stock", async () => {
  const order = await createOrder(
    db,
    input({ fulfillment: "delivery" }),
    admin,
  );
  assert.equal(order.total_cents, 16500);
  assert.equal(order.status, "pending");
  assert.equal(await stock("filled"), 95);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM stock_movements")).rows[0]
      .n,
    1,
  );
});
test("repeated and concurrent creation retries reserve stock only once", async () => {
  const body = input();
  const [a, b] = await Promise.all([
    createOrder(db, body, admin),
    createOrder(db, body, admin),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(await stock("filled"), 95);
});
test("concurrent orders cannot oversell the remaining stock", async () => {
  const results = await Promise.allSettled([
    createOrder(db, input({ quantity: 80 }), admin),
    createOrder(db, input({ quantity: 80 }), admin),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await stock("filled"), 20);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM orders")).rows[0].n,
    1,
  );
});
test("insufficient stock rolls back both the order and movement", async () => {
  await assert.rejects(
    createOrder(db, input({ quantity: 101 }), admin),
    /Insufficient/,
  );
  assert.equal((await call("GET", "orders")).data.total, 0);
  assert.equal(await stock("filled"), 100);
});
test("cancellation restores reserved stock exactly once", async () => {
  const order = await createOrder(db, input(), admin);
  await Promise.all([
    updateOrder(db, order.id, { status: "cancelled" }, admin),
    updateOrder(db, order.id, { status: "cancelled" }, admin),
  ]);
  assert.equal(await stock("filled"), 100);
  await assert.rejects(
    updateOrder(db, order.id, { status: "completed" }, admin),
    /no longer/,
  );
});
test("paid cancellation requires a separately recorded refund", async () => {
  const order = await createOrder(db, input({ paid: true }), admin);
  await assert.rejects(
    updateOrder(db, order.id, { status: "cancelled" }, admin),
    /refund/,
  );
  await updateOrder(db, order.id, { paid: false }, admin);
  await updateOrder(db, order.id, { status: "cancelled" }, admin);
  assert.equal(await stock("filled"), 100);
});
test("completed orders cannot be reopened or cancelled", async () => {
  const order = await createOrder(db, input(), admin);
  await updateOrder(db, order.id, { status: "in_progress" }, admin);
  await updateOrder(db, order.id, { status: "completed" }, admin);
  await assert.rejects(
    updateOrder(db, order.id, { status: "pending" }, admin),
    /no longer/,
  );
  await assert.rejects(
    updateOrder(db, order.id, { status: "cancelled" }, admin),
    /no longer/,
  );
  assert.equal(await stock("filled"), 95);
});
test("price changes and customer edits preserve existing order snapshots", async () => {
  const order = await createOrder(db, input(), admin);
  await db.query("UPDATE station_settings SET price_cents=4000");
  await call("PUT", `customers/${customer.id}`, {
    name: "Changed name",
    phone: "",
    address: "New address",
    notes: "",
  });
  const {
    data: {
      items: [saved],
    },
  } = await call("GET", "orders");
  assert.equal(saved.customer_name, "Juan Dela Cruz");
  assert.equal(saved.total_cents, 15000);
  const next = await createOrder(db, input(), admin);
  assert.equal(next.total_cents, 20000);
  assert.equal(order.customer_name, "Juan Dela Cruz");
});
test("archived customers cannot receive new orders and existing orders remain", async () => {
  await createOrder(db, input(), admin);
  await call("PUT", `customers/${customer.id}`, {
    name: customer.name,
    address: customer.address,
    archived: true,
  });
  await assert.rejects(createOrder(db, input(), admin), /active customer/);
  assert.equal((await call("GET", "orders")).data.total, 1);
});
test("delivery requires an address; pickup does not", async () => {
  await db.query("UPDATE customers SET address='' WHERE id=$1", [customer.id]);
  await assert.rejects(
    createOrder(db, input({ fulfillment: "delivery" }), admin),
    /address/,
  );
  assert.equal((await createOrder(db, input(), admin)).fulfillment, "pickup");
});
test("refill production consumes empties and caps and creates filled stock", async () => {
  const d = { request_id: randomUUID(), quantity: 10 };
  await stockOperation(db, d, admin, true);
  await stockOperation(db, d, admin, true);
  assert.equal(await stock("empty"), 90);
  assert.equal(await stock("caps"), 90);
  assert.equal(await stock("filled"), 110);
  assert.equal((await call("GET", "inventory/history")).data.total, 3);
});
test("failed refill is atomic and can be retried after replenishment", async () => {
  await db.query("UPDATE inventory SET quantity=0 WHERE id='empty'");
  const d = { request_id: randomUUID(), quantity: 10 };
  await assert.rejects(stockOperation(db, d, admin, true), /Insufficient/);
  assert.equal(await stock("caps"), 100);
  assert.equal(await stock("filled"), 100);
  await db.query("UPDATE inventory SET quantity=10 WHERE id='empty'");
  await stockOperation(db, d, admin, true);
  assert.equal(await stock("filled"), 110);
});
test("stock adjustment cannot go negative and records actor/reason", async () => {
  await assert.rejects(
    stockOperation(
      db,
      {
        request_id: randomUUID(),
        item_id: "caps",
        delta: -101,
        reason: "Damaged",
      },
      admin,
    ),
    /Insufficient/,
  );
  const d = {
    request_id: randomUUID(),
    item_id: "caps",
    delta: 20,
    reason: "Supplier delivery",
  };
  await stockOperation(db, d, staff);
  await stockOperation(db, d, staff);
  const {
    data: { items },
  } = await call("GET", "inventory/history");
  assert.equal(items.length, 1);
  assert.equal(items[0].created_by, staff.email);
  assert.equal(items[0].balance, 120);
});
test("dashboard excludes cancelled, open, and unpaid orders from revenue", async () => {
  const paid = await createOrder(db, input({ paid: true }), admin);
  await updateOrder(db, paid.id, { status: "completed" }, admin);
  const unpaid = await createOrder(db, input({ quantity: 2 }), admin);
  await updateOrder(db, unpaid.id, { status: "completed" }, admin);
  await createOrder(db, input(), admin);
  const cancelled = await createOrder(db, input(), admin);
  await updateOrder(db, cancelled.id, { status: "cancelled" }, admin);
  const d = await dashboard(db);
  assert.equal(d.stats.revenue, 15000);
  assert.equal(d.stats.gallons, 7);
  assert.equal(d.stats.pending, 1);
  assert.equal(d.stats.outstanding, 6000);
  assert.equal(d.sales.length, 7);
  await updateOrder(db, unpaid.id, { paid: true }, staff);
  assert.equal((await dashboard(db)).stats.outstanding, 0);
});
test("pagination, search, and status filters use saved records", async () => {
  for (let i = 0; i < 3; i++) await createOrder(db, input(), admin);
  const { data } = await call("GET", "orders", {}, admin, {
    limit: "2",
    page: "2",
  });
  assert.equal(data.total, 3);
  assert.equal(data.items.length, 1);
  assert.equal(
    (await call("GET", "orders", {}, admin, { q: "ORD-2" })).data.items[0].id,
    "2",
  );
  assert.equal(
    (await call("GET", "orders", {}, admin, { status: "completed" })).data
      .total,
    0,
  );
  assert.equal(
    (await call("GET", "orders", {}, admin, { q: "' OR 1=1 --" })).data.total,
    0,
  );
});
test("CSV export escapes spreadsheet formulas and quotes", async () => {
  await call("PUT", `customers/${customer.id}`, {
    name: "=1+1",
    address: 'A "quoted" street',
  });
  await createOrder(db, input({ notes: "@SUM(A1)" }), admin);
  const { csv } = await call("GET", "orders/export");
  assert.ok(csv.includes("'" + "=1+1"));
  assert.ok(csv.includes('A ""quoted"" street'));
  assert.ok(csv.includes("'@SUM(A1)"));
});
test("staff permissions protect settings, suppliers, inventory configuration and refunds", async () => {
  const order = await createOrder(db, input({ paid: true }), admin);
  for (const [method, path, body] of [
    ["PUT", "settings", {}],
    ["POST", "suppliers", { name: "Supplier" }],
    ["PUT", "inventory/caps", { reorder_level: 10, supplier_id: null }],
    ["PATCH", `orders/${order.id}`, { paid: false }],
  ]) {
    await assert.rejects(
      call(method, path, body, staff),
      (e) => e.status === 403,
    );
  }
});
test("staff can progress an unpaid order while leaving its payment unchanged", async () => {
  const order = await createOrder(db, input(), staff);
  const result = await call(
    "PATCH",
    `orders/${order.id}`,
    { status: "completed", paid: false },
    staff,
  );
  assert.equal(result.data.status, "completed");
  assert.equal(result.data.paid, false);
});
test("input validation rejects forged prices, invalid quantities and unknown properties", async () => {
  await assert.rejects(
    call("POST", "orders", { ...input(), unit_price_cents: 1 }),
  );
  for (const quantity of [0, -1, 1.5, 10001])
    await assert.rejects(call("POST", "orders", { ...input(), quantity }));
  await assert.rejects(
    call("POST", "inventory/adjust", {
      request_id: randomUUID(),
      item_id: "caps",
      delta: 0,
      reason: "No change",
    }),
  );
  await assert.rejects(
    call("GET", "orders", {}, admin, { from: "2026-12-01", to: "2026-01-01" }),
  );
});
test("supplier assignment survives edits and becomes unassigned on removal", async () => {
  const { data: supplier } = await call("POST", "suppliers", {
    name: "Cap Supplier",
    phone: "123",
  });
  await call("PUT", "inventory/caps", {
    reorder_level: 30,
    supplier_id: supplier.id,
  });
  assert.equal(
    (await call("GET", "inventory")).data.find((i) => i.id === "caps")
      .supplier_name,
    "Cap Supplier",
  );
  await call("DELETE", `suppliers/${supplier.id}`);
  assert.equal(
    (await call("GET", "inventory")).data.find((i) => i.id === "caps")
      .supplier_id,
    null,
  );
});
test("maintenance can be scheduled, completed and reopened", async () => {
  const { data: m } = await call("POST", "maintenance", {
    equipment: "UV filter",
    description: "Replace lamp",
    due_date: "2020-01-01",
  });
  assert.equal((await dashboard(db)).maintenance.length, 1);
  await call("PATCH", `maintenance/${m.id}`, { completed: true }, staff);
  assert.equal((await dashboard(db)).maintenance.length, 0);
  await call("PATCH", `maintenance/${m.id}`, { completed: false }, staff);
  assert.equal((await dashboard(db)).maintenance.length, 1);
});

test("staff cannot archive or restore customers, but can edit contact details", async () => {
  await call(
    "PUT",
    `customers/${customer.id}`,
    { name: customer.name, address: "Updated address", archived: false },
    staff,
  );
  await assert.rejects(
    call(
      "PUT",
      `customers/${customer.id}`,
      { name: customer.name, archived: true },
      staff,
    ),
    (e) => e.status === 403,
  );
  await call(
    "PUT",
    `customers/${customer.id}`,
    { name: customer.name, archived: true },
    admin,
  );
  await assert.rejects(
    call(
      "PUT",
      `customers/${customer.id}`,
      { name: customer.name, archived: false },
      staff,
    ),
    (e) => e.status === 403,
  );
});

test("customer order history filters by identity even when names are identical", async () => {
  const second = (await call("POST", "customers", { name: customer.name }))
    .data;
  await createOrder(db, input(), admin);
  await createOrder(db, input({ customer_id: second.id }), admin);
  const { data } = await call("GET", "orders", {}, admin, {
    customer_id: customer.id,
  });
  assert.equal(data.total, 1);
  assert.equal(data.items[0].customer_id, customer.id);
});

test("date filters include the whole selected day in the station timezone", async () => {
  const start = await createOrder(db, input(), admin);
  const next = await createOrder(db, input(), admin);
  await db.query(
    "UPDATE orders SET created_at='2026-11-18T16:00:00Z' WHERE id=$1",
    [start.id],
  );
  await db.query(
    "UPDATE orders SET created_at='2026-11-19T16:00:00Z' WHERE id=$1",
    [next.id],
  );
  const { data } = await call("GET", "orders", {}, admin, {
    from: "2026-11-19",
    to: "2026-11-19",
  });
  assert.equal(data.total, 1);
  assert.equal(data.items[0].id, start.id);
});
