import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useResource } from "../lib/hooks";
import { money, date } from "../lib/api";
import {
  PageHeader,
  ResourceState,
  Empty,
  StatusBadge,
} from "../components/UI";
import { useStation } from "../lib/station";

export default function Dashboard() {
  const resource = useResource("dashboard");
  const { settings } = useStation();
  const d = resource.data;
  return (
    <>
      <PageHeader
        title="Dashboard overview"
        description="Today's station operations, based on your saved records."
      >
        <button className="btn-secondary" onClick={resource.reload}>
          Refresh
        </button>
        <Link to="/orders?new=1" className="btn-primary">
          New order
        </Link>
      </PageHeader>
      <ResourceState resource={resource}>
        {d && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                [
                  "Collected revenue today",
                  money(d.stats.revenue),
                  "Completed and paid orders",
                ],
                [
                  "Containers sold today",
                  d.stats.gallons,
                  "5-gallon containers completed",
                ],
                ["Open orders", d.stats.pending, "Pending or in progress"],
                [
                  "Outstanding balance",
                  money(d.stats.outstanding),
                  "Completed orders awaiting payment",
                ],
              ].map(([label, value, hint]) => (
                <div className="panel p-6" key={label}>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="text-3xl font-bold mt-2">{value}</p>
                  <p className="text-sm text-slate-500 mt-3">{hint}</p>
                </div>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="panel p-6 min-w-0">
                <h2 className="text-lg font-semibold mb-5">
                  Revenue over the last 7 days
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={d.sales.map((s) => ({
                        day: s.day.slice(5),
                        sales: s.sales / 100,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis width={65} />
                      <Tooltip formatter={(v) => money(v * 100)} />
                      <Line
                        dataKey="sales"
                        name="Revenue"
                        stroke="#2563eb"
                        strokeWidth={3}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="panel p-6 min-w-0">
                <h2 className="text-lg font-semibold mb-5">Available stock</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={d.inventory.map((i) => ({
                        name: {
                          caps: "Caps",
                          empty: "Empty",
                          filled: "Filled",
                        }[i.id],
                        quantity: i.quantity,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="quantity"
                        name="Units available"
                        fill="#0ea5e9"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Filled stock excludes containers reserved for open orders.
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {d.inventory
                .filter((i) => i.quantity <= i.reorder_level)
                .map((i) => (
                  <Link
                    className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
                    to="/inventory"
                    key={i.id}
                  >
                    {i.name} is low: {i.quantity} remaining. Record a delivery
                    or production refill.
                  </Link>
                ))}
              {d.maintenance.map((m) => (
                <Link
                  className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
                  to="/inventory?tab=maintenance"
                  key={m.id}
                >
                  Maintenance due: {m.equipment}
                </Link>
              ))}
            </div>
            <div className="panel overflow-hidden">
              <div className="p-5 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Recent orders</h2>
                <Link to="/orders" className="text-blue-600 text-sm">
                  View all orders
                </Link>
              </div>
              {d.recent.length === 0 ? (
                <Empty>
                  Create your first customer, add stock, then record an order.
                </Empty>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recent.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <Link
                              className="text-blue-600 font-medium"
                              to={`/orders?q=ORD-${o.id}`}
                            >
                              ORD-{o.id}
                            </Link>
                          </td>
                          <td>{o.customer_name}</td>
                          <td>
                            <StatusBadge status={o.status} />
                          </td>
                          <td>{money(o.total_cents)}</td>
                          <td>{date(o.created_at, settings.timezone)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {d.stats.customers} active customers · Reporting timezone:{" "}
              {settings.timezone}
            </p>
          </div>
        )}
      </ResourceState>
    </>
  );
}
