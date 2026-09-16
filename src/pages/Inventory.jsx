import { useState } from 'react';
import { Layout as LayoutIcon, Droplet, Archive, Package, AlertTriangle } from 'lucide-react';

const InventoryCard = ({ title, count, total, type, icon: Icon, colorClass, borderClass }) => {
  const percentage = (count / total) * 100;
  
  return (
    <div className={`glass-panel p-6 rounded-2xl border-l-4 ${borderClass} relative overflow-hidden group`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {count} <span className="text-lg text-slate-400 font-normal">/ {total}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
        <div 
          className={`h-2 rounded-full transition-all duration-1000 ease-out ${
            percentage > 80 ? 'bg-emerald-500' : percentage > 30 ? 'bg-blue-500' : 'bg-rose-500'
          }`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      
      {percentage <= 30 && (
        <div className="mt-3 flex items-center text-rose-500 text-xs font-medium bg-rose-50 dark:bg-rose-500/10 p-2 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
          Low stock alert
        </div>
      )}
    </div>
  );
};

export default function Inventory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory Monitor</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time status of water supply and containers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InventoryCard 
          title="Filled Gallons Ready" 
          count={124} 
          total={500} 
          type="warning"
          icon={Droplet}
          colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
          borderClass="border-blue-500"
        />
        <InventoryCard 
          title="Empty Gallons" 
          count={342} 
          total={500} 
          type="good"
          icon={Archive}
          colorClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          borderClass="border-slate-500"
        />
        <InventoryCard 
          title="Seals & Caps" 
          count={2500} 
          total={3000} 
          type="good"
          icon={Package}
          colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"
          borderClass="border-purple-500"
        />
      </div>

      <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center mt-8 min-h-[300px] border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
        <LayoutIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">More Inventory Features Coming Soon</h3>
        <p className="text-slate-500 max-w-md mx-auto">Supplier tracking, automated reordering, and maintenance logs are scheduled for the next release phase.</p>
      </div>
    </div>
  );
}
