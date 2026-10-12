/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  UtensilsCrossed, 
  BarChart3, 
  Download, 
  CheckCircle2, 
  Zap, 
  Activity, 
  Radio, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { canteenStore, LiveTransaction } from '../services/canteenStore';

interface MonthDashboardData {
  monthKey: string;
  monthLabel: string;
  totalCost: number;
  prevCost: number;
  costChange: string;
  costTrend: 'up' | 'down';
  totalMeals: number;
  mealChange: string;
  activeEmployees: number;
  deptData: Array<{ name: string; cost: number }>;
  topDepartments: Array<{
    name: string;
    employees: number;
    meals: number;
    cost: string;
    status: 'High' | 'Normal' | 'Low';
  }>;
}

const MONTHLY_DATA_STORE: Record<string, MonthDashboardData> = {
  current: {
    monthKey: 'current',
    monthLabel: 'Current Month',
    totalCost: 242000,
    prevCost: 210000,
    costChange: '+15.2%',
    costTrend: 'up',
    totalMeals: 1240,
    mealChange: '+8.1%',
    activeEmployees: 450,
    deptData: [
      { name: 'Production', cost: 95000 },
      { name: 'Logistics', cost: 52000 },
      { name: 'IT', cost: 45000 },
      { name: 'HR', cost: 26000 },
      { name: 'Finance', cost: 24000 },
    ],
    topDepartments: [
      { name: 'Production', employees: 240, meals: 850, cost: 'LKR 95,000', status: 'High' },
      { name: 'Logistics', employees: 85, meals: 320, cost: 'LKR 52,000', status: 'Normal' },
      { name: 'IT', employees: 45, meals: 220, cost: 'LKR 45,000', status: 'Normal' },
      { name: 'HR', employees: 30, meals: 130, cost: 'LKR 26,000', status: 'Low' },
      { name: 'Finance', employees: 25, meals: 110, cost: 'LKR 24,000', status: 'Low' },
    ],
  },
  last: {
    monthKey: 'last',
    monthLabel: 'Last Month',
    totalCost: 210000,
    prevCost: 195000,
    costChange: '+7.7%',
    costTrend: 'up',
    totalMeals: 1080,
    mealChange: '+9.1%',
    activeEmployees: 440,
    deptData: [
      { name: 'Production', cost: 84000 },
      { name: 'Logistics', cost: 46000 },
      { name: 'IT', cost: 38000 },
      { name: 'HR', cost: 23000 },
      { name: 'Finance', cost: 19000 },
    ],
    topDepartments: [
      { name: 'Production', employees: 235, meals: 780, cost: 'LKR 84,000', status: 'High' },
      { name: 'Logistics', employees: 85, meals: 290, cost: 'LKR 46,000', status: 'Normal' },
      { name: 'IT', employees: 45, meals: 190, cost: 'LKR 38,000', status: 'Normal' },
      { name: 'HR', employees: 30, meals: 115, cost: 'LKR 23,000', status: 'Low' },
      { name: 'Finance', employees: 25, meals: 95, cost: 'LKR 19,000', status: 'Low' },
    ],
  },
  mar: {
    monthKey: 'mar',
    monthLabel: 'March',
    totalCost: 195000,
    prevCost: 215000,
    costChange: '-9.3%',
    costTrend: 'down',
    totalMeals: 990,
    mealChange: '-10.8%',
    activeEmployees: 435,
    deptData: [
      { name: 'Production', cost: 78000 },
      { name: 'Logistics', cost: 43000 },
      { name: 'IT', cost: 36000 },
      { name: 'HR', cost: 21000 },
      { name: 'Finance', cost: 17000 },
    ],
    topDepartments: [
      { name: 'Production', employees: 230, meals: 720, cost: 'LKR 78,000', status: 'High' },
      { name: 'Logistics', employees: 82, meals: 270, cost: 'LKR 43,000', status: 'Normal' },
      { name: 'IT', employees: 45, meals: 180, cost: 'LKR 36,000', status: 'Normal' },
      { name: 'HR', employees: 28, meals: 105, cost: 'LKR 21,000', status: 'Low' },
      { name: 'Finance', employees: 25, meals: 85, cost: 'LKR 17,000', status: 'Low' },
    ],
  },
  feb: {
    monthKey: 'feb',
    monthLabel: 'February',
    totalCost: 215000,
    prevCost: 180000,
    costChange: '+19.4%',
    costTrend: 'up',
    totalMeals: 1110,
    mealChange: '+20.6%',
    activeEmployees: 430,
    deptData: [
      { name: 'Production', cost: 88000 },
      { name: 'Logistics', cost: 47000 },
      { name: 'IT', cost: 39000 },
      { name: 'HR', cost: 22000 },
      { name: 'Finance', cost: 19000 },
    ],
    topDepartments: [
      { name: 'Production', employees: 230, meals: 790, cost: 'LKR 88,000', status: 'High' },
      { name: 'Logistics', employees: 80, meals: 300, cost: 'LKR 47,000', status: 'Normal' },
      { name: 'IT', employees: 45, meals: 195, cost: 'LKR 39,000', status: 'Normal' },
      { name: 'HR', employees: 28, meals: 110, cost: 'LKR 22,000', status: 'Low' },
      { name: 'Finance', employees: 25, meals: 95, cost: 'LKR 19,000', status: 'Low' },
    ],
  },
  jan: {
    monthKey: 'jan',
    monthLabel: 'January',
    totalCost: 180000,
    prevCost: 175000,
    costChange: '+2.8%',
    costTrend: 'up',
    totalMeals: 920,
    mealChange: '+3.1%',
    activeEmployees: 420,
    deptData: [
      { name: 'Production', cost: 74000 },
      { name: 'Logistics', cost: 40000 },
      { name: 'IT', cost: 33000 },
      { name: 'HR', cost: 18000 },
      { name: 'Finance', cost: 15000 },
    ],
    topDepartments: [
      { name: 'Production', employees: 225, meals: 680, cost: 'LKR 74,000', status: 'High' },
      { name: 'Logistics', employees: 78, meals: 250, cost: 'LKR 40,000', status: 'Normal' },
      { name: 'IT', employees: 42, meals: 160, cost: 'LKR 33,000', status: 'Normal' },
      { name: 'HR', employees: 26, meals: 95, cost: 'LKR 18,000', status: 'Low' },
      { name: 'Finance', employees: 24, meals: 75, cost: 'LKR 15,000', status: 'Low' },
    ],
  },
};

