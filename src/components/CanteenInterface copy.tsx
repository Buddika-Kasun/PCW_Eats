/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Package,
  Utensils,
  Coffee,
  ArrowLeft,
  LayoutDashboard,
  Sparkles,
  LogOut,
} from "lucide-react";
import { MOCK_DAILY_READY_MADE_BATCHES } from "../constants";
import { Canteen, DailyReadyMadeBatch } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api";
import { getCachedUser, logout } from "../lib/auth";
import { isAdminRole } from "../lib/roles";
import { IssueMealsScreen } from "./canteen/IssueMealsScreen";
import { IssueSnacksScreen } from "./canteen/IssueSnacksScreen";
import { InventoryScreen } from "./canteen/InventoryScreen";
import { TerminalPicker } from "./canteen/TerminalPicker";

interface CanteenInterfaceProps {
  onBackToDashboard?: () => void;
}

const CanteenInterface: React.FC<CanteenInterfaceProps> = ({
  onBackToDashboard,
}) => {
  const user = getCachedUser();
  const admin = isAdminRole(user);

  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [canteensLoading, setCanteensLoading] = useState(true);
  const [canteensError, setCanteensError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<
    "menu" | "inventory" | "snacks" | "meals"
  >("menu");

  // Ready-made batches lifted here because both InventoryScreen and
  // IssueSnacksScreen need to mutate them.
  const [dailyBatches, setDailyBatches] = useState<DailyReadyMadeBatch[]>(
    MOCK_DAILY_READY_MADE_BATCHES,
  );

  const loadCanteens = async () => {
    setCanteensLoading(true);
    setCanteensError(null);
    try {
      const res = await api.canteens.getAll();
      setCanteens(res.data ?? []);
    } catch (err: unknown) {
      setCanteensError(
        err instanceof Error ? err.message : "Failed to load canteens",
      );
    } finally {
      setCanteensLoading(false);
    }
  };

  useEffect(() => {
    loadCanteens();
  }, []);

  const handleCanteenSelect = (id: string) => {
    const canteen = canteens.find((c) => c.id === id);
    if (canteen) setSelectedCanteen(canteen);
  };

  const totalRemainingToday = dailyBatches.reduce(
    (acc, b) => acc + b.remainingQty,
    0,
  );
  const totalIssuedToday = dailyBatches.reduce(
    (acc, b) => acc + b.issuedQty,
    0,
  );
  const isAllCleared =
    dailyBatches.length > 0 &&
    dailyBatches.every((b) => b.status === "cleared");

  // If no canteen location selected
  if (!selectedCanteen) {
    return (
      <TerminalPicker
        canteens={canteens}
        loading={canteensLoading}
        error={canteensError}
        admin={admin}
        onPick={handleCanteenSelect}
        onSignOut={logout}
        onBackToDashboard={onBackToDashboard}
        onRetry={loadCanteens}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 md:py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          {currentScreen !== "menu" && (
            <button
              onClick={() => setCurrentScreen("menu")}
              className="p-2 md:p-3 bg-slate-100 rounded-xl md:rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Return to terminal menu"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {currentScreen === "menu"
                ? selectedCanteen.name
                : currentScreen === "inventory"
                  ? "Inventory & Daily Snacks"
                  : currentScreen === "snacks"
                    ? "Issue Snacks (Dept Pass)"
                    : "Issue Meals"}
            </h2>
            <p className="text-[10px] md:text-sm font-bold text-amber-600 uppercase tracking-widest">
              {selectedCanteen.type} Terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {admin && onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-3 md:px-5 py-2 md:py-2.5 bg-amber-400 text-slate-900 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm hover:bg-amber-500 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              title="Return to Main Dashboard"
            >
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">Main Dashboard</span>
            </button>
          )}
          <button
            onClick={() => setSelectedCanteen(null)}
            className="px-3 md:px-5 py-2 md:py-2.5 bg-slate-900 text-white rounded-xl md:rounded-2xl font-bold text-xs md:text-sm hover:bg-slate-800 transition-colors cursor-pointer"
            title="Switch Location"
          >
            Switch Terminal
          </button>
          {!admin && (
            <button
              onClick={logout}
              className="px-3 py-2 md:py-3 bg-rose-600 text-white rounded-xl font-bold text-xs md:text-sm hover:bg-rose-700 transition-colors flex items-center gap-2 cursor-pointer"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* Main Menu Screen */}
          {currentScreen === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-linear-to-r from-amber-500 via-amber-600 to-orange-500 text-white p-6 md:p-8 rounded-4xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <Sparkles size={28} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black">
                        Today's Ready-Made Snacks Status
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">
                        Zero Rollover
                      </span>
                    </div>
                    <p className="text-amber-100 text-sm mt-1">
                      {isAllCleared
                        ? "All ready-made snack batches cleared at closing for today."
                        : `Active fresh batches today: ${totalRemainingToday} items remaining (${totalIssuedToday} issued to staff)`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentScreen("inventory")}
                  className="px-5 py-2.5 bg-white text-slate-900 rounded-xl font-black text-xs hover:bg-amber-50 transition-colors whitespace-nowrap shadow-md cursor-pointer"
                >
                  Manage Ready-Made Batches →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {[
                  {
                    id: "inventory",
                    label: "Inventory & Snacks",
                    icon: Package,
                    color: "blue",
                    desc: "Stock & Ready-Made Batches",
                  },
                  {
                    id: "snacks",
                    label: "Issue Snacks",
                    icon: Coffee,
                    color: "amber",
                    desc: "Dept Pass Issuance",
                  },
                  {
                    id: "meals",
                    label: "Issue Meals",
                    icon: Utensils,
                    color: "emerald",
                    desc: "Daily Meal Window",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentScreen(item.id as any)}
                    className="bg-white p-6 md:p-10 rounded-4xl md:rounded-[2.5rem] border-2 border-transparent hover:border-amber-400 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center transition-all group cursor-pointer"
                  >
                    <div
                      className={cn(
                        "w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl flex items-center justify-center mb-4 md:mb-8 transition-transform group-hover:scale-110",
                        item.color === "blue"
                          ? "bg-blue-50 text-blue-600"
                          : item.color === "amber"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600",
                      )}
                    >
                      <item.icon size={32} className="md:hidden" />
                      <item.icon size={48} className="hidden md:block" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-1 md:mb-2">
                      {item.label}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {currentScreen === "snacks" && (
            <motion.div
              key="snacks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <IssueSnacksScreen
                dailyBatches={dailyBatches}
                onBatchesChange={setDailyBatches}
              />
            </motion.div>
          )}

          {currentScreen === "inventory" && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <InventoryScreen
                dailyBatches={dailyBatches}
                onBatchesChange={setDailyBatches}
              />
            </motion.div>
          )}

          {currentScreen === "meals" && (
            <motion.div
              key="meals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <IssueMealsScreen canteenId={selectedCanteen?.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default CanteenInterface;
