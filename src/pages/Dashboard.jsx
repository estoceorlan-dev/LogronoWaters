import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Droplet, Users, DollarSign, Clock } from 'lucide-react';

const salesData = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 1890 },
  { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 },
];

const inventoryData = [
  { name: 'Week 1', full: 400, empty: 240 },
  { name: 'Week 2', full: 300, empty: 139 },
  { name: 'Week 3', full: 200, empty: 980 },
  { name: 'Week 4', full: 278, empty: 390 },
];

const StatCard = ({ title, value, trend, isPositive, icon: Icon, colorClass }) => (
  <div className="glass-panel p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <span className={`flex items-center font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
        {isPositive ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
        {trend}
      </span>
      <span className="text-slate-400 ml-2">vs last week</span>
    </div>
  </div>
);

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back! Here's what's happening at your station today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value="₱24,500" 
          trend="+12.5%" 
          isPositive={true}
          icon={DollarSign}
          colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
        />
        <StatCard 
          title="Gallons Sold" 
          value="1,240" 
          trend="+8.2%" 
          isPositive={true}
          icon={Droplet}
          colorClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400"
        />
        <StatCard 
          title="Pending Deliveries" 
          value="24" 
          trend="-2.4%" 
          isPositive={false}
          icon={Clock}
          colorClass="bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
        />
        <StatCard 
          title="New Customers" 
          value="18" 
          trend="+4.1%" 
          isPositive={true}
          icon={Users}
          colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Revenue Over Time</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Chart */}
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Inventory Status</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="full" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Full Gallons" />
                <Bar dataKey="empty" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Empty Gallons" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50 cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Droplet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">New Order #409{i}</p>
                  <p className="text-xs text-slate-500">5 Gallons Refill - Delivered to John Doe</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900 dark:text-white">₱150.00</p>
                <p className="text-xs text-slate-400">{i * 10} mins ago</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
