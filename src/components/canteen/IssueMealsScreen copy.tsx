/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Meal-issuing terminal. Extracted from CanteenInterface.tsx.
 * Owns its own search / dropdown / eligible-meal state so the parent
 * stays focused on inventory, batches, and snacks.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Utensils,
  AlertCircle,
  Fingerprint,
  History,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { Meal } from "../../types";
import { MOCK_USERS, MOCK_MEALS } from "../../constants";

interface IssueMealsScreenProps {
  canteenId?: string;
}

interface MockUserLite {
  id: string;
  name: string;
  dept: string;
}

interface FoundUser extends MockUserLite {
  eligibleMeals: Meal[];
}

interface RecentMeal {
  id: string;
  time: string;
  user: string;
  dept: string;
  meal: string;
  cost: number;
}

export const IssueMealsScreen: React.FC<IssueMealsScreenProps> = ({
  canteenId,
}) => {
  const [mealUserId, setMealUserId] = useState("");
  const [foundMealUser, setFoundMealUser] = useState<FoundUser | null>(null);
  const [recentMeals, setRecentMeals] = useState<RecentMeal[]>([]);
  const [mealSearchError, setMealSearchError] = useState<string | null>(null);
  const [lastIssuedNotice, setLastIssuedNotice] = useState<{
    user: string;
    meal: string;
    cost: number;
  } | null>(null);

  const [userMatches, setUserMatches] = useState<MockUserLite[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const mealInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount so a scan can hit immediately
  useEffect(() => {
    mealInputRef.current?.focus();
  }, []);

  // -------------------------------------------------------------------------
  // Search / scan helpers
  // -------------------------------------------------------------------------
  const commitMealUser = (u: MockUserLite) => {
    setMealUserId(u.id);
    setShowUserDropdown(false);
    setUserMatches([]);
    setMealSearchError(null);

    const fullUser = MOCK_USERS.find((x) => x.id === u.id);
    setFoundMealUser({
      ...(fullUser ?? u),
      // Replace with real eligibility logic when the backend exposes it
      eligibleMeals: [MOCK_MEALS[1]],
    });
  };

  const handleUserSearch = (query?: string) => {
    const q = (query !== undefined ? query : mealUserId).trim();
    setMealSearchError(null);
    setFoundMealUser(null);
    setShowUserDropdown(false);

    if (!q) {
      setUserMatches([]);
      setMealSearchError("Please scan or enter an Employee ID / name.");
      return;
    }

    const matches = MOCK_USERS.filter(
      (u) =>
        u.id.toLowerCase().includes(q.toLowerCase()) ||
        u.name.toLowerCase().includes(q.toLowerCase()),
    );

    if (matches.length === 0) {
      setUserMatches([]);
      setMealSearchError(`No employee found matching "${q}".`);
      return;
    }

    if (matches.length === 1) {
      commitMealUser(matches[0]);
      return;
    }

    setUserMatches(
      matches.map((m) => ({ id: m.id, name: m.name, dept: m.dept })),
    );
    setShowUserDropdown(true);
  };

  const handleScan = (scannedId: string) => {
    const id = scannedId.trim();
    if (!id) return;
    const user = MOCK_USERS.find(
      (u) => u.id.toLowerCase() === id.toLowerCase(),
    );
    if (!user) {
      setMealSearchError(`Employee ID "${id}" not found in system.`);
      setFoundMealUser(null);
      return;
    }
    setMealUserId(user.id);
    commitMealUser(user);
  };

  // -------------------------------------------------------------------------
  // Issue meal
  // -------------------------------------------------------------------------
  const handleIssueMeal = async (meal: Meal) => {
    if (!foundMealUser) return;

    try {
      await api.transactions.issueMeal({
        employeeId: foundMealUser.id,
        mealId: meal.id,
        canteenId: canteenId || "1",
      });
    } catch (err) {
      console.warn("Backend sync warning:", err);
    }

    const issuedRecord: RecentMeal = {
      id: Math.random().toString(36).slice(2, 11),
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      user: foundMealUser.name,
      dept: foundMealUser.dept,
      meal: meal.name,
      cost: meal.cost,
    };

    setRecentMeals((prev) => [issuedRecord, ...prev].slice(0, 5));
    setLastIssuedNotice({
      user: foundMealUser.name,
      meal: meal.name,
      cost: meal.cost,
    });

    setFoundMealUser(null);
    setMealUserId("");
    setMealSearchError(null);

    setTimeout(() => mealInputRef.current?.focus(), 50);
    setTimeout(() => setLastIssuedNotice(null), 4000);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
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
                Employee ID / Name
              </label>
              <span className="text-[11px] text-slate-400">
                Scan, type name/ID then press Enter
              </span>
            </div>

            <div className="relative">
              <div className="relative flex items-center">
                <div className="absolute left-5 text-slate-400 pointer-events-none">
                  <Fingerprint size={24} />
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
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUserSearch();
                    }
                  }}
                  placeholder="Scan fingerprint or type Employee ID / name…"
                  autoFocus
                  className="w-full pl-14 pr-32 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-bold focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleUserSearch()}
                  className="absolute right-3 px-5 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl font-black text-sm transition-all shadow-md shadow-amber-400/20 cursor-pointer"
                >
                  Search
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
                        onClick={() => commitMealUser(u)}
                        className="w-full px-5 py-3 text-left hover:bg-amber-50 transition-colors flex items-center gap-4 border-b border-slate-100 last:border-b-0 cursor-pointer"
                      >
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black shrink-0">
                          {u.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 truncate">
                            {u.name}
                          </p>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider truncate">
                            {u.id} · {u.dept}
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

          <div className="pt-2 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Test IDs (Simulates Scan)
              </span>
              <span className="text-[11px] text-slate-400">
                Direct scan — skips dropdown
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {MOCK_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleScan(u.id)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all border border-slate-200/60 cursor-pointer"
                >
                  <span className="font-bold text-slate-900">{u.id}</span> (
                  {u.name} · {u.dept})
                </button>
              ))}
            </div>
          </div>
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
                  {foundMealUser.name[0]}
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
                    {foundMealUser.dept} Department
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFoundMealUser(null);
                  setMealUserId("");
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
                        Window: {meal.eligibleFrom} - {meal.eligibleTo} · Cost:
                        LKR {meal.cost}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleIssueMeal(meal)}
                    className="px-6 py-3 bg-slate-900 text-white hover:bg-emerald-600 rounded-xl font-black text-sm transition-all shadow-md cursor-pointer"
                  >
                    Confirm & Issue
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {recentMeals.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <History size={20} className="text-slate-400" />
            Recent Meal Issues
          </h3>
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
                      {tx.time}
                    </td>
                    <td className="py-4 text-sm font-black text-slate-900">
                      {tx.user}
                    </td>
                    <td className="py-4 text-sm text-slate-600">{tx.dept}</td>
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
        </div>
      )}
    </div>
  );
};
