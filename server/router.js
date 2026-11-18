import { z } from "zod";
import * as v from "./validation.js";
import * as service from "./service.js";
import { assert, HttpError } from "./errors.js";
import { requireAdmin } from "./auth.js";

function safeCsv(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function route({ db, user, method, path, query = {}, body = {} }) {
  const parts = path.split("/").filter(Boolean);
  const [resource, id] = parts;
  assert(parts.length <= 2, 404, "Endpoint not found.");
  if (resource === "me" && method === "GET" && !id) return { data: user };
  if (resource === "dashboard" && method === "GET" && !id)
    return { data: await service.dashboard(db) };
  if (resource === "settings" && !id) {
    if (method === "GET")
      return {
        data: (
          await db.query(
            "SELECT name, address, phone, price_cents, delivery_fee_cents, timezone, updated_at FROM station_settings WHERE id = 1",
          )
        ).rows[0],
      };
    if (method === "PUT") {
      requireAdmin(user);
      const data = v.settingsSchema.parse(body);
      const result = await db.query(
        "UPDATE station_settings SET name=$1, address=$2, phone=$3, price_cents=$4, delivery_fee_cents=$5, timezone=$6, updated_at=now() WHERE id=1 RETURNING name, address, phone, price_cents, delivery_fee_cents, timezone, updated_at",
        Object.values(data),
      );
      return { data: result.rows[0] };
    }
  }
  if (resource === "orders") {
    if (!id && method === "GET")
      return { data: await service.listOrders(db, v.listSchema.parse(query)) };
    if (!id && method === "POST")
      return {
        status: 201,
        data: await service.createOrder(db, v.orderSchema.parse(body), user),
      };
    if (id === "export" && method === "GET") {
      const { values, where } = service.orderFilters(v.listSchema.parse(query));
      const { rows } = await db.query(
        `SELECT ${service.orderColumns} FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT 10001`,
        values,
      );
      assert(
        rows.length <= 10000,
        400,
        "Export supports up to 10,000 orders. Narrow the date range.",
      );
      const headers = [
        "Order",
        "Customer",
        "Address",
        "Containers",
        "Unit price (PHP)",
        "Delivery fee (PHP)",
        "Total (PHP)",
        "Fulfillment",
        "Status",
        "Paid",
        "Created",
        "Notes",
      ];
      const csv = [
        headers,
        ...rows.map((o) => [
          `ORD-${o.id}`,
          o.customer_name,
          o.address,
          o.quantity,
          (o.unit_price_cents / 100).toFixed(2),
          (o.delivery_fee_cents / 100).toFixed(2),
          (o.total_cents / 100).toFixed(2),
          o.fulfillment,
          o.status,
          o.paid ? "Yes" : "No",
          new Date(o.created_at).toISOString(),
          o.notes,
        ]),
      ]
        .map((row) => row.map(safeCsv).join(","))
        .join("\r\n");
      return { csv };
    }
    if (id && method === "PATCH") {
      z.string()
        .regex(/^[1-9]\d{0,17}$/)
        .parse(id);
      return {
        data: await service.updateOrder(
          db,
          id,
          v.orderUpdateSchema.parse(body),
          user,
        ),
      };
    }
  }
  if (resource === "customers") {
    if (!id && method === "GET") {
      const q = v.listSchema.parse(query);
      const args = [`%${q.q}%`, q.archived === "true"];
      const filter =
        "WHERE (c.name ILIKE $1 OR c.phone ILIKE $1 OR c.address ILIKE $1) AND c.archived=$2";
      const {
        rows: [{ total }],
      } = await db.query(
        `SELECT count(*)::int AS total FROM customers c ${filter}`,
        args,
      );
      const { rows } = await db.query(
        `SELECT c.id, c.name, c.phone, c.address, c.notes, c.archived, c.created_at, c.updated_at,
        (SELECT count(*)::int FROM orders o WHERE o.customer_id=c.id) AS order_count,
        (SELECT coalesce(sum(total_cents),0)::float8 FROM orders o WHERE o.customer_id=c.id AND status='completed' AND paid) AS spent_cents
        FROM customers c ${filter} ORDER BY c.name, c.id LIMIT $3 OFFSET $4`,
        [...args, q.limit, (q.page - 1) * q.limit],
      );
      return { data: { items: rows, total, page: q.page, limit: q.limit } };
    }
    if (!id && method === "POST") {
      const d = v.customerSchema.parse(body);
      if (d.archived) requireAdmin(user);
      return {
        status: 201,
        data: (
          await db.query(
            "INSERT INTO customers (id, name, phone, address, notes, archived) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, phone, address, notes, archived",
            [service.newId(), ...Object.values(d)],
          )
        ).rows[0],
      };
    }
    if (id && method === "PUT") {
      v.uuid.parse(id);
      const d = v.customerSchema.parse(body);
      const {
        rows: [current],
      } = await db.query("SELECT archived FROM customers WHERE id=$1", [id]);
      assert(current, 404, "Customer not found.");
      if (d.archived !== current.archived) requireAdmin(user);
      const { rows } = await db.query(
        "UPDATE customers SET name=$2, phone=$3, address=$4, notes=$5, archived=$6, updated_at=now() WHERE id=$1 AND ($7 OR archived=$6) RETURNING id, name, phone, address, notes, archived",
        [id, ...Object.values(d), user.role === "admin"],
      );
      assert(rows.length, 404, "Customer not found.");
      return { data: rows[0] };
    }
  }
  if (resource === "inventory") {
    if (!id && method === "GET")
      return {
        data: (
          await db.query(
            "SELECT i.id, i.name, i.unit, i.quantity, i.reorder_level, i.supplier_id, i.updated_at, s.name AS supplier_name FROM inventory i LEFT JOIN suppliers s ON s.id=i.supplier_id ORDER BY i.id",
          )
        ).rows,
      };
    if (id === "adjust" && method === "POST")
      return {
        data: await service.stockOperation(db, v.stockSchema.parse(body), user),
      };
    if (id === "refill" && method === "POST")
      return {
        data: await service.stockOperation(
          db,
          v.refillSchema.parse(body),
          user,
          true,
        ),
      };
    if (id === "history" && method === "GET") {
      const q = v.listSchema.parse(query);
      const {
        rows: [{ total }],
      } = await db.query("SELECT count(*)::int AS total FROM stock_movements");
      const { rows } = await db.query(
        "SELECT m.id::text, m.item_id, i.name AS item_name, m.delta, m.balance, m.reason, m.created_by, m.created_at FROM stock_movements m JOIN inventory i ON i.id=m.item_id ORDER BY m.created_at DESC, m.id DESC LIMIT $1 OFFSET $2",
        [q.limit, (q.page - 1) * q.limit],
      );
      return { data: { items: rows, total, page: q.page, limit: q.limit } };
    }
    if (id && method === "PUT") {
      requireAdmin(user);
      const d = v.inventorySchema.parse(body);
      const { rows } = await db.query(
        "UPDATE inventory SET reorder_level=$2, supplier_id=$3, updated_at=now() WHERE id=$1 RETURNING id, name, quantity, reorder_level, supplier_id",
        [id, d.reorder_level, d.supplier_id],
      );
      assert(rows.length, 404, "Stock item not found.");
      return { data: rows[0] };
    }
  }
  if (resource === "suppliers") {
    if (!id && method === "GET")
      return {
        data: (
          await db.query(
            "SELECT id, name, phone, email, notes FROM suppliers ORDER BY name LIMIT 500",
          )
        ).rows,
      };
    requireAdmin(user);
    if (!id && method === "POST") {
      const d = v.supplierSchema.parse(body);
      return {
        status: 201,
        data: (
          await db.query(
            "INSERT INTO suppliers (id, name, phone, email, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, phone, email, notes",
            [service.newId(), ...Object.values(d)],
          )
        ).rows[0],
      };
    }
    if (id && method === "PUT") {
      v.uuid.parse(id);
      const d = v.supplierSchema.parse(body);
      const { rows } = await db.query(
        "UPDATE suppliers SET name=$2, phone=$3, email=$4, notes=$5 WHERE id=$1 RETURNING id, name, phone, email, notes",
        [id, ...Object.values(d)],
      );
      assert(rows.length, 404, "Supplier not found.");
      return { data: rows[0] };
    }
    if (id && method === "DELETE") {
      v.uuid.parse(id);
      const result = await db.query("DELETE FROM suppliers WHERE id=$1", [id]);
      assert(result.rowCount, 404, "Supplier not found.");
      return { data: { ok: true } };
    }
  }
  if (resource === "maintenance") {
    if (!id && method === "GET") {
      const q = v.listSchema.parse(query);
      const {
        rows: [{ total }],
      } = await db.query("SELECT count(*)::int AS total FROM maintenance");
      const { rows } = await db.query(
        "SELECT id, equipment, description, due_date::text, completed_at, created_by FROM maintenance ORDER BY (completed_at IS NOT NULL), due_date, id LIMIT $1 OFFSET $2",
        [q.limit, (q.page - 1) * q.limit],
      );
      return { data: { items: rows, total, page: q.page, limit: q.limit } };
    }
    if (!id && method === "POST") {
      const d = v.maintenanceSchema.parse(body);
      return {
        status: 201,
        data: (
          await db.query(
            "INSERT INTO maintenance (id, equipment, description, due_date, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id",
            [
              service.newId(),
              d.equipment,
              d.description,
              d.due_date,
              user.email,
            ],
          )
        ).rows[0],
      };
    }
    if (id && method === "PATCH") {
      v.uuid.parse(id);
      const { completed } = z
        .object({ completed: z.boolean() })
        .strict()
        .parse(body);
      const { rows } = await db.query(
        "UPDATE maintenance SET completed_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$1 RETURNING id",
        [id, completed],
      );
      assert(rows.length, 404, "Maintenance task not found.");
      return { data: rows[0] };
    }
  }
  throw new HttpError(404, "Endpoint not found.");
}
