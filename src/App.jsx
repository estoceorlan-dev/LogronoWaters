import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';

// Simple placeholders for pages we haven't built fully yet
const Customers = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Customers Directory</h2>
      <p className="text-slate-500 mt-2">Customer management features coming soon.</p>
    </div>
  </div>
);

const Settings = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Settings & Configuration</h2>
      <p className="text-slate-500 mt-2">System configuration coming soon.</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
