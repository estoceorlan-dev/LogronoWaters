import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
import { assert } from "./errors.js";
import { requireAdmin } from "./auth.js";

export const orderColumns =
  "id::text, request_id, customer_id, customer_name, address, quantity, unit_price_cents, delivery_fee_cents, total_cents::float8, fulfillment, status, paid, notes, created_at, completed_at, updated_at";

export async function moveStock(
  client,
  item,
  delta,
  reason,
  user,
  orderId = null,
  operationId = null,
) {
  const { rows } = await client.query(
    "UPDATE inventory SET quantity = quantity + $2, updated_at = now() WHERE id = $1 AND quantity + $2 BETWEEN 0 AND 100000000 RETURNING quantity",
    [item, delta],
  );
  assert(
    rows.length,
    409,
    `Insufficient ${item} stock or stock limit exceeded.`,
  );
  await client.query(
    "INSERT INTO stock_movements (item_id, delta, balance, reason, created_by, order_id, operation_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [item, delta, rows[0].quantity, reason, user.email, orderId, operationId],
  );
}

export function createOrder(db, input, user) {
  return transaction(db, async (client) => {
    // Serialize retries of the same request before reserving stock.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      input.request_id,
    ]);
    const previous = await client.query(
      `SELECT ${orderColumns} FROM orders WHERE request_id = $1`,
      [input.request_id],
    );
    if (previous.rows.length) return previous.rows[0];
    const { rows: customers } = await client.query(
      "SELECT name, address FROM customers WHERE id = $1 AND NOT archived FOR SHARE",
      [input.customer_id],
    );
    assert(customers.length, 400, "Choose an active customer.");
    const customer = customers[0];
    assert(
      input.fulfillment !== "delivery" || customer.address.trim(),
      400,
      "A delivery address is required. Update the customer first.",
    );
    const {
      rows: [settings],
    } = await client.query(
      "SELECT price_cents, delivery_fee_cents FROM station_settings WHERE id = 1",
    );
    const {
      rows: [order],
    } = await client.query(
      `INSERT INTO orders (request_id, customer_id, customer_name, address, quantity, unit_price_cents, delivery_fee_cents, fulfillment, paid, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${orderColumns}`,
      [
        input.request_id,
        input.customer_id,
        customer.name,
        customer.address,
        input.quantity,
        settings.price_cents,
        input.fulfillment === "delivery" ? settings.delivery_fee_cents : 0,
        input.fulfillment,
        input.paid,
        input.notes,
        user.email,
      ],
    );
    await moveStock(
      client,
      "filled",
      -input.quantity,
      `Reserved for order #${order.id}`,
      user,
      order.id,
    );
    return order;
  });
}

