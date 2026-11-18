import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Droplet, Archive, Package, AlertTriangle, Plus } from "lucide-react";
import { api, date } from "../lib/api";
import { useResource } from "../lib/hooks";
import {
  PageHeader,
  ResourceState,
  ErrorMessage,
  Empty,
  Pagination,
  Modal,
  SaveForm,
  Field,
} from "../components/UI";
import { useStation } from "../lib/station";

const icons = { filled: Droplet, empty: Archive, caps: Package };
export default function Inventory() {
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") || "stock";
  const [modal, setModal] = useState(null);
  const [requestId, setRequestId] = useState("");
  const resource = useResource("inventory");
  const suppliers = useResource("suppliers");
  const { user, refreshAlerts } = useStation();
  const open = (type, item = null) => {
    setRequestId(crypto.randomUUID());
    setModal({ type, item });
  };
  const changed = () => {
    setModal(null);
    resource.reload();
    refreshAlerts();
  };
  return (
    <>
      <PageHeader
        title="Inventory monitor"
        description="Track water containers, production, supplies, and equipment maintenance."
      >
        <button className="btn-secondary" onClick={() => open("adjust")}>
          Adjust stock
        </button>
        <button className="btn-primary" onClick={() => open("refill")}>
          <Plus size={17} />
          Record refill production
        </button>
      </PageHeader>
      <ResourceState resource={resource}>
        {resource.data && (
          <div className="grid sm:grid-cols-3 gap-5 mb-6">
            {resource.data.map((item) => {
              const Icon = icons[item.id];
              const low = item.quantity <= item.reorder_level;
              return (
                <div
                  className="panel p-6 border-t-4 border-t-blue-500"
                  key={item.id}
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-medium text-slate-500">{item.name}</p>
                    <Icon size={24} className="text-blue-500 shrink-0" />
                  </div>
                  <p className="text-4xl font-bold mt-4">
                    {item.quantity.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {item.unit} available
                  </p>
                  {low && (
                    <p className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 p-2 mt-3 rounded-lg flex items-center gap-2 text-sm">
                      <AlertTriangle size={16} />
                      Low stock · Reorder at {item.reorder_level}
                    </p>
                  )}
                  <p className="text-sm text-slate-500 mt-4">
                    Supplier: {item.supplier_name || "Unassigned"}
                  </p>
                  {user.role === "admin" && (
                    <button
                      className="text-sm text-blue-600 mt-3"
                      onClick={() => open("configure", item)}
                    >
                      Configure stock alert & supplier
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ResourceState>
      <div
        className="flex gap-2 flex-wrap mb-5"
        aria-label="Inventory sections"
      >
        {[
          ["stock", "Stock history"],
          ["suppliers", "Suppliers"],
          ["maintenance", "Maintenance"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "btn-primary" : "btn-secondary"}
            aria-pressed={tab === key}
            onClick={() => setSearch({ tab: key })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "stock" && (
        <StockHistory key={resource.data?.map((i) => i.updated_at).join(",")} />
      )}
      {tab === "suppliers" && (
        <Suppliers
          onChanged={() => {
            resource.reload();
            suppliers.reload();
          }}
        />
      )}
      {tab === "maintenance" && <Maintenance onChanged={refreshAlerts} />}
      {modal && (
        <Modal
          title={
            {
              adjust: "Adjust stock",
              refill: "Record refill production",
              configure: "Stock alert and supplier",
            }[modal.type]
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "adjust" && (
            <SaveForm
              label="Record stock adjustment"
              onSubmit={async (d) => {
                await api("inventory/adjust", {
                  method: "POST",
                  body: {
                    request_id: requestId,
                    item_id: d.item_id,
                    delta: Number(d.delta),
                    reason: d.reason,
                  },
                });
                changed();
              }}
            >
              <Field label="Stock item">
                <select name="item_id" className="input">
                  <option value="filled">Filled 5-gallon containers</option>
                  <option value="empty">Empty 5-gallon containers</option>
                  <option value="caps">Seals & caps</option>
                </select>
              </Field>
              <Field
                label="Quantity change"
                hint="Use a positive number for deliveries or container returns, and a negative number for losses or corrections."
              >
                <input
                  type="number"
                  className="input"
                  name="delta"
                  min={-1000000}
                  max={1000000}
                  step={1}
                  required
                />
              </Field>
              <Field label="Reason">
                <textarea
                  className="input"
                  name="reason"
                  required
                  maxLength={500}
                  placeholder="Supplier delivery, empty container return, damaged stock…"
                />
              </Field>
              <p className="text-sm text-slate-500">
                Every change is saved in stock history with your account.
              </p>
            </SaveForm>
          )}
          {modal.type === "refill" && (
            <SaveForm
              label="Record production"
              onSubmit={async (d) => {
                await api("inventory/refill", {
                  method: "POST",
                  body: { request_id: requestId, quantity: Number(d.quantity) },
                });
                changed();
              }}
            >
              <Field label="Number of 5-gallon containers filled">
                <input
                  type="number"
                  className="input"
                  name="quantity"
                  min={1}
                  max={10000}
                  step={1}
                  required
                />
              </Field>
              <p className="text-sm text-slate-500">
                Each refill consumes one empty container and one seal/cap, and
                adds one filled container. Record supplier deliveries and
                returned containers before production.
              </p>
            </SaveForm>
          )}
          {modal.type === "configure" && (
            <SaveForm
              onSubmit={async (d) => {
                await api(`inventory/${modal.item.id}`, {
                  method: "PUT",
                  body: {
                    reorder_level: Number(d.reorder_level),
                    supplier_id: d.supplier_id || null,
                  },
                });
                changed();
              }}
            >
              <Field label="Low-stock threshold">
                <input
                  type="number"
                  name="reorder_level"
                  className="input"
                  min={0}
                  max={100000000}
                  step={1}
                  defaultValue={modal.item.reorder_level}
                  required
                />
              </Field>
              <ResourceState resource={suppliers}>
                <Field label="Preferred supplier">
                  <select
                    name="supplier_id"
                    className="input"
                    defaultValue={modal.item.supplier_id || ""}
                  >
                    <option value="">Unassigned</option>
                    {suppliers.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </ResourceState>
              <p className="text-sm text-slate-500">
                Low-stock alerts appear on the dashboard and in notifications.
              </p>
            </SaveForm>
          )}
        </Modal>
      )}
    </>
  );
}

function StockHistory() {
  const [page, setPage] = useState(1);
  const resource = useResource(`inventory/history?page=${page}`);
  const { settings } = useStation();
  return (
    <div className="panel overflow-hidden">
      <h2 className="p-5 text-lg font-semibold">Stock movement history</h2>
      <ResourceState resource={resource}>
        {resource.data && (
          <>
            {resource.data.items.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Change</th>
                      <th>Balance</th>
                      <th>Reason</th>
                      <th>Recorded by</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.items.map((m) => (
                      <tr key={m.id}>
                        <td>{m.item_name}</td>
                        <td
                          className={
                            m.delta > 0
                              ? "text-emerald-600 font-semibold"
                              : "text-rose-600 font-semibold"
                          }
                        >
                          {m.delta > 0 ? "+" : ""}
                          {m.delta}
                        </td>
                        <td>{m.balance}</td>
                        <td className="whitespace-normal min-w-48">
                          {m.reason}
                        </td>
                        <td>{m.created_by}</td>
                        <td>{date(m.created_at, settings.timezone)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>
                No stock movements yet. Record your opening stock to get
                started.
              </Empty>
            )}
            <Pagination
              total={resource.data.total}
              page={page}
              onChange={setPage}
            />
          </>
        )}
      </ResourceState>
    </div>
  );
}

function Suppliers({ onChanged }) {
  const resource = useResource("suppliers");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { user } = useStation();
  const changed = () => {
    setEditing(null);
    setRemoving(null);
    resource.reload();
    onChanged();
  };
  return (
    <div className="panel overflow-hidden">
      <div className="p-5 flex justify-between">
        <h2 className="text-lg font-semibold">Supplier directory</h2>
        {user.role === "admin" && (
          <button className="btn-primary" onClick={() => setEditing({})}>
            Add supplier
          </button>
        )}
      </div>
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Notes</th>
                  {user.role === "admin" && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {resource.data.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.email || "—"}</td>
                    <td className="max-w-64 whitespace-normal">
                      {s.notes || "—"}
                    </td>
                    {user.role === "admin" && (
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-secondary"
                            onClick={() => setEditing(s)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-rose-600"
                            onClick={() => setRemoving(s)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No suppliers yet. Add your suppliers and assign them to inventory
            items.
          </Empty>
        )}
      </ResourceState>
      {editing && (
        <Modal
          title={editing.id ? "Edit supplier" : "Add supplier"}
          onClose={() => setEditing(null)}
        >
          <SaveForm
            onSubmit={async (d) => {
              await api(editing.id ? `suppliers/${editing.id}` : "suppliers", {
                method: editing.id ? "PUT" : "POST",
                body: d,
              });
              changed();
            }}
          >
            <Field label="Supplier name">
              <input
                className="input"
                name="name"
                defaultValue={editing.name}
                maxLength={200}
                required
              />
            </Field>
            <Field label="Phone">
              <input
                className="input"
                name="phone"
                type="tel"
                defaultValue={editing.phone}
                maxLength={40}
              />
            </Field>
            <Field label="Email">
              <input
                className="input"
                name="email"
                type="email"
                defaultValue={editing.email}
                maxLength={254}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="input"
                name="notes"
                defaultValue={editing.notes}
                maxLength={2000}
              />
            </Field>
          </SaveForm>
        </Modal>
      )}
      {removing && (
        <Modal title="Remove supplier" onClose={() => setRemoving(null)}>
          <SaveForm
            label="Remove supplier"
            onSubmit={async () => {
              await api(`suppliers/${removing.id}`, { method: "DELETE" });
              changed();
            }}
          >
            <p>
              Remove {removing.name} from your directory? Stock items assigned
              to this supplier will become unassigned.
            </p>
          </SaveForm>
        </Modal>
      )}
    </div>
  );
}

function Maintenance({ onChanged }) {
  const [page, setPage] = useState(1);
  const resource = useResource(`maintenance?page=${page}`);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const { settings } = useStation();
  return (
    <div className="panel overflow-hidden">
      <div className="p-5 flex justify-between">
        <h2 className="text-lg font-semibold">Equipment maintenance</h2>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          Schedule maintenance
        </button>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <ResourceState resource={resource}>
        {resource.data && (
          <>
            {resource.data.items.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Task</th>
                      <th>Due date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.items.map((m) => (
                      <tr key={m.id}>
                        <td className="font-medium">{m.equipment}</td>
                        <td className="whitespace-normal min-w-48">
                          {m.description}
                        </td>
                        <td>{m.due_date}</td>
                        <td>
                          {m.completed_at
                            ? `Completed ${date(m.completed_at, settings.timezone)}`
                            : "Scheduled"}
                        </td>
                        <td>
                          <button
                            className="btn-secondary"
                            disabled={busy !== null}
                            onClick={async () => {
                              setBusy(m.id);
                              setError("");
                              try {
                                await api(`maintenance/${m.id}`, {
                                  method: "PATCH",
                                  body: { completed: !m.completed_at },
                                });
                                resource.reload();
                                onChanged();
                              } catch (err) {
                                setError(err.message);
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            {busy === m.id
                              ? "Saving…"
                              : m.completed_at
                                ? "Reopen"
                                : "Mark complete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>
                No maintenance tasks. Schedule filter replacements and equipment
                servicing here.
              </Empty>
            )}
            <Pagination
              total={resource.data.total}
              page={page}
              onChange={setPage}
            />
          </>
        )}
      </ResourceState>
      {creating && (
        <Modal title="Schedule maintenance" onClose={() => setCreating(false)}>
          <SaveForm
            label="Schedule maintenance"
            onSubmit={async (d) => {
              await api("maintenance", { method: "POST", body: d });
              setCreating(false);
              resource.reload();
              onChanged();
            }}
          >
            <Field label="Equipment">
              <input
                className="input"
                name="equipment"
                maxLength={200}
                required
                placeholder="RO membrane, UV sterilizer…"
              />
            </Field>
            <Field label="Task">
              <textarea
                className="input"
                name="description"
                maxLength={2000}
                required
              />
            </Field>
            <Field label="Due date">
              <input className="input" name="due_date" type="date" required />
            </Field>
          </SaveForm>
        </Modal>
      )}
    </div>
  );
}
