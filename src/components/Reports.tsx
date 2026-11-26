/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Filter,
  Download,
  Calendar,
  Building2,
  Utensils,
  Coffee,
  Package,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "../lib/utils";
import { api, ReportTransaction, ReportInventoryRow } from "../lib/api";
import { Canteen } from "../types";

type Tab = "snacks" | "meals" | "inventory";
type RangeKey = "current" | "last" | "last3" | "custom";

const RANGE_LABEL: Record<string, RangeKey> = {
  "Current Month": "current",
  "Last Month": "last",
  "Last 3 Months": "last3",
  "Custom Range": "custom",
};

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("meals");
  const [dateRange, setDateRange] = useState("Current Month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Filter selections (pending → applied via Apply Filters)
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCanteen, setSelectedCanteen] = useState("");

  // Lookups (from APIs)
  const [departments, setDepartments] = useState<string[]>([]);
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Data
  const [transactions, setTransactions] = useState<ReportTransaction[]>([]);
  const [inventory, setInventory] = useState<ReportInventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appliedFilters, setAppliedFilters] = useState({
    dept: "",
    canteenId: "",
    range: "current" as RangeKey,
    from: "",
    to: "",
  });

  /* ------------------------------------------------------------------ */
  /* Load departments + canteens on mount                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFiltersLoading(true);
      try {
        // Departments: prefer /reports/departments (matches Transaction.dept
        // names exactly). Fallback to /departments/get-all if empty.
        let deptNames: string[] = [];
        // try {
        //   const r = await api.reports.departments();
        //   deptNames = Array.isArray(r.data) ? r.data : [];
        // } catch {
        //   /* try fallback below */
        // }
        if (deptNames.length === 0) {
          try {
            const fallback = await api.departments.getAll();
            deptNames = fallback.map((d) => d.name);
          } catch {
            /* leave empty */
          }
        }
        if (!cancelled) setDepartments(deptNames);

        // Canteens: real API
        try {
          const cRes = await api.canteens.getAll();
          if (!cancelled) setCanteens(cRes.data ?? []);
        } catch {
          if (!cancelled) setCanteens([]);
        }
      } finally {
        if (!cancelled) setFiltersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Load transactions when applied filters change                       */
  /* ------------------------------------------------------------------ */
  const loadTransactions = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (activeTab === "inventory") return;
      if (!opts?.silent) setLoading(true);
      try {
        const type = activeTab === "snacks" ? "snack" : "meal";
        const res = await api.reports.transactions({
          type,
          dept: appliedFilters.dept || undefined,
          // canteenId: appliedFilters.canteenId || undefined,
          range: appliedFilters.range,
          from:
            appliedFilters.range === "custom" ? appliedFilters.from : undefined,
          to: appliedFilters.range === "custom" ? appliedFilters.to : undefined,
        });
        setTransactions(res.data ?? []);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, appliedFilters],
  );

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.reports.inventory();
      setInventory(res.data ?? []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "inventory") loadInventory();
    else loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, appliedFilters]);

  /* ------------------------------------------------------------------ */
  /* Row data (API-backed, no live overlay)                              */
  /* ------------------------------------------------------------------ */
  const filteredData = useMemo(() => {
    if (activeTab === "inventory") return inventory;
    return transactions;
  }, [transactions, inventory, activeTab]);

  const totalCost = useMemo(() => {
    if (activeTab === "inventory") return 0;
    return filteredData.reduce(
      (sum, t) => sum + Number((t as any).cost ?? 0),
      0,
    );
  }, [filteredData, activeTab]);

  /* ------------------------------------------------------------------ */
  /* Handlers                                                            */
  /* ------------------------------------------------------------------ */
  const handleApplyFilters = () => {
    const rangeKey = RANGE_LABEL[dateRange] ?? "current";
    if (rangeKey === "custom" && (!customFrom || !customTo)) {
      setError("Please choose both From and To dates for a custom range.");
      return;
    }
    setAppliedFilters({
      dept: selectedDept,
      canteenId: selectedCanteen,
      range: rangeKey,
      from: customFrom,
      to: customTo,
    });
  };

  const handleExport = () => {
    const type =
      activeTab === "inventory"
        ? undefined
        : activeTab === "snacks"
          ? "snack"
          : "meal";
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (appliedFilters.dept) qs.set("dept", appliedFilters.dept);
    if (appliedFilters.canteenId) qs.set("canteenId", appliedFilters.canteenId);
    qs.set("range", appliedFilters.range);
    if (appliedFilters.range === "custom") {
      qs.set("from", appliedFilters.from);
      qs.set("to", appliedFilters.to);
    }
    window.open(`/api/reports/export?${qs.toString()}`, "_blank");
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Date Range
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
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

            {dateRange === "Custom Range" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            )}

            {/* Department — from API */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Department
              </label>
              <div className="relative">
                <Building2
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  disabled={filtersLoading}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400 transition-all disabled:opacity-60"
                >
                  <option value="">
                    {filtersLoading
                      ? "Loading departments…"
                      : departments.length === 0
                        ? "No departments available"
                        : "All Departments"}
                  </option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Canteen — from API */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Canteen
              </label>
              <div className="relative">
                <Utensils
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <select
                  value={selectedCanteen}
                  onChange={(e) => setSelectedCanteen(e.target.value)}
                  disabled={filtersLoading}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400 transition-all disabled:opacity-60"
                >
                  <option value="">
                    {filtersLoading
                      ? "Loading canteens…"
                      : canteens.length === 0
                        ? "No canteens available"
                        : "All Canteens"}
                  </option>
                  {canteens.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleApplyFilters}
            disabled={loading}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-lg shadow-slate-900/10 cursor-pointer"
          >
            {loading ? "Loading…" : "Apply Filters"}
          </button>
        </div>

        {activeTab !== "inventory" && (
          <div className="bg-slate-900 p-6 rounded-3xl text-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Total Period Cost
            </p>
            <p className="text-2xl font-black text-amber-400">
              LKR {totalCost.toLocaleString()}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Transactions</span>
              <span>{filteredData.length}</span>
            </div>
          </div>
        )}

        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
          <p className="text-xs font-bold text-amber-900 mb-2">Pro Tip</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            You can schedule these reports to be sent to department heads
            automatically every Monday.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {error && (
          <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-700 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto max-w-full">
            {[
              { id: "meals", label: "Meal Cost", icon: Utensils },
              { id: "snacks", label: "Snack Cost", icon: Coffee },
              { id: "inventory", label: "Inventory", icon: Package },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer",
                  activeTab === tab.id
                    ? "bg-amber-400 text-slate-900 shadow-md"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
                )}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() =>
                activeTab === "inventory" ? loadInventory() : loadTransactions()
              }
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleExport}
              disabled={activeTab === "inventory"}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  {activeTab === "inventory" ? (
                    <>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        UOM
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Current Stock
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Min Level
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                        Status
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Item/Meal
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                        Total Cost
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && filteredData.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-400 text-sm"
                    >
                      Loading…
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredData.map((row: any, i) => (
                    <tr
                      key={row.id ?? i}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      {activeTab === "inventory" ? (
                        <>
                          <td className="px-6 py-4 font-semibold text-slate-700">
                            {row.item}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {row.uom}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-900">
                            {row.stock}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {row.minLevel}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                row.status === "Low"
                                  ? "bg-rose-50 text-rose-600"
                                  : "bg-emerald-50 text-emerald-600",
                              )}
                            >
                              {row.status}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {row.date}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">
                            {row.dept}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {row.item}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {row.qty}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-900 text-right">
                            LKR {Number(row.cost).toLocaleString()}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}

                {!loading && filteredData.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-400 text-sm"
                    >
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