const monthlyData = [
  { month: 'Jan', cost: 180000 },
  { month: 'Feb', cost: 215000 },
  { month: 'Mar', cost: 195000 },
  { month: 'Last Month', cost: 210000 },
  { month: 'Current', cost: 242000 },
];

const COLORS = ['#fbbf24', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

const AdminDashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('current');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [liveTransactions, setLiveTransactions] = useState<LiveTransaction[]>(() => canteenStore.getTransactions());
  const [lastLivePunch, setLastLivePunch] = useState<LiveTransaction | null>(null);
  const [livePulseKey, setLivePulseKey] = useState(0);

  useEffect(() => {
    return canteenStore.subscribe(() => {
      const all = canteenStore.getTransactions();
      setLiveTransactions(all);
      const newest = all[0];
      if (newest && newest.isLive) {
        setLastLivePunch(newest);
        setLivePulseKey(k => k + 1);
      }
    });
  }, []);

  const activeData = useMemo(() => {
    const base = MONTHLY_DATA_STORE[selectedMonth] || MONTHLY_DATA_STORE.current;
    if (selectedMonth !== 'current') {
      return {
        ...base,
        addedLiveCost: 0,
        addedLiveMeals: 0,
        liveCount: 0,
      };
    }

    // Aggregate all real-time live transactions
    const liveTx = liveTransactions.filter(t => t.isLive === true);
    const deptAdditions: Record<string, { cost: number; meals: number }> = {};
    let totalAddedCost = 0;
    let totalAddedMeals = 0;

    liveTx.forEach(tx => {
      if (!deptAdditions[tx.dept]) {
        deptAdditions[tx.dept] = { cost: 0, meals: 0 };
      }
      deptAdditions[tx.dept].cost += tx.cost;
      deptAdditions[tx.dept].meals += (tx.type === 'meal' ? tx.qty : 0);
      totalAddedCost += tx.cost;
      totalAddedMeals += (tx.type === 'meal' ? tx.qty : 1);
    });

    const updatedDeptData = base.deptData.map(d => ({
      name: d.name,
      cost: d.cost + (deptAdditions[d.name]?.cost || 0)
    }));

    const updatedTopDepartments = base.topDepartments.map(dept => {
      const add = deptAdditions[dept.name] || { cost: 0, meals: 0 };
      const baseCostNum = parseInt(dept.cost.replace(/[^\d]/g, ''), 10) || 0;
      const newCost = baseCostNum + add.cost;
      const newMeals = dept.meals + add.meals;
      return {
        ...dept,
        meals: newMeals,
        cost: `LKR ${newCost.toLocaleString()}`,
        _rawCost: newCost,
        status: (newCost > 85000 ? 'High' : newCost > 35000 ? 'Normal' : 'Low') as 'High' | 'Normal' | 'Low'
      };
    }).sort((a, b) => b._rawCost - a._rawCost);

    const newTotalCost = base.totalCost + totalAddedCost;
    const newTotalMeals = base.totalMeals + totalAddedMeals;

    return {
      ...base,
      totalCost: newTotalCost,
      totalMeals: newTotalMeals,
      deptData: updatedDeptData,
      topDepartments: updatedTopDepartments,
      addedLiveCost: totalAddedCost,
      addedLiveMeals: totalAddedMeals,
      liveCount: liveTx.length
    };
  }, [selectedMonth, liveTransactions]);

  const dynamicMonthlyData = useMemo(() => {
    return [
      { month: 'Jan', cost: 180000 },
      { month: 'Feb', cost: 215000 },
      { month: 'Mar', cost: 195000 },
      { month: 'Last Month', cost: 210000 },
      { month: 'Current', cost: activeData.totalCost },
    ];
  }, [activeData.totalCost]);

  const handleSimulatePunch = () => {
    canteenStore.simulatePunch();
  };

  const handleDownloadReport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + `Department,Cost (LKR),Month\n`
      + activeData.deptData.map(d => `${d.name},${d.cost},${activeData.monthLabel}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Canteen_Cost_${activeData.monthLabel.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">System Overview</h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold text-emerald-800 tracking-tight">Live Real-time Sync</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time canteen expenditure and operations tracking for <strong className="text-slate-800">{activeData.monthLabel}</strong>.
            {activeData.addedLiveCost > 0 && (
              <span className="ml-1 text-emerald-600 font-medium">
                (Reflecting <strong>+LKR {activeData.addedLiveCost.toLocaleString()}</strong> from live transactions)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleSimulatePunch}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 border border-amber-500/20"
            title="Simulate instant biometric / terminal issuance to verify real-time cost updates"
          >
            <Zap size={14} className="text-slate-900 fill-slate-900" />
            <span>Simulate Live Punch (+LKR 250)</span>
          </button>
          
          <button 
            onClick={handleDownloadReport}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-1.5"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download size={15} className="text-slate-600" />
                <span>Download Report ({activeData.monthLabel})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Transaction Flash Banner */}
      <AnimatePresence>
        {lastLivePunch && (
          <motion.div
            key={livePulseKey}
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                <Activity size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span>Live Punch Captured:</span>
                  <span className="text-emerald-700 font-extrabold bg-emerald-100/60 px-2 py-0.5 rounded-md">{lastLivePunch.item}</span>
                  <span className="text-slate-500">issued to</span>
                  <span className="text-slate-900 font-extrabold">{lastLivePunch.dept}</span>
                  <span className="text-slate-400 text-[11px] font-normal font-mono">({lastLivePunch.user})</span>
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Amount: <strong className="text-slate-800 font-mono font-bold">LKR {lastLivePunch.cost.toLocaleString()}</strong> • Time: <span className="font-mono">{lastLivePunch.time}</span> • Department costs and top rankings updated live.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
                ● Live Updated
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: `Total Cost (${activeData.monthLabel})`, 
            value: `LKR ${activeData.totalCost.toLocaleString()}`, 
            change: activeData.costChange, 
            trend: activeData.costTrend, 
            icon: DollarSign, 
            color: 'blue' 
          },
          { 
            label: 'Benchmark Prior Month', 
            value: `LKR ${activeData.prevCost.toLocaleString()}`, 
            change: 'Baseline', 
            trend: 'neutral', 
            icon: TrendingDown, 
            color: 'amber' 
          },
          { 
            label: 'Total Meals Issued', 
            value: activeData.totalMeals.toLocaleString(), 
            change: activeData.mealChange, 
            trend: 'up', 
            icon: UtensilsCrossed, 
            color: 'emerald' 
          },
          { 
            label: 'Active Employees', 
            value: activeData.activeEmployees.toString(), 
            change: '0%', 
            trend: 'neutral', 
            icon: Users, 
            color: 'indigo' 
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "p-3 rounded-xl",
                stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                "bg-indigo-50 text-indigo-600"
              )}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                stat.trend === 'up' ? "bg-emerald-50 text-emerald-600" :
                stat.trend === 'down' ? "bg-rose-50 text-rose-600" :
                "bg-slate-50 text-slate-600"
              )}>
                {stat.trend === 'up' && <TrendingUp size={12} />}
                {stat.trend === 'down' && <TrendingDown size={12} />}
                {stat.change}
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-amber-500" />
                  Department-wise Cost
                </h3>
                {selectedMonth === 'current' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                Viewing: <span className="text-amber-600 font-bold">{activeData.monthLabel}</span>
                {selectedMonth === 'current' && activeData.addedLiveCost > 0 && (
                  <span className="ml-2 text-emerald-600 font-bold">
                    (+LKR {activeData.addedLiveCost.toLocaleString()} live)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="dept-month-select" className="text-xs font-bold text-slate-400">Month:</label>
              <select 
                id="dept-month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-bold bg-slate-100 hover:bg-slate-200 border-none rounded-xl px-3 py-1.5 outline-none cursor-pointer text-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-amber-400"
              >
                <option value="current">Current Month (Live)</option>
                <option value="last">Last Month</option>
                <option value="mar">March</option>
                <option value="feb">February</option>
                <option value="jan">January</option>
              </select>
            </div>
          </div>
          <div className="h-[300px] w-full" key={`barchart-${activeData.totalCost}-${selectedMonth}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeData.deptData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `LKR ${value/1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`LKR ${Number(value).toLocaleString()}`, 'Cost']}
                />
                <Bar dataKey="cost" radius={[6, 6, 0, 0]} barSize={40} isAnimationActive={true}>
                  {activeData.deptData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-0.5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" />
                Monthly Cost Trend
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                Current: <span className="text-blue-600 font-bold">LKR {activeData.totalCost.toLocaleString()}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Live Dynamic Trend
              </span>
            </div>
          </div>
          <div className="h-[300px] w-full" key={`linechart-${activeData.totalCost}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynamicMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `LKR ${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`LKR ${Number(value).toLocaleString()}`, 'Expenditure']}
                />
                <Line 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      {/* Top Costly Departments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Top 5 Costly Departments</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Breakdown for <strong className="text-slate-700">{activeData.monthLabel}</strong>
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
            Total: LKR {activeData.totalCost.toLocaleString()}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Employees</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Meal Count</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Cost</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeData.topDepartments.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-semibold text-slate-700">{row.name}</td>
                  <td className="px-6 py-4 text-slate-600">{row.employees}</td>
                  <td className="px-6 py-4 text-slate-600">{row.meals}</td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">{row.cost}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      row.status === 'High' ? "bg-rose-50 text-rose-600" :
                      row.status === 'Normal' ? "bg-blue-50 text-blue-600" :
                      "bg-emerald-50 text-emerald-600"
                    )}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
