import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Download, Printer } from "lucide-react";
import { api, params, money, date, exportFile } from "../lib/api";
import { useResource, useDebounced } from "../lib/hooks";
import {
  PageHeader,
  ResourceState,
  ErrorMessage,
  Empty,
  Pagination,
  Modal,
  SaveForm,
  Field,
  StatusBadge,
} from "../components/UI";
import { useStation } from "../lib/station";

export default function Orders() {
  const [search, setSearch] = useSearchParams();
  const [creating, setCreating] = useState(search.get("new") === "1");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const { settings, refreshAlerts } = useStation();
  const page = Math.max(1, Number(search.get("page")) || 1);
  const query = params({
    q: search.get("q") || "",
    customer_id: search.get("customer_id") || undefined,
    status: search.get("status") || "",
    from: search.get("from") || "",
    to: search.get("to") || "",
    page,
  });
  const resource = useResource(`orders?${query}`);
  const closeNewOrder = () => {
    setCreating(false);
    if (search.has("new")) {
      const next = new URLSearchParams(search);
      next.delete("new");
      setSearch(next, { replace: true });
    }
  };
  const filter = (name, value) => {
    const next = new URLSearchParams(search);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    setSearch(next, { replace: true });
  };
  const changed = () => {
    closeNewOrder();
    setSelected(null);
    resource.reload();
    refreshAlerts();
  };
  return (
    <>
      <PageHeader
        title="Orders management"
        description="Record refills and deliveries, manage fulfillment, and collect payments."
      >
        <button
          className="btn-secondary"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setError("");
            try {
              exportFile(
                await api(`orders/export?${query}`, { download: true }),
                "aquaflow-orders.csv",
              );
            } catch (err) {
              setError(err.message);
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download size={17} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={17} />
          New order
        </button>
      </PageHeader>
      <ErrorMessage>{error}</ErrorMessage>
      {Array.from(search.keys()).some((key) => key !== "new") && (
        <div className="flex gap-3 items-center mb-4 text-sm">
          <span className="text-slate-500">
            {search.has("customer_id")
              ? "Showing orders for the selected customer."
              : "Order filters are active."}
          </span>
          <button className="text-blue-600" onClick={() => setSearch({})}>
            Clear filters
          </button>
        </div>
      )}
      <div className="panel overflow-hidden">
        <div className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 border-b border-slate-200 dark:border-slate-700">
          <Field label="Search orders">
            <input
              className="input"
              value={search.get("q") || ""}
              maxLength={200}
              onChange={(e) => filter("q", e.target.value)}
              placeholder="Order ID, customer, address"
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={search.get("status") || ""}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="From date">
            <input
              type="date"
              className="input"
              value={search.get("from") || ""}
              onChange={(e) => filter("from", e.target.value)}
            />
          </Field>
          <Field label="Through date">
            <input
              type="date"
              className="input"
              value={search.get("to") || ""}
              onChange={(e) => filter("to", e.target.value)}
            />
          </Field>
        </div>
        <ResourceState resource={resource}>
          {resource.data && (
            <>
              {resource.data.items.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Containers</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Total</th>
                        <th>Created</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resource.data.items.map((o) => (
                        <tr key={o.id}>
                          <td className="font-medium text-blue-600">
                            ORD-{o.id}
                          </td>
                          <td>
                            <p className="font-medium">{o.customer_name}</p>
                            <p className="text-sm text-slate-500 max-w-52 truncate">
                              {o.fulfillment === "delivery"
                                ? o.address
                                : "Station pickup"}
                            </p>
                          </td>
                          <td>{o.quantity} × 5 gal</td>
                          <td>
                            <StatusBadge status={o.status} />
                          </td>
                          <td>{o.paid ? "Paid" : "Unpaid"}</td>
                          <td className="font-semibold">
                            {money(o.total_cents)}
                          </td>
                          <td>{date(o.created_at, settings.timezone)}</td>
                          <td>
                            <button
                              className="btn-secondary"
                              onClick={() => setSelected(o)}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No orders match these filters.</Empty>
              )}
              <Pagination
                total={resource.data.total}
                page={page}
                onChange={(p) => {
                  const next = new URLSearchParams(search);
                  next.set("page", p);
                  setSearch(next);
                }}
              />
            </>
          )}
        </ResourceState>
      </div>
      {creating && (
        <Modal title="New order" onClose={closeNewOrder}>
          <NewOrder onSaved={changed} />
        </Modal>
      )}
      {selected && (
        <Modal
          title={`Order ORD-${selected.id}`}
          onClose={() => setSelected(null)}
        >
          <OrderDetails order={selected} onSaved={changed} />
        </Modal>
      )}
    </>
  );
}

function NewOrder({ onSaved }) {
  const { settings } = useStation();
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const customers = useResource(`customers?${params({ q, limit: 100 })}`);
  const [customer, setCustomer] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState("pickup");
  const [requestId] = useState(() => crypto.randomUUID());
  const total =
    quantity * settings.price_cents +
    (fulfillment === "delivery" ? settings.delivery_fee_cents : 0);
  return (
    <SaveForm
      label="Create order and reserve stock"
      onSubmit={async (d) => {
        await api("orders", {
          method: "POST",
          body: {
            request_id: requestId,
            customer_id: d.customer_id,
            quantity: Number(d.quantity),
            fulfillment: d.fulfillment,
            paid: d.paid === "on",
            notes: d.notes,
          },
        });
        onSaved();
      }}
    >
      <Field label="Find customer">
        <input
          className="input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCustomer("");
          }}
          maxLength={200}
          placeholder="Search name, phone, or address"
        />
      </Field>
      <ResourceState resource={customers}>
        <Field label="Customer" hint="Search to find additional customers.">
          <select
            className="input"
            name="customer_id"
            required
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          >
            <option value="">Choose a customer</option>
            {customers.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </Field>
        {customers.data?.items.length === 0 && (
          <p className="text-sm text-slate-500">
            No active customers found.{" "}
            <Link className="text-blue-600" to="/customers">
              Add a customer first.
            </Link>
          </p>
        )}
      </ResourceState>
      <div className="grid grid-cols-2 gap-4">
        <Field label="5-gallon containers">
          <input
            className="input"
            type="number"
            name="quantity"
            min={1}
            max={10000}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </Field>
        <Field label="Fulfillment">
          <select
            className="input"
            name="fulfillment"
            value={fulfillment}
            onChange={(e) => setFulfillment(e.target.value)}
          >
            <option value="pickup">Station pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </Field>
      </div>
      <p className="text-sm text-slate-500">
        {money(settings.price_cents)} per container
        {fulfillment === "delivery" &&
          ` + ${money(settings.delivery_fee_cents)} delivery fee`}
        . Delivery uses the customer's saved address.
      </p>
      <Field label="Order notes">
        <textarea className="input" name="notes" rows={2} maxLength={2000} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="paid" />
        Payment collected
      </label>
      <div className="rounded-xl bg-blue-50 dark:bg-blue-950 p-4 flex justify-between">
        <span>Order total</span>
        <strong>{money(total)}</strong>
      </div>
      <p className="text-sm text-slate-500">
        Filled containers are reserved immediately. Cancelling an unpaid order
        restores its stock.
      </p>
    </SaveForm>
  );
}

function OrderDetails({ order, onSaved }) {
  const { user, settings } = useStation();
  return (
    <div className="space-y-5">
      <div className="receipt">
        <h3 className="font-bold text-lg">{settings.name}</h3>
        <p className="text-sm text-slate-500">
          {settings.address} {settings.phone}
        </p>
        <p className="font-semibold mt-3">
          ORD-{order.id} · {order.customer_name}
        </p>
        <p className="text-sm text-slate-500">
          {date(order.created_at, settings.timezone)}
        </p>
        <p className="mt-2">
          {order.fulfillment === "delivery"
            ? `Delivery: ${order.address}`
            : "Station pickup"}
        </p>
        <div className="my-4 space-y-2 border-y border-slate-200 dark:border-slate-700 py-4">
          <p className="flex justify-between">
            <span>
              {order.quantity} × 5 gal @ {money(order.unit_price_cents)}
            </span>
            <span>{money(order.quantity * order.unit_price_cents)}</span>
          </p>
          <p className="flex justify-between">
            <span>Delivery fee</span>
            <span>{money(order.delivery_fee_cents)}</span>
          </p>
          <p className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{money(order.total_cents)}</span>
          </p>
        </div>
        <p>
          {order.paid ? "Paid" : "Unpaid"} ·{" "}
          <StatusBadge status={order.status} />
        </p>
        {order.notes && (
          <p className="mt-3 text-sm whitespace-pre-wrap">{order.notes}</p>
        )}
        <p className="print-only mt-5 text-sm">
          Order summary · Not a tax invoice
        </p>
      </div>
      <button className="btn-secondary no-print" onClick={() => window.print()}>
        <Printer size={17} />
        Print order summary
      </button>
      <div className="no-print">
        <SaveForm
          label="Update order"
          onSubmit={async (d) => {
            await api(`orders/${order.id}`, {
              method: "PATCH",
              body: {
                status: d.status || order.status,
                ...(order.status !== "cancelled"
                  ? {
                      paid:
                        user.role === "staff" && order.paid
                          ? true
                          : d.paid === "on",
                    }
                  : {}),
              },
            });
            onSaved();
          }}
        >
          <Field label="Order status">
            <select
              className="input"
              name="status"
              defaultValue={order.status}
              disabled={["completed", "cancelled"].includes(order.status)}
            >
              <option value={order.status}>
                {
                  {
                    pending: "Pending",
                    in_progress: "In progress",
                    completed: "Completed",
                    cancelled: "Cancelled",
                  }[order.status]
                }
              </option>
              {order.status === "pending" && (
                <option value="in_progress">In progress</option>
              )}
              {["pending", "in_progress"].includes(order.status) && (
                <>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled — restore stock</option>
                </>
              )}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="paid"
              defaultChecked={order.paid}
              disabled={
                order.status === "cancelled" ||
                (user.role === "staff" && order.paid)
              }
            />
            Payment collected
          </label>
          {order.paid && ["pending", "in_progress"].includes(order.status) && (
            <p className="text-sm text-slate-500">
              To cancel a paid order, an administrator must first refund the
              customer and save it as unpaid.
            </p>
          )}
        </SaveForm>
      </div>
    </div>
  );
}
