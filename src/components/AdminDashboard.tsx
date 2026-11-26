/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  UtensilsCrossed,
  BarChart3,
  Download,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { api, AdminDashboardResponse } from "../lib/api";

const COLORS = ["#fbbf24", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6"];

const AdminDashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>("current");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // API data
  const [apiData, setApiData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Load admin data from API                                            */
  /* ------------------------------------------------------------------ */
  const load = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const res = await api.adminDashboard.get(selectedMonth);
        setApiData(res.data);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load dashboard data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMonth],
  );

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------------------ */
  /* Active data (direct from API)                                       */
  /* ------------------------------------------------------------------ */
  const activeData = useMemo(() => {
    if (!apiData) {
      return {
        monthKey: selectedMonth,
        monthLabel: "…",
        totalCost: 0,
        prevCost: 0,
        costChange: "0%",
        costTrend: "up" as const,
        totalMeals: 0,
        mealChange: "0%",
        activeEmployees: 0,
        deptData: [] as { name: string; cost: number }[],
        topDepartments: [] as AdminDashboardResponse["topDepartments"],
        monthlyTrend: [] as { month: string; cost: number }[],
        generatedAt: "",
      };
    }
    return apiData;
  }, [apiData, selectedMonth]);

  /* ------------------------------------------------------------------ */
  /* Trend chart data                                                    */
  /* ------------------------------------------------------------------ */
  const dynamicMonthlyData = useMemo(() => {
    return apiData?.monthlyTrend?.length
      ? apiData.monthlyTrend
      : [{ month: "—", cost: 0 }];
  }, [apiData]);

  /* ------------------------------------------------------------------ */
  /* Handlers                                                            */
  /* ------------------------------------------------------------------ */
  const handleDownloadReport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      `Department,Cost (LKR),Month\n` +
      activeData.deptData
        .map((d) => `${d.name},${d.cost},${activeData.monthLabel}`)
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Canteen_Cost_${activeData.monthLabel.replace(/\s+/g, "_")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  if (loading && !apiData) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-12 w-1/2 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[360px] bg-slate-100 rounded-2xl" />
          <div className="h-[360px] bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !apiData) {
    return (
      <div className="bg-rose-50 border border-rose-100 rounded-4xl p-8 text-center space-y-4">
        <XCircle className="mx-auto text-rose-500" size={40} />
        <p className="font-bold text-rose-900">{error}</p>
        <button
          onClick={() => load()}
          className="px-6 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              System Overview
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold text-emerald-800 tracking-tight">
                Live Real-time Sync
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time canteen expenditure and operations tracking for{" "}
            <strong className="text-slate-800">{activeData.monthLabel}</strong>.
          </p>
        </div>
        <div className="flex flex-row items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
            title="Refresh data"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleDownloadReport}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: `Total Cost (${activeData.monthLabel})`,
            value: `LKR ${activeData.totalCost.toLocaleString()}`,
            change: activeData.costChange,
            trend: activeData.costTrend,
            icon: DollarSign,
            color: "blue",
          },
          {
            label: "Benchmark Prior Month",
            value: `LKR ${activeData.prevCost.toLocaleString()}`,
            change: "Baseline",
            trend: "neutral",
            icon: TrendingDown,
            color: "amber",
          },
          {
            label: "Total Meals Issued",
            value: activeData.totalMeals.toLocaleString(),
            change: activeData.mealChange,
            trend: "up",
            icon: UtensilsCrossed,
            color: "emerald",
          },
          {
            label: "Active Employees",
            value: activeData.activeEmployees.toString(),
            change: "0%",
            trend: "neutral",
            icon: Users,
            color: "indigo",
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
              <div
                className={cn(
                  "p-3 rounded-xl",
                  stat.color === "blue"
                    ? "bg-blue-50 text-blue-600"
                    : stat.color === "amber"
                      ? "bg-amber-50 text-amber-600"
                      : stat.color === "emerald"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-indigo-50 text-indigo-600",
                )}
              >
                <stat.icon size={24} />
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                  stat.trend === "up"
                    ? "bg-emerald-50 text-emerald-600"
                    : stat.trend === "down"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-slate-50 text-slate-600",
                )}
              >
                {stat.trend === "up" && <TrendingUp size={12} />}
                {stat.trend === "down" && <TrendingDown size={12} />}
                {stat.change}
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">
              {stat.label}
            </p>
            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Department-wise Cost */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-amber-500" />
                  Department-wise Cost
                </h3>
                {selectedMonth === "current" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                Viewing:{" "}
                <span className="text-amber-600 font-bold">
                  {activeData.monthLabel}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="dept-month-select"
                className="text-xs font-bold text-slate-400"
              >
                Month:
              </label>
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
          <div
            className="h-[300px] w-full"
            key={`barchart-${activeData.totalCost}-${selectedMonth}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeData.deptData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(value) => `LKR ${value / 1000}k`}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any) => [
                    `LKR ${Number(value).toLocaleString()}`,
                    "Cost",
                  ]}
                />
                <Bar
                  dataKey="cost"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  isAnimationActive={true}
                >
                  {activeData.deptData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Cost Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-0.5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" />
                Monthly Cost Trend
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                Current:{" "}
                <span className="text-blue-600 font-bold">
                  LKR {activeData.totalCost.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />{" "}
                Live Dynamic Trend
              </span>
            </div>
          </div>
          <div
            className="h-[300px] w-full"
            key={`linechart-${activeData.totalCost}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynamicMonthlyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(value) => `LKR ${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any) => [
                    `LKR ${Number(value).toLocaleString()}`,
                    "Expenditure",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#3b82f6"
                  strokeWidth={4}
                  dot={{
                    r: 6,
                    fill: "#3b82f6",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
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
            <h3 className="font-bold text-slate-900">
              Top 5 Costly Departments
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Breakdown for{" "}
              <strong className="text-slate-700">
                {activeData.monthLabel}
              </strong>
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
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Employees
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Meal Count
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeData.topDepartments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm font-bold text-slate-400"
                  >
                    No department data for this month.
                  </td>
                </tr>
              ) : (
                activeData.topDepartments.map((row) => (
                  <tr
                    key={row.name}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {row.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {row.employees}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.meals}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {row.cost}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          row.status === "High"
                            ? "bg-rose-50 text-rose-600"
                            : row.status === "Normal"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-emerald-50 text-emerald-600",
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
