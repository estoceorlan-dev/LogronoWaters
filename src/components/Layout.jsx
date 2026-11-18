import { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
  Home,
  Droplet,
  ListOrdered,
  Users,
  Settings,
  Bell,
  Search,
  Droplets,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useResource } from "../lib/hooks";
import { Loading, ErrorMessage } from "./UI";
import { StationContext } from "../lib/station";

const navItems = [
  { name: "Dashboard", path: "/", icon: Home },
  { name: "Orders", path: "/orders", icon: ListOrdered },
  { name: "Inventory", path: "/inventory", icon: Droplet },
  { name: "Customers", path: "/customers", icon: Users },
  { name: "Settings", path: "/settings", icon: Settings },
];

export default function Layout({ user, onLogout }) {
  const me = useResource("me");
  const settings = useResource("settings", { keepPreviousData: true });
  const dashboard = useResource("dashboard");
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  const navigate = useNavigate();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  if (me.loading || (settings.loading && !settings.data)) return <Loading />;
  if (me.error || settings.error)
    return (
      <div className="max-w-lg mx-auto p-8">
        <ErrorMessage>{me.error || settings.error}</ErrorMessage>
        <div className="flex gap-3">
          <button
            className="btn-secondary"
            onClick={() => {
              me.reload();
              settings.reload();
            }}
          >
            Retry
          </button>
          <button
            className="btn-primary"
            onClick={() => onLogout().catch((err) => setError(err.message))}
          >
            Sign out
          </button>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  const lowStock =
    dashboard.data?.inventory.filter(
      (item) => item.quantity <= item.reorder_level,
    ) || [];
  const due = dashboard.data?.maintenance || [];
  const alerts = lowStock.length + due.length;
  const sidebar = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700 gap-2">
        <Droplets size={30} className="text-blue-600 shrink-0" />
        <span className="font-bold text-xl truncate">{settings.data.name}</span>
        <button
          className="icon-button ml-auto md:hidden"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>
      <nav aria-label="Main navigation" className="flex-1 p-4 space-y-2">
        {navItems.map(({ name, path, icon: Icon }) => (
          <NavLink
            end={path === "/"}
            key={path}
            to={path}
            onClick={() => {
              setMobile(false);
              setNotifications(false);
              dashboard.reload();
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`
            }
          >
            <Icon size={20} />
            {name}
          </NavLink>
        ))}
      </nav>
      <div className="p-5 border-t border-slate-200 dark:border-slate-700">
        <p className="font-medium truncate">{user.name}</p>
        <p className="text-sm text-slate-500 truncate">{user.email}</p>
        <p className="text-sm text-blue-600 capitalize mt-1">{me.data.role}</p>
        <button
          className="flex gap-2 text-sm mt-4 text-slate-500 hover:text-rose-600"
          onClick={() => onLogout().catch((err) => setError(err.message))}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
  return (
    <StationContext.Provider
      value={{
        user: me.data,
        settings: settings.data,
        refreshSettings: settings.reload,
        refreshAlerts: dashboard.reload,
      }}
    >
      <div className="flex h-dvh bg-slate-50 dark:bg-slate-900 overflow-hidden">
        <aside className="hidden md:flex w-64 flex-col shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
          {sidebar}
        </aside>
        {mobile && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              className="absolute inset-0 bg-slate-950/50"
              aria-label="Close navigation"
              onClick={() => setMobile(false)}
            />
            <aside className="relative flex flex-col h-full w-72 max-w-[85vw] bg-white dark:bg-slate-800">
              {sidebar}
            </aside>
          </div>
        )}
        <main className="flex-1 min-w-0 flex flex-col">
          <header className="h-16 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 px-4 md:px-8 relative z-20">
            <button
              className="icon-button md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <form
              className="flex-1 max-w-md relative"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/orders?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={18}
              />
              <input
                aria-label="Search orders"
                className="input pl-10 rounded-full"
                placeholder="Search orders by ID or customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={200}
              />
            </form>
            <div className="flex gap-2 ml-auto">
              <button
                className="icon-button"
                aria-label={
                  dark ? "Switch to light theme" : "Switch to dark theme"
                }
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                className="icon-button relative"
                aria-label={`Notifications, ${alerts} alerts`}
                aria-expanded={notifications}
                onClick={() => {
                  setNotifications(!notifications);
                  dashboard.reload();
                }}
              >
                <Bell size={20} />
                {alerts > 0 && (
                  <span className="absolute -right-1 -top-1 bg-rose-600 text-white text-xs rounded-full min-w-5 px-1">
                    {alerts}
                  </span>
                )}
              </button>
            </div>
            {notifications && (
              <div className="absolute top-16 right-4 panel w-80 max-w-[calc(100vw-2rem)] p-5 shadow-xl">
                <h2 className="font-semibold mb-3">Station alerts</h2>
                {dashboard.loading ? (
                  <p>Checking alerts…</p>
                ) : dashboard.error ? (
                  <ErrorMessage>{dashboard.error}</ErrorMessage>
                ) : (
                  <>
                    {alerts === 0 && (
                      <p className="text-slate-500">
                        No low-stock or overdue maintenance alerts.
                      </p>
                    )}
                    {lowStock.map((item) => (
                      <Link
                        onClick={() => setNotifications(false)}
                        className="block p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                        key={item.id}
                        to="/inventory"
                      >
                        {item.name}: {item.quantity} left
                      </Link>
                    ))}
                    {due.map((item) => (
                      <Link
                        className="block p-2 text-sm"
                        key={item.id}
                        to="/inventory?tab=maintenance"
                      >
                        Maintenance due: {item.equipment}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
              <ErrorMessage>{error}</ErrorMessage>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </StationContext.Provider>
  );
}
