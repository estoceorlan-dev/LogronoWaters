import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { authClient } from "./lib/auth";
import { Loading, ErrorMessage } from "./components/UI";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(authClient));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authClient) return;
    let active = true;
    authClient
      .getSession()
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(err.message);
        else if (data?.user?.emailVerified) setUser(data.user);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const logout = async () => {
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message);
    setUser(null);
  };
  if (loading) return <Loading />;
  if (!user || window.location.pathname === "/auth/reset-password")
    return (
      <>
        <ErrorMessage>{error}</ErrorMessage>
        <Auth onAuthenticated={setUser} />
      </>
    );
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={logout} />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="*"
            element={
              <div className="panel p-8">
                <h1 className="text-2xl font-bold">Page not found</h1>
                <Link to="/" className="btn-primary inline-flex mt-4">
                  Return to dashboard
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
