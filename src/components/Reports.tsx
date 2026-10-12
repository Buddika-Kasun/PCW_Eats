/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Filter, Download, Calendar, Building2, Utensils, Coffee, Package, AlertTriangle, Radio } from 'lucide-react';
import { DEPARTMENTS, MOCK_CANTEENS, MOCK_INVENTORY } from '../constants';
import { cn } from '../lib/utils';
import { canteenStore, LiveTransaction } from '../services/canteenStore';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'snacks' | 'meals' | 'inventory'>('snacks');
  const [selectedDept, setSelectedDept] = useState('');
  const [dateRange, setDateRange] = useState('Current Month');
  const [transactions, setTransactions] = useState<LiveTransaction[]>(() => canteenStore.getTransactions());

  useEffect(() => {
    return canteenStore.subscribe(() => {
      setTransactions(canteenStore.getTransactions());
    });
  }, []);

  const filteredData = useMemo(() => {
    if (activeTab === 'inventory') {
      return MOCK_INVENTORY;
    }

    return transactions.filter(t => {
      const matchesDept = selectedDept === '' || t.dept === selectedDept;
      const matchesType = activeTab === 'snacks' ? t.type === 'snack' : t.type === 'meal';
      
      let matchesDate = true;
      if (dateRange === 'Current Month') {
        matchesDate = t.date.startsWith('2024-04') || Boolean(t.isLive);
      } else if (dateRange === 'Last Month') {
        matchesDate = t.date.startsWith('2024-03');
      } else if (dateRange === 'Last 3 Months') {
        matchesDate = t.date.startsWith('2024-04') || t.date.startsWith('2024-03') || t.date.startsWith('2024-02') || Boolean(t.isLive);
      }

      return matchesDept && matchesType && matchesDate;
    });
  }, [activeTab, selectedDept, dateRange, transactions]);


  const totalCost = useMemo(() => {
    if (activeTab === 'inventory') return 0;
    return filteredData.reduce((sum, t) => sum + (t as any).cost, 0);
  }, [filteredData, activeTab]);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Filters Panel */}
      <div className="w-full lg:w-72 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <Filter size={18} className="text-amber-500" />
            <span>Report Filters</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Range</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select 
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                >
                  <option>Current Month</option>
                  <option>Last Month</option>
                  <option>Last 3 Months</option>
                  <option>Custom Range</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select 
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                >
                  <option value="">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Canteen</label>
              <div className="relative">
                <Utensils className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400 transition-all">
                  <option value="">All Canteens</option>
                  {MOCK_CANTEENS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10">
            Apply Filters
          </button>
        </div>

        {activeTab !== 'inventory' && (
          <div className="bg-slate-900 p-6 rounded-3xl text-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Period Cost</p>
            <p className="text-2xl font-black text-amber-400">LKR {totalCost.toLocaleString()}</p>
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Transactions</span>
              <span>{filteredData.length}</span>
            </div>
          </div>
        )}

        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
          <p className="text-xs font-bold text-amber-900 mb-2">Pro Tip</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            You can schedule these reports to be sent to department heads automatically every Monday.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto max-w-full">
            {[
              { id: 'snacks', label: 'Snack Cost', icon: Coffee },
              { id: 'meals', label: 'Meal Cost', icon: Utensils },
              { id: 'inventory', label: 'Inventory', icon: Package },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  activeTab === tab.id 
                    ? "bg-amber-400 text-slate-900 shadow-md" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  {activeTab === 'inventory' ? (
                    <>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">UOM</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Current Stock</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Min Level</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Item/Meal</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Cost</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.map((row: any, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    {activeTab === 'inventory' ? (
                      <>
                        <td className="px-6 py-4 font-semibold text-slate-700">{row.item}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{row.uom}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">{row.stock}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{row.minLevel}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                            row.status === 'Low' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {row.status}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm text-slate-500">{row.date}</td>
                        <td className="px-6 py-4 font-semibold text-slate-700">{row.dept}</td>
                        <td className="px-6 py-4 text-slate-600">{row.item}</td>
                        <td className="px-6 py-4 text-slate-600">{row.qty}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-900 text-right">LKR {row.cost.toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle size={24} className="text-slate-200" />
                        <span>No data found for the selected filters.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