export function updateOrder(db, id, input, user) {
  return transaction(db, async (client) => {
    const {
      rows: [order],
    } = await client.query(
      "SELECT status, quantity, paid FROM orders WHERE id = $1 FOR UPDATE",
      [id],
    );
    assert(order, 404, "Order not found.");
    if (order.paid && input.paid === false) requireAdmin(user);
    const next = input.status || order.status;
    const transitions = {
      pending: ["in_progress", "completed", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };
    assert(
      next === order.status || transitions[order.status].includes(next),
      409,
      "This order status can no longer be changed.",
    );
    assert(
      order.status !== "cancelled" ||
        input.paid === undefined ||
        input.paid === order.paid,
      409,
      "Payment cannot be changed on a cancelled order.",
    );
    if (next === "cancelled" && order.status !== "cancelled") {
      assert(
        !order.paid,
        409,
        "Record the refund by marking this order unpaid before cancelling.",
      );
      assert(input.paid !== true, 400, "A cancelled order cannot be paid.");
      await moveStock(
        client,
        "filled",
        order.quantity,
        `Cancelled order #${id}`,
        user,
        id,
      );
    }
    const {
      rows: [result],
    } = await client.query(
      `UPDATE orders SET status = $2, paid = $3, completed_at = CASE WHEN $2 = 'completed' THEN coalesce(completed_at, now()) ELSE completed_at END, updated_at = now() WHERE id = $1 RETURNING ${orderColumns}`,
      [id, next, input.paid ?? order.paid],
    );
    return result;
  });
}

export function stockOperation(db, input, user, refill = false) {
  return transaction(db, async (client) => {
    const inserted = await client.query(
      "INSERT INTO stock_operations (id, kind, created_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id",
      [input.request_id, refill ? "refill" : "adjustment", user.email],
    );
    if (!inserted.rows.length) return { ok: true };
    // Consistent lock order avoids deadlocks with concurrent refill/adjustment requests.
    await client.query(
      "SELECT id FROM inventory WHERE id IN ('caps','empty','filled') ORDER BY id FOR UPDATE",
    );
    if (refill) {
      await moveStock(
        client,
        "caps",
        -input.quantity,
        "Refill production",
        user,
        null,
        input.request_id,
      );
      await moveStock(
        client,
        "empty",
        -input.quantity,
        "Refill production",
        user,
        null,
        input.request_id,
      );
      await moveStock(
        client,
        "filled",
        input.quantity,
        "Refill production",
        user,
        null,
        input.request_id,
      );
    } else {
      await moveStock(
        client,
        input.item_id,
        input.delta,
        input.reason,
        user,
        null,
        input.request_id,
      );
    }
    return { ok: true };
  });
}

export function newId() {
  return randomUUID();
}

export function orderFilters(query) {
  const values = [
    `%${query.q}%`,
    query.status,
    query.from || null,
    query.to || null,
    query.customer_id || null,
  ];
  const where = `WHERE (customer_name ILIKE $1 OR ('ORD-' || id::text) ILIKE $1 OR address ILIKE $1)
    AND ($2 = '' OR status = $2)
    AND ($3::date IS NULL OR created_at >= ($3::date::timestamp AT TIME ZONE (SELECT timezone FROM station_settings WHERE id=1)))
    AND ($4::date IS NULL OR created_at < (($4::date + 1)::timestamp AT TIME ZONE (SELECT timezone FROM station_settings WHERE id=1)))
    AND ($5::uuid IS NULL OR customer_id = $5::uuid)`;
  return { values, where };
}

export async function listOrders(db, query) {
  const { values, where } = orderFilters(query);
  const {
    rows: [{ count }],
  } = await db.query(`SELECT count(*)::int FROM orders ${where}`, values);
  const { rows } = await db.query(
    `SELECT ${orderColumns} FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT $6 OFFSET $7`,
    [...values, query.limit, (query.page - 1) * query.limit],
  );
  return { items: rows, total: count, page: query.page, limit: query.limit };
}

export async function dashboard(db) {
  const {
    rows: [settings],
  } = await db.query("SELECT timezone FROM station_settings WHERE id = 1");
  const zone = settings.timezone;
  const {
    rows: [stats],
  } = await db.query(
    `SELECT
    coalesce(sum(total_cents) FILTER (WHERE status='completed' AND paid AND (completed_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date),0)::float8 AS revenue,
    coalesce(sum(quantity) FILTER (WHERE status='completed' AND (completed_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date),0)::int AS gallons,
    count(*) FILTER (WHERE status IN ('pending','in_progress'))::int AS pending,
    coalesce(sum(total_cents) FILTER (WHERE status='completed' AND NOT paid),0)::float8 AS outstanding
    FROM orders`,
    [zone],
  );
  const { rows: sales } = await db.query(
    `SELECT d::date::text AS day, coalesce(sum(o.total_cents),0)::float8 AS sales FROM
    generate_series((now() AT TIME ZONE $1)::date - 6, (now() AT TIME ZONE $1)::date, interval '1 day') d
    LEFT JOIN orders o ON (o.completed_at AT TIME ZONE $1)::date = d::date AND o.status='completed' AND o.paid GROUP BY d ORDER BY d`,
    [zone],
  );
  const { rows: inventory } = await db.query(
    "SELECT id, name, quantity, unit, reorder_level FROM inventory ORDER BY id",
  );
  const { rows: recent } = await db.query(
    `SELECT ${orderColumns} FROM orders ORDER BY created_at DESC, id DESC LIMIT 5`,
  );
  const {
    rows: [{ count: customerCount }],
  } = await db.query("SELECT count(*)::int FROM customers WHERE NOT archived");
  const { rows: maintenance } = await db.query(
    "SELECT id, equipment, due_date FROM maintenance WHERE completed_at IS NULL AND due_date <= (now() AT TIME ZONE $1)::date ORDER BY due_date LIMIT 10",
    [zone],
  );
  return {
    stats: { ...stats, customers: customerCount },
    sales,
    inventory,
    recent,
    maintenance,
  };
}
