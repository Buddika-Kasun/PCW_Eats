/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Utensils,
  Coffee,
  Calendar,
  Clock,
  Download,
  CheckCircle2,
  AlertCircle,
  History,
  ArrowRight,
  RefreshCw,
  XCircle,
  CalendarX2,
  Coins,
  ShieldAlert,
  ShoppingBag,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { getCachedUser } from "../lib/auth";
import { api, UserDashboardResponse, DashboardMeal } from "../lib/api";
import { isAdminRole } from "../lib/roles";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const MEAL_ICON: Record<string, React.ElementType> = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Utensils,
  snack: Coffee,
  tea: Coffee,
};

const iconForMeal = (name: string) =>
  MEAL_ICON[name?.toLowerCase?.()] ?? Utensils;

const fmtTime = (hhmm: string) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
};

const fmtDateTime = (date?: string, time?: string) => {
  if (!date) return "";
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const label =
    date === today ? "Today" : date === yesterday ? "Yesterday" : date;
  return time ? `${label}, ${fmtTime(time)}` : label;
};

const fmtTakenAt = (takenAt?: string) => {
  if (!takenAt) return "";
  const parts = takenAt.trim().split(" ");
  if (parts.length < 2) return takenAt;
  const [date, time] = parts;
  return `${fmtDateTime(date, time)}`.replace(/, /, " at ");
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */
interface UserDashboardProps {
  onOpenSpecialOrders?: (mode: "list" | "create") => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({
  onOpenSpecialOrders,
}) => {
  const cached = getCachedUser();
  const userId =
    cached?.id != null
      ? cached?.id == 1000
        ? "999999"
        : String(cached.id)
      : "";

  const [data, setData] = useState<UserDashboardResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const load = async (silent = false) => {
    if (!userId) {
      setError("You must be signed in to view your dashboard.");
      setLoading(false);
      return;
    }
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.dashboard.getUser(userId);
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ---------------------------------------------------------------- */
  /* Derived                                                           */
  /* ---------------------------------------------------------------- */
  const displayName =
    data?.user?.name ||
    cached?.displayname?.trim() ||
    cached?.username?.trim() ||
    cached?.email ||
    "User";

  // Today's card meals = issued (past w/ taken) + currently eligible
  const todayMeals: DashboardMeal[] = useMemo(() => {
    if (!data) return [];
    const taken = data.meals.past.filter((m) => m.status === "taken");
    return [...taken, ...data.meals.current];
  }, [data]);

  // Past meals (taken + missed) shown in the shaded section
  const pastMeals: DashboardMeal[] = useMemo(
    () => data?.meals?.past ?? [],
    [data],
  );

  const pastTakenCount = useMemo(
    () => pastMeals.filter((m) => m.status === "taken").length,
    [pastMeals],
  );
  const pastMissedCount = useMemo(
    () => pastMeals.filter((m) => m.status === "missed").length,
    [pastMeals],
  );

  const nextMeal = data?.meals.next?.[0];

  const recentTx = data?.transactions?.slice(0, 3) ?? [];

  const quotaItems = data?.quotas?.items ?? [];

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-12 w-1/2 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-slate-100 rounded-[2.5rem]" />
          <div className="h-96 bg-slate-100 rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-4xl p-8 text-center space-y-4">
        <XCircle className="mx-auto text-red-500" size={40} />
        <p className="font-bold text-red-900">{error}</p>
        <button
          onClick={() => load()}
          className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Welcome back, <span className="text-amber-400">{displayName}</span>!
          </h2>
          <div className="flex items-center gap-3 text-slate-500 mt-2 font-medium">
            <Calendar size={18} className="text-amber-500" />
            <span>{today}</span>
            {data?.user?.deptName && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">{data.user.deptName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-4 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
            title="Refresh"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">
            <Download size={20} />
            <span>Download Department Pass</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Eligibility Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Today's Meal Eligibility
              </h3>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider">
                {data?.summary?.todayMealsEligible
                  ? `${data.summary.todayMealsEligible} Eligible`
                  : "Active"}
              </span>
            </div>

            {todayMeals.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium border-2 border-dashed border-slate-100 rounded-3xl">
                No meals issued or eligible right now.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {todayMeals.map((meal) => {
                  const Icon = iconForMeal(meal.name);
                  const isTaken = meal.status === "taken";
                  return (
                    <div
                      key={meal.id}
                      className={cn(
                        "p-6 rounded-3xl border-2 transition-all",
                        isTaken
                          ? "bg-slate-50 border-slate-100 opacity-70"
                          : "bg-white border-amber-100 shadow-sm",
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={cn(
                            "p-3 rounded-2xl",
                            isTaken
                              ? "bg-slate-200 text-slate-500"
                              : "bg-amber-100 text-amber-600",
                          )}
                        >
                          <Icon size={24} />
                        </div>
                        {isTaken ? (
                          <CheckCircle2
                            size={24}
                            className="text-emerald-500"
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase tracking-widest">
                            <Clock size={12} /> Eligible
                          </div>
                        )}
                      </div>
                      <h4 className="text-xl font-bold text-slate-900">
                        {meal.name}
                      </h4>
                      <p className="text-sm text-slate-500 font-medium mt-1">
                        {fmtTime(meal.eligibleFrom)} –{" "}
                        {fmtTime(meal.eligibleTo)}
                      </p>
                      {isTaken && meal.takenAt && (
                        <p className="text-xs font-bold text-emerald-600 mt-4 flex items-center gap-1">
                          Issued at {meal.takenAt.split(" ")[1] || ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {nextMeal && (
              <div className="p-6 bg-blue-50 rounded-3xl flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">
                    Next: {nextMeal.name}
                  </p>
                  <p className="text-xs text-blue-700 font-medium">
                    Eligible from {fmtTime(nextMeal.eligibleFrom)} today.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Past Meals — shaded cards with full details */}
          {pastMeals.length > 0 && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
                    <CalendarX2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Past Meals Today
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Windows that have already closed for today
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    {pastTakenCount} taken
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                    {pastMissedCount} missed
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pastMeals.map((meal) => {
                  const taken = meal.status === "taken";
                  return (
                    <div
                      key={meal.id}
                      className={cn(
                        "rounded-2xl border p-4 space-y-3 shadow-sm",
                        taken
                          ? "bg-emerald-50/60 border-emerald-200"
                          : "bg-slate-100/70 border-slate-200",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                              taken
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600",
                            )}
                          >
                            <Utensils size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 truncate">
                              {meal.name}
                            </p>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                              {meal.code}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0",
                            taken
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-300 text-slate-700",
                          )}
                        >
                          {taken ? (
                            <>
                              <CheckCircle2 size={12} /> Taken
                            </>
                          ) : (
                            <>
                              <ShieldAlert size={12} /> Missed
                            </>
                          )}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock size={14} className="text-slate-400" />
                          <span className="font-mono font-bold">
                            {fmtTime(meal.eligibleFrom)} –{" "}
                            {fmtTime(meal.eligibleTo)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Coins size={14} className="text-slate-400" />
                          <span className="font-mono font-bold">
                            LKR {Number(meal.cost).toFixed(2)}
                          </span>
                        </div>
                        {taken && meal.takenAt ? (
                          <div className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 size={14} />
                            <span className="font-bold">
                              Issued {fmtTakenAt(meal.takenAt)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-500">
                            <XCircle size={14} />
                            <span className="font-bold">
                              Window closed without issue
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <History size={20} className="text-slate-400" />
                Recent Activity
              </h3>
              <button className="text-sm font-bold text-blue-600 hover:underline">
                View All ({data?.summary?.totalTransactions ?? 0})
              </button>
            </div>
            {recentTx.length === 0 ? (
              <p className="text-sm text-slate-400 font-medium py-4">
                No transactions yet.
              </p>
            ) : (
              <div className="space-y-4">
                {recentTx.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-amber-400 transition-colors" />
                      <div>
                        <p className="font-bold text-slate-900">
                          {t.type === "meal" ? "Meal" : "Item"} Issued —{" "}
                          {t.item}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          {fmtDateTime(t.date, t.time)} • {t.qty} ×{" "}
                          {t.cost?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quota Sidebar */}
        <div className="space-y-8">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-900/20 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="relative">
              <h3 className="text-xl font-bold mb-6">Remaining Quota</h3>
              {quotaItems.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium">
                  No quota configured for your department.
                </p>
              ) : (
                <div className="space-y-6">
                  {quotaItems.map((q, idx) => {
                    const pct =
                      q.eligibleQty > 0
                        ? (q.takenQty / q.eligibleQty) * 100
                        : 0;
                    const color = idx % 2 === 0 ? "amber" : "blue";
                    return (
                      <div key={q.itemId} className="space-y-3">
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-400">{q.itemName}</span>
                          <span>
                            {q.takenQty} / {q.eligibleQty}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(pct, 100)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={cn(
                              "h-full rounded-full",
                              color === "amber"
                                ? "bg-amber-400"
                                : "bg-blue-400",
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 relative">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Quotas reset daily at 00:00 AM. Unused quotas do not carry
                forward.
              </p>
            </div>
          </div>

          {/* Special Orders card — admin-only */}
          {isAdminRole(cached) && (
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Special Orders</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Bulk meals for guests & trainings
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onOpenSpecialOrders?.("create");
                  }}
                  className="py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  + New Order
                </button>
                <button
                  onClick={() => {
                    onOpenSpecialOrders?.("list");
                  }}
                  className="py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  View Orders
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 space-y-4">
            <h4 className="font-bold text-amber-900">Need Help?</h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              If you have issues with your department pass or meal eligibility,
              please contact the HR department.
            </p>
            <button className="w-full py-3 bg-amber-400 text-slate-900 rounded-xl font-bold text-sm hover:bg-amber-500 transition-colors">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
