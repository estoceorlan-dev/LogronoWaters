import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max);
const required = (max = 200) => text(max).min(1);
const int = (min, max) => z.number().int().min(min).max(max);
export const uuid = z.string().uuid();
export const customerSchema = z
  .object({
    name: required(),
    phone: text(40).default(""),
    address: text(500).default(""),
    notes: text(2000).default(""),
    archived: z.boolean().default(false),
  })
  .strict();
export const orderSchema = z
  .object({
    request_id: uuid,
    customer_id: uuid,
    quantity: int(1, 10000),
    fulfillment: z.enum(["pickup", "delivery"]),
    paid: z.boolean().default(false),
    notes: text(2000).default(""),
  })
  .strict();
export const orderUpdateSchema = z
  .object({
    status: z
      .enum(["pending", "in_progress", "completed", "cancelled"])
      .optional(),
    paid: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "No changes supplied");
export const stockSchema = z
  .object({
    request_id: uuid,
    item_id: z.enum(["filled", "empty", "caps"]),
    delta: int(-1000000, 1000000).refine((v) => v !== 0),
    reason: required(500),
  })
  .strict();
export const refillSchema = z
  .object({ request_id: uuid, quantity: int(1, 10000) })
  .strict();
export const inventorySchema = z
  .object({ reorder_level: int(0, 100000000), supplier_id: uuid.nullable() })
  .strict();
export const supplierSchema = z
  .object({
    name: required(),
    phone: text(40).default(""),
    email: z.union([z.string().email().max(254), z.literal("")]).default(""),
    notes: text(2000).default(""),
  })
  .strict();
export const maintenanceSchema = z
  .object({
    equipment: required(),
    description: required(2000),
    due_date: z.iso.date(),
  })
  .strict();
export const settingsSchema = z
  .object({
    name: required(100),
    address: text(500),
    phone: text(40),
    price_cents: int(1, 10000000),
    delivery_fee_cents: int(0, 10000000),
    timezone: z.enum(["Asia/Manila", "UTC"]),
  })
  .strict();
export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: text(200).default(""),
    status: z
      .enum(["", "pending", "in_progress", "completed", "cancelled"])
      .default(""),
    archived: z.enum(["true", "false"]).default("false"),
    customer_id: uuid.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Start date must precede end date",
  );
