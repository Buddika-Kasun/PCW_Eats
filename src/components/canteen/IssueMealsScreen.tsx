/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Meal-issuing terminal. Times use Asia/Colombo (Sri Lanka).
 * Sends the full user payload (dept, userName) so the server never
 * has to invent them. `item` is saved as the raw meal ID.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Utensils,
  AlertCircle,
  Fingerprint,
  History,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, ActiveMeal, RecentMealRecord } from "../../lib/api";
import { Meal } from "../../types";
import { hhmmToAmPm } from "@/src/lib/date";

interface IssueMealsScreenProps {
  canteenId?: string;
}

interface DirectoryUser {
  id: string;
  name: string;
  dept: string;
  departmentId?: string | number;
  role?: string;
  email?: string;
}

interface FoundUser extends DirectoryUser {
  eligibleMeals: ActiveMeal[];
}

export const IssueMealsScreen: React.FC<IssueMealsScreenProps> = ({
  canteenId,
}) => {
  const [mealUserId, setMealUserId] = useState("");
  const [foundMealUser, setFoundMealUser] = useState<FoundUser | null>(null);
  const [recentMeals, setRecentMeals] = useState<RecentMealRecord[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [mealSearchError, setMealSearchError] = useState<string | null>(null);
  const [lastIssuedNotice, setLastIssuedNotice] = useState<{
    user: string;
    meal: string;
    cost: number;
  } | null>(null);

  const [userMatches, setUserMatches] = useState<DirectoryUser[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [mealsReason, setMealsReason] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const mealInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mealInputRef.current?.focus();
  }, []);

  const loadRecentMeals = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await api.transactions.recentMeals(10);
      setRecentMeals(res.data ?? []);
    } catch (err) {
      console.warn("Could not load recent meals:", err);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecentMeals();
  }, [loadRecentMeals]);

  const loadActiveMealsForUser = async (
    userId: string,
  ): Promise<ActiveMeal[]> => {
    setMealsLoading(true);
    setMealsReason(null);
    try {
      const res = await api.meals.getActiveForUser(userId);
      setMealsReason(res.reason ?? null);
      return res.data ?? [];
    } catch (err) {
      console.warn("Could not load active meals for user:", err);
      setMealsReason("Could not check eligible meals. Please try again.");
      return [];
    } finally {
      setMealsLoading(false);
    }
  };

  const commitMealUser = async (u: DirectoryUser & { raw?: any }) => {
    const normalized: DirectoryUser = {
      id: u.id,
      name: u.name,
      dept: u.dept,
      departmentId: u.raw?.departmentId ?? u.departmentId,
      role: u.role,
      email: u.email,
    };
    setMealUserId('#' + normalized.id);
    setShowUserDropdown(false);
    setUserMatches([]);
    setMealSearchError(null);
    setMealsReason(null);
    setFoundMealUser({ ...normalized, eligibleMeals: [] });

    const eligible = await loadActiveMealsForUser(normalized.id);
    setFoundMealUser({ ...normalized, eligibleMeals: eligible });
  };

  const handleUserSearch = async (query?: string) => {
    const q = (query !== undefined ? query : mealUserId).trim();
    setMealSearchError(null);
    setFoundMealUser(null);
    setShowUserDropdown(false);
    setMealsReason(null);

    if (!q) {
      setUserMatches([]);
      setMealSearchError("Please scan or enter an #Employee ID / Name.");
      return;
    }

    setSearching(true);
    try {
      const res = await api.users.search(q);
      const matches = res.data ?? [];

      if (matches.length === 0) {
        setUserMatches([]);
        setMealSearchError(`No employee found matching "${q}".`);
        return;
      }

      if (matches.length === 1) {
        await commitMealUser(matches[0]);
        return;
      }

      setUserMatches(matches);
      setShowUserDropdown(true);
    } catch (err: unknown) {
      setUserMatches([]);
      setMealSearchError(
        err instanceof Error ? err.message : "User search failed",
      );
    } finally {
      setSearching(false);
    }
  };

  const handleScan = async (scannedId: string) => {
    const id = scannedId.trim();
    if (!id) return;

    setSearching(true);
    setMealSearchError(null);
    setMealsReason(null);
    try {
      const res = await api.users.getById(id);
      if (!res.data) {
        setMealSearchError(`Employee ID "${id}" not found in system.`);
        setFoundMealUser(null);
        return;
      }
      await commitMealUser(res.data);
    } catch (err: unknown) {
      setMealSearchError(
        err instanceof Error
          ? err.message
          : `Employee ID "${id}" not found in system.`,
      );
      setFoundMealUser(null);
    } finally {
      setSearching(false);
    }
  };

  const handleIssueMeal = async (meal: Meal) => {
    if (!foundMealUser || issuing) return;

    setIssuing(true);
    try {
      const res = await api.transactions.issueMeal({
        employeeId: foundMealUser.id,
        mealId: meal.id,
        canteenId: canteenId || "1",
        dept: foundMealUser.dept,
        departmentId: foundMealUser.departmentId,
        userName: foundMealUser.name,
      });

      setLastIssuedNotice({
        user: res.data.userName ?? foundMealUser.name,
        meal: res.data.mealName ?? meal.name,
        cost: res.data.cost ?? meal.cost,
      });

      setFoundMealUser(null);
      setMealUserId("");
      setMealSearchError(null);
      setMealsReason(null);

      void loadRecentMeals();

      setTimeout(() => mealInputRef.current?.focus(), 50);
      setTimeout(() => setLastIssuedNotice(null), 4000);
    } catch (err: unknown) {
      setMealSearchError(
        err instanceof Error ? err.message : "Failed to issue meal",
      );
    } finally {
      setIssuing(false);
    }
  };

  const noMealTitle = mealsReason?.toLowerCase().includes("already")
    ? "Meal Already Issued"
    : "No Meal Available Right Now";

  const noMealBody =
    mealsReason ??
    "No meal window is currently open or this employee has already received their meal.";

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex p-3 bg-amber-100 text-amber-900 rounded-2xl mb-1">
            <Utensils size={28} />
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Meal Issuing Terminal
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Capture Employee ID via fingerprint reader, barcode scan, or manual
            entry.
          </p>
        </div>

        <AnimatePresence>
          {lastIssuedNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-xl mx-auto p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black">
                  ✓
                </div>
                <div className="text-left">
                  <p className="font-black text-sm">Meal Issued Successfully</p>
                  <p className="text-xs text-emerald-800">
                    {lastIssuedNotice.user} · {lastIssuedNotice.meal} (LKR{" "}
                    {lastIssuedNotice.cost})
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">
                Ready for next person
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-xl mx-auto space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider text-left">
                #Employee ID / Name
              </label>
              <span className="text-[11px] text-slate-400">
                Scan, type Name/#ID then press Enter
              </span>
            </div>

            <div className="relative">
              <div className="relative flex items-center">
                <div className="absolute left-5 text-slate-400 pointer-events-none">
                  {searching ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <Fingerprint size={24} />
                  )}
                </div>
                <input
                  ref={mealInputRef}
                  type="text"
                  value={mealUserId}
                  onChange={(e) => {
                    setMealUserId(e.target.value);
                    setShowUserDropdown(false);
                    if (mealSearchError) setMealSearchError(null);
                    if (foundMealUser) setFoundMealUser(null);
                    if (mealsReason) setMealsReason(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleUserSearch();
                    }
                  }}
                  placeholder="Scan fingerprint or type Employee ID/Name…"
                  autoFocus
                  className="w-full pl-14 pr-32 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-bold focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => void handleUserSearch()}
                  disabled={searching}
                  className="absolute right-3 px-5 py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-slate-900 rounded-xl font-black text-sm transition-all shadow-md shadow-amber-400/20 cursor-pointer"
                >
                  {searching ? "…" : "Search"}
                </button>
              </div>

              <AnimatePresence>
                {showUserDropdown && userMatches.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute z-20 left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-72 overflow-y-auto"
                  >
                    {userMatches.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => void commitMealUser(u)}
                        className="w-full px-5 py-3 text-left hover:bg-amber-50 transition-colors flex items-center gap-4 border-b border-slate-100 last:border-b-0 cursor-pointer"
                      >
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black shrink-0">
                          {(u.name || "?")[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 truncate">
                            {u.name}
                          </p>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider truncate">
                            {u.id}
                            {u.dept ? ` · ${u.dept}` : ""}
                          </p>
                        </div>
                        <ChevronRight
                          size={18}
                          className="text-slate-300 shrink-0"
                        />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {mealSearchError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 text-left">
              <AlertCircle size={16} className="shrink-0" />
              <span>{mealSearchError}</span>
            </div>
          )}
        </div>

        {foundMealUser && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl mx-auto p-6 bg-slate-50 border-2 border-slate-200 rounded-3xl space-y-6 text-left"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-xl font-black">
                  {(foundMealUser.name || "?")[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xl font-black text-slate-900">
                      {foundMealUser.name}
                    </h4>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-mono font-bold">
                      {foundMealUser.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    {foundMealUser.dept
                      ? `${foundMealUser.dept} Department`
                      : "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFoundMealUser(null);
                  setMealUserId("");
                  setMealsReason(null);
                  mealInputRef.current?.focus();
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Eligible Meal for Current Window
              </p>

              {mealsLoading && (
                <div className="p-5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-500 text-center flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Checking eligible meals…
                </div>
              )}

              {!mealsLoading && foundMealUser.eligibleMeals.length === 0 && (
                <div className="p-5 bg-white border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-1">
                  <p className="font-black text-slate-800">{noMealTitle}</p>
                  <p className="text-xs text-slate-500">{noMealBody}</p>
                </div>
              )}

              {foundMealUser.eligibleMeals.map((meal) => (
                <div
                  key={meal.id}
                  className="p-5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-400 text-slate-900 rounded-xl flex items-center justify-center font-bold">
                      <Utensils size={24} />
                    </div>
                    <div>
                      <h5 className="text-lg font-black text-slate-900">
                        {meal.name}
                      </h5>
                      <p className="text-xs text-slate-500 font-medium">
                        {hhmmToAmPm(meal.eligibleFrom)} - {hhmmToAmPm(meal.eligibleTo)} Cost: LKR {meal.cost}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleIssueMeal(meal)}
                    disabled={issuing}
                    className="px-6 py-3 bg-slate-900 text-white hover:bg-emerald-600 disabled:opacity-60 rounded-xl font-black text-sm transition-all shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {issuing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Issuing…
                      </>
                    ) : (
                      "Confirm & Issue"
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History size={20} className="text-slate-400" />
            Recent Meal Issues
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
              Today
            </span>
          </h3>
          <button
            type="button"
            onClick={() => void loadRecentMeals()}
            disabled={recentLoading}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-60 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
          >
            <RefreshCw
              size={14}
              className={recentLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {recentLoading && recentMeals.length === 0 && (
          <div className="p-6 text-sm text-slate-500 text-center flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={16} />
            Loading today's meal issues…
          </div>
        )}

        {!recentLoading && recentMeals.length === 0 && (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-500 text-center">
            No meals have been issued today yet.
          </div>
        )}

        {recentMeals.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Time
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    User
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Dept
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Meal
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentMeals.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-4 text-sm font-bold text-slate-500">
                      {hhmmToAmPm(tx.time) || "—"}
                    </td>
                    <td className="py-4 text-sm font-black text-slate-900">
                      {tx.user}
                    </td>
                    <td className="py-4 text-sm text-slate-600">
                      {tx.dept || "—"}
                    </td>
                    <td className="py-4 text-sm font-bold text-slate-700">
                      {tx.meal}
                    </td>
                    <td className="py-4 text-sm font-black text-slate-900 text-right">
                      LKR {tx.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
