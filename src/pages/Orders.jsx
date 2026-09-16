import { Search, Filter, MoreVertical, CheckCircle2, Clock, XCircle } from 'lucide-react';

const orders = [
  { id: 'ORD-4091', customer: 'John Doe', address: '123 Main St, Brgy 1', gallons: 5, total: 150, status: 'Completed', date: 'Today, 09:41 AM' },
  { id: 'ORD-4092', customer: 'Jane Smith', address: '456 Elm St, Brgy 2', gallons: 2, total: 60, status: 'Pending', date: 'Today, 10:15 AM' },
  { id: 'ORD-4093', customer: 'Bob Johnson', address: '789 Oak St, Brgy 3', gallons: 10, total: 300, status: 'In Progress', date: 'Today, 11:30 AM' },
  { id: 'ORD-4094', customer: 'Alice Brown', address: '321 Pine St, Brgy 1', gallons: 3, total: 90, status: 'Cancelled', date: 'Yesterday, 02:20 PM' },
  { id: 'ORD-4095', customer: 'Charlie Davis', address: '654 Maple St, Brgy 4', gallons: 1, total: 30, status: 'Completed', date: 'Yesterday, 04:10 PM' },
];

const StatusBadge = ({ status }) => {
  const styles = {
    'Completed': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    'Pending': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    'Cancelled': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  };

  const icons = {
    'Completed': <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />,
    'Pending': <Clock className="w-3.5 h-3.5 mr-1.5" />,
    'In Progress': <div className="w-1.5 h-1.5 mr-2 rounded-full bg-blue-500 animate-pulse" />,
    'Cancelled': <XCircle className="w-3.5 h-3.5 mr-1.5" />,
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
};

export default function Orders() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Orders Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track and manage all water refilling and delivery orders.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/30">
          + New Order
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by ID or customer name..." 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
            />
          </div>
          <button className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gallons</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Total</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">{order.id}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{order.customer}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{order.address}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 font-medium">
                    {order.gallons} x 5Gal
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{order.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white text-right">₱{order.total.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-sm text-slate-500">Showing 1 to 5 of 24 entries</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-md text-slate-400 bg-white dark:bg-slate-800 disabled:opacity-50" disabled>Prev</button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md">1</button>
            <button className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">2</button>
            <button className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
