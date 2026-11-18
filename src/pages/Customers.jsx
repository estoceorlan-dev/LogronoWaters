import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { api, params, money } from "../lib/api";
import { useResource, useDebounced } from "../lib/hooks";
import {
  PageHeader,
  ResourceState,
  Empty,
  Pagination,
  Modal,
  SaveForm,
  Field,
} from "../components/UI";
import { useStation } from "../lib/station";

export default function Customers() {
  const [search, setSearch] = useSearchParams();
  const [query, setQuery] = useState(search.get("q") || "");
  const q = useDebounced(query);
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState(null);
  const { user } = useStation();
  const resource = useResource(
    `customers?${params({ q, page, archived: String(archived) })}`,
  );
  return (
    <>
      <PageHeader
        title="Customer directory"
        description="Keep contact details and delivery addresses together."
      >
        <button className="btn-primary" onClick={() => setEditing({})}>
          <Plus size={17} />
          Add customer
        </button>
      </PageHeader>
      <div className="panel overflow-hidden">
        <div className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-52">
            <Field label="Search customers">
              <input
                className="input"
                value={query}
                maxLength={200}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                  setSearch(e.target.value ? { q: e.target.value } : {}, {
                    replace: true,
                  });
                }}
                placeholder="Name, phone, or address"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 py-3 text-sm">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => {
                setArchived(e.target.checked);
                setPage(1);
              }}
            />
            Show archived customers
          </label>
        </div>
        <ResourceState resource={resource}>
          {resource.data && (
            <>
              {resource.data.items.length === 0 ? (
                <Empty>
                  {archived
                    ? "No archived customers."
                    : "No customers found. Add your first customer to start taking orders."}
                </Empty>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Contact</th>
                        <th>Address</th>
                        <th>Orders</th>
                        <th>Total paid</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resource.data.items.map((c) => (
                        <tr key={c.id}>
                          <td className="font-medium">
                            {c.name}
                            {c.archived && (
                              <p className="text-sm text-slate-500">Archived</p>
                            )}
                          </td>
                          <td>{c.phone || "—"}</td>
                          <td className="max-w-64 whitespace-normal">
                            {c.address || "—"}
                          </td>
                          <td>
                            <Link
                              className="text-blue-600"
                              to={`/orders?customer_id=${c.id}`}
                            >
                              {c.order_count} orders
                            </Link>
                          </td>
                          <td>{money(c.spent_cents)}</td>
                          <td>
                            <button
                              className="btn-secondary"
                              onClick={() => setEditing(c)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
      {editing && (
        <Modal
          title={editing.id ? "Edit customer" : "Add customer"}
          onClose={() => setEditing(null)}
        >
          <SaveForm
            label={editing.id ? "Save customer" : "Add customer"}
            onSubmit={async (d) => {
              await api(editing.id ? `customers/${editing.id}` : "customers", {
                method: editing.id ? "PUT" : "POST",
                body: {
                  name: d.name,
                  phone: d.phone,
                  address: d.address,
                  notes: d.notes,
                  archived:
                    user.role === "admin"
                      ? d.archived === "on"
                      : Boolean(editing.archived),
                },
              });
              setEditing(null);
              resource.reload();
            }}
          >
            <Field label="Full name">
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
            <Field label="Delivery address">
              <textarea
                className="input"
                name="address"
                defaultValue={editing.address}
                rows={2}
                maxLength={500}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="input"
                name="notes"
                defaultValue={editing.notes}
                rows={3}
                maxLength={2000}
              />
            </Field>
            {editing.id && user.role === "admin" && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="archived"
                  defaultChecked={editing.archived}
                  className="mt-1"
                />
                <span>
                  Archive this customer. Existing orders remain in your records;
                  new orders require an active customer.
                </span>
              </label>
            )}
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
