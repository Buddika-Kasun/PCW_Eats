/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Issue Snacks (Dept Pass) screen. Extracted from CanteenInterface.tsx.
 * Owns its own dept-pass / snack-selection / recent-transactions state.
 */

import React, { useMemo, useState } from "react";
import {
  Search,
  QrCode,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Coffee,
  History,
  Sparkles,
  Box,
  ChevronDown,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import {
  MOCK_ITEMS,
  MOCK_USERS,
  DEPARTMENTS,
  MOCK_DEPT_BALANCES,
} from "../../constants";
import { DailyReadyMadeBatch } from "../../types";

interface IssueSnacksScreenProps {
  dailyBatches: DailyReadyMadeBatch[];
  onBatchesChange: React.Dispatch<React.SetStateAction<DailyReadyMadeBatch[]>>;
  onInventoryChange?: (itemName: string, qty: number) => void;
}

interface RecentSnackTx {
  id: string;
  time: string;
  dept: string;
  user: string;
  item: string;
  category: string;
  qty: number;
  cost: number;
}

const SEED_RECENT_SNACKS: RecentSnackTx[] = [
  {
    id: "tx-1",
    time: "10:15 AM",
    dept: "Production",
    user: "EMP001",
    item: "Vegetable Samosa",
    category: "ready-made",
    qty: 12,
    cost: 0,
  },
  {
    id: "tx-2",
    time: "10:02 AM",
    dept: "IT",
    user: "EMP003",
    item: "Ceylon Milk Tea",
    category: "stock-keeping",
    qty: 8,
    cost: 0,
  },
  {
    id: "tx-3",
    time: "09:48 AM",
    dept: "Quality",
    user: "EMP005",
    item: "Chicken Puff Pastry",
    category: "ready-made",
    qty: 6,
    cost: 0,
  },
  {
    id: "tx-4",
    time: "09:30 AM",
    dept: "Maintenance",
    user: "EMP002",
    item: "Fresh Coffee Pack",
    category: "stock-keeping",
    qty: 10,
    cost: 0,
  },
  {
    id: "tx-5",
    time: "09:12 AM",
    dept: "Stores",
    user: "EMP004",
    item: "Ulundu Vadai",
    category: "ready-made",
    qty: 15,
    cost: 0,
  },
];

export const IssueSnacksScreen: React.FC<IssueSnacksScreenProps> = ({
  dailyBatches,
  onBatchesChange,
  onInventoryChange,
}) => {
  const [deptPassId, setDeptPassId] = useState("");
  const [issuingUserId, setIssuingUserId] = useState("");
  const [foundDept, setFoundDept] = useState<string | null>(null);
  const [deptBalances, setDeptBalances] = useState(MOCK_DEPT_BALANCES);
  const [snackSelections, setSnackSelections] = useState<
    Record<string, number>
  >({});
  const [issueStatus, setIssueStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [issueErrorMessage, setIssueErrorMessage] = useState<string>("");
  const [recentSnacks, setRecentSnacks] =
    useState<RecentSnackTx[]>(SEED_RECENT_SNACKS);
  const [snackFilterCategory, setSnackFilterCategory] = useState<
    "all" | "ready-made" | "stock-keeping"
  >("all");

  const totalSelectedItems = useMemo(
    () =>
      Object.values(snackSelections).reduce(
        (a, b) => (a as number) + (b as number),
        0,
      ),
    [snackSelections],
  );

  const hasStockKeepingSelected = useMemo(() => {
    return Object.entries(snackSelections).some(([id, qty]) => {
      if ((qty as number) <= 0) return false;
      const it = MOCK_ITEMS.find((i) => i.id === id);
      return (it?.category || "stock-keeping") === "stock-keeping";
    });
  }, [snackSelections]);

  const hasReadyMadeSelected = useMemo(() => {
    return Object.entries(snackSelections).some(([id, qty]) => {
      if ((qty as number) <= 0) return false;
      const it = MOCK_ITEMS.find((i) => i.id === id);
      return it?.category === "ready-made";
    });
  }, [snackSelections]);

  const handleDeptScan = (explicitDept?: string) => {
    const deptToFind = explicitDept || deptPassId;
    const dept = deptToFind
      ? DEPARTMENTS.find((d) =>
          deptToFind.toUpperCase().includes(d.toUpperCase()),
        ) ||
        explicitDept ||
        "Production"
      : "Production";
    setFoundDept(dept);
    setDeptPassId(dept);
    const emp = MOCK_USERS.find(
      (u) => u.dept.toUpperCase() === dept.toUpperCase(),
    );
    setIssuingUserId(emp ? emp.id : `EMP-${dept.toUpperCase().slice(0, 4)}-01`);
  };

  const handleIssueSnack = () => {
    const selectedItems = Object.entries(snackSelections).filter(
      ([_, qty]) => (qty as number) > 0,
    );
    if (selectedItems.length === 0) {
      setIssueErrorMessage(
        "Please select at least 1 snack item using the (+) buttons.",
      );
      setIssueStatus("error");
      setTimeout(() => setIssueStatus("idle"), 3000);
      return;
    }

    const deptToUse = foundDept || "Production";
    if (!foundDept) {
      setFoundDept(deptToUse);
      setDeptPassId(deptToUse);
    }
    const userIdToUse =
      issuingUserId.trim() || `EMP-${deptToUse.toUpperCase().slice(0, 4)}-REP`;

    const newBalances = { ...deptBalances };
    if (!newBalances[deptToUse]) {
      newBalances[deptToUse] = {};
    }

    // Validate
    for (const [itemId, qty] of selectedItems) {
      const numQty = qty as number;
      const item = MOCK_ITEMS.find((i) => i.id === itemId);
      if (!item) continue;

      const isReadyMade = item.category === "ready-made";

      if (!isReadyMade) {
        const currentDeptBalance = newBalances[deptToUse]?.[itemId] ?? 25;
        if (currentDeptBalance < numQty) {
          setIssueErrorMessage(
            `Insufficient ${deptToUse} department quota for ${item.name} (${currentDeptBalance} remaining).`,
          );
          setIssueStatus("error");
          setTimeout(() => setIssueStatus("idle"), 3000);
          return;
        }
      } else {
        const batch = dailyBatches.find((b) => b.itemId === itemId);
        if (!batch) {
          setIssueErrorMessage(`${item.name} has not been delivered today.`);
          setIssueStatus("error");
          setTimeout(() => setIssueStatus("idle"), 3000);
          return;
        }
        if (batch.status === "cleared") {
          setIssueErrorMessage(
            `Today's batch of ${item.name} was cleared at end of day and cannot be issued.`,
          );
          setIssueStatus("error");
          setTimeout(() => setIssueStatus("idle"), 3000);
          return;
        }
        if (batch.remainingQty < numQty) {
          setIssueErrorMessage(
            `Only ${batch.remainingQty} fresh ${item.name} available in today's batch.`,
          );
          setIssueStatus("error");
          setTimeout(() => setIssueStatus("idle"), 3000);
          return;
        }
      }
    }

    const newRecentEntries: RecentSnackTx[] = [];

    selectedItems.forEach(([itemId, qty]) => {
      const item = MOCK_ITEMS.find((i) => i.id === itemId);
      if (!item) return;

      const numQty = qty as number;
      const isReadyMade = item.category === "ready-made";

      if (!isReadyMade) {
        newBalances[deptToUse] = {
          ...newBalances[deptToUse],
          [itemId]: Math.max(
            0,
            (newBalances[deptToUse]?.[itemId] ?? 25) - numQty,
          ),
        };
      }

      newRecentEntries.push({
        id: Math.random().toString(36).slice(2, 11),
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        dept: deptToUse,
        user: userIdToUse,
        item: item.name,
        category: item.category || "stock-keeping",
        qty: numQty,
        cost: item.price * numQty,
      });

      if (!isReadyMade) {
        onInventoryChange?.(item.name, numQty);
      }
    });

    setDeptBalances(newBalances);

    // Deduct from ready-made batches (parent state)
    onBatchesChange((prev) =>
      prev.map((batch) => {
        const selectedQty = (snackSelections[batch.itemId] as number) || 0;
        if (selectedQty > 0) {
          const newRemaining = Math.max(0, batch.remainingQty - selectedQty);
          return {
            ...batch,
            issuedQty: batch.issuedQty + selectedQty,
            remainingQty: newRemaining,
            status:
              newRemaining === 0
                ? "sold-out"
                : newRemaining < 10
                  ? "low"
                  : "available",
          };
        }
        return batch;
      }),
    );

    setRecentSnacks((prev) => [...newRecentEntries, ...prev].slice(0, 5));
    setIssueStatus("success");

    setTimeout(() => {
      setIssueStatus("idle");
      setSnackSelections({});
    }, 2000);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* QR Scan Section */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Scan Department Pass
              </label>
              <QrCode className="text-amber-500" size={20} />
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={24}
                />
                <input
                  type="text"
                  value={deptPassId}
                  onChange={(e) => setDeptPassId(e.target.value)}
                  placeholder="Scan QR or enter Dept..."
                  className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-xl font-bold focus:border-amber-400 outline-none transition-all"
                />
              </div>
              <button
                onClick={() => handleDeptScan()}
                className="px-8 bg-amber-400 text-slate-900 rounded-3xl font-black hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20 cursor-pointer"
              >
                Scan
              </button>
            </div>
          </div>

          {/* Quick Department Pass Dropdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="quick-pass-dropdown"
                className="text-xs font-bold text-slate-500 uppercase tracking-widest block"
              >
                Quick Pass Selection:
              </label>
              <span className="text-[11px] font-bold text-slate-400">
                Department Dropdown
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <QrCode
                  size={18}
                  className={foundDept ? "text-amber-500" : "text-slate-400"}
                />
              </div>
              <select
                id="quick-pass-dropdown"
                value={foundDept || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    handleDeptScan(val);
                  } else {
                    setFoundDept(null);
                    setDeptPassId("");
                    setIssuingUserId("");
                  }
                }}
                className="w-full pl-11 pr-11 py-3.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 focus:border-amber-400 focus:bg-white rounded-2xl text-sm font-black text-slate-900 appearance-none outline-none cursor-pointer transition-all shadow-sm"
              >
                <option value="">-- Select Department Pass --</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept} Department Pass
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          {foundDept ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-slate-900 text-white rounded-[2rem] space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-amber-400 text-slate-900 rounded-2xl flex items-center justify-center text-2xl font-black">
                    <QrCode size={32} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black">
                      {foundDept} Dept Pass
                    </h4>
                    <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs flex items-center gap-1">
                      <CheckCircle2 size={12} /> Active Quota Verified
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFoundDept(null);
                    setDeptPassId("");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Issuing For Employee
                </label>
                <input
                  type="text"
                  value={issuingUserId}
                  onChange={(e) => setIssuingUserId(e.target.value)}
                  placeholder="Enter Employee ID (e.g. EMP001)..."
                  className="w-full px-6 py-4 bg-slate-800 border-2 border-slate-700 rounded-2xl text-lg font-bold text-white focus:border-amber-400 outline-none transition-all"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {MOCK_USERS.filter(
                    (u) =>
                      u.dept.toUpperCase() === (foundDept || "").toUpperCase(),
                  ).map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setIssuingUserId(emp.id)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        issuingUserId === emp.id
                          ? "bg-amber-400 text-slate-900"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700",
                      )}
                    >
                      {emp.name} ({emp.id})
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="p-6 bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-[2rem] space-y-2 text-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto mb-1">
                <QrCode size={24} />
              </div>
              <h4 className="font-black text-slate-900 text-base">
                No Department Pass Selected
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Select a department pass from the dropdown above (or scan a
                pass) to link issuance to department quota.
              </p>
              <button
                type="button"
                onClick={() => handleDeptScan("Production")}
                className="mt-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl text-xs font-black transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <QrCode size={14} />
                <span>Select Production Pass</span>
              </button>
            </div>
          )}
        </div>

        {/* Item Selection Section */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-black text-slate-900 uppercase tracking-wider block">
                  Select Snacks & Quantities
                </label>
                <span className="text-xs text-slate-400">
                  Use (+) and (-) to set snack amounts
                </span>
              </div>
              {totalSelectedItems > 0 && (
                <button
                  onClick={() => setSnackSelections({})}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1 bg-rose-50 rounded-lg cursor-pointer"
                >
                  Clear All ({totalSelectedItems})
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setSnackFilterCategory("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  snackFilterCategory === "all"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                All Snacks
              </button>
              <button
                onClick={() => setSnackFilterCategory("ready-made")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  snackFilterCategory === "ready-made"
                    ? "bg-white text-amber-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Sparkles size={12} className="text-amber-500" />
                <span>Ready-Made</span>
              </button>
              <button
                onClick={() => setSnackFilterCategory("stock-keeping")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  snackFilterCategory === "stock-keeping"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Box size={12} className="text-blue-500" />
                <span>Stock-Keeping</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {MOCK_ITEMS.filter((item) => {
                if (snackFilterCategory === "ready-made")
                  return item.category === "ready-made";
                if (snackFilterCategory === "stock-keeping")
                  return (item.category || "stock-keeping") === "stock-keeping";
                return true;
              }).map((item) => {
                const isReadyMade = item.category === "ready-made";
                const deptRemainingQuota = foundDept
                  ? (deptBalances[foundDept]?.[item.id] ?? 25)
                  : 50;
                const selectedQty = snackSelections[item.id] || 0;

                const batch = isReadyMade
                  ? dailyBatches.find((b) => b.itemId === item.id)
                  : null;
                const freshRemaining = batch ? batch.remainingQty : 0;
                const isCleared = batch?.status === "cleared";
                const isPreparedToday = !!batch;

                const maxIssuable = isReadyMade
                  ? isPreparedToday && !isCleared
                    ? freshRemaining
                    : 0
                  : foundDept
                    ? deptRemainingQuota
                    : 50;

                const isDisabled =
                  isReadyMade &&
                  (!isPreparedToday || isCleared || freshRemaining === 0);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-4 rounded-2xl border-2 flex items-center justify-between transition-all",
                      selectedQty > 0
                        ? "bg-amber-50/70 border-amber-400"
                        : isDisabled
                          ? "bg-slate-50/60 border-slate-100 opacity-50"
                          : "bg-slate-50/60 border-slate-100 hover:border-slate-200",
                    )}
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-base text-slate-900">
                          {item.name}
                        </p>
                        {isReadyMade && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                            <Sparkles size={10} />
                            Fresh Today
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          LKR {item.price}
                        </span>

                        {!isReadyMade && foundDept && (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                              deptRemainingQuota < 10
                                ? "bg-rose-100 text-rose-700"
                                : "bg-blue-100 text-blue-800",
                            )}
                          >
                            Quota: {deptRemainingQuota} left
                          </span>
                        )}

                        {isReadyMade && (
                          <>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                              Ready-Made
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                isCleared
                                  ? "bg-rose-100 text-rose-700"
                                  : !isPreparedToday
                                    ? "bg-slate-200 text-slate-500"
                                    : freshRemaining < 10
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-emerald-100 text-emerald-700",
                              )}
                            >
                              {isCleared
                                ? "Cleared - End of Day"
                                : !isPreparedToday
                                  ? "Not Delivered Today"
                                  : `${freshRemaining} Fresh Left`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        disabled={selectedQty === 0}
                        onClick={() =>
                          setSnackSelections((prev) => ({
                            ...prev,
                            [item.id]: Math.max(0, selectedQty - 1),
                          }))
                        }
                        className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-lg font-black text-slate-900 w-6 text-center">
                        {selectedQty}
                      </span>
                      <button
                        disabled={isDisabled || selectedQty >= maxIssuable}
                        onClick={() =>
                          setSnackSelections((prev) => ({
                            ...prev,
                            [item.id]: selectedQty + 1,
                          }))
                        }
                        className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-100 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout */}
          <div className="pt-5 border-t-2 border-slate-100 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">
                  Total Items Selected
                </span>
                <span className="text-2xl font-black text-slate-900">
                  {totalSelectedItems}{" "}
                  {totalSelectedItems === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">
                  Billing Mode
                </span>
                <span
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-xl inline-block mt-0.5 border",
                    !hasStockKeepingSelected && hasReadyMadeSelected
                      ? "bg-amber-50 text-amber-900 border-amber-200"
                      : hasStockKeepingSelected && !hasReadyMadeSelected
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : hasStockKeepingSelected && hasReadyMadeSelected
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-slate-50 text-slate-600 border-slate-200",
                  )}
                >
                  {!hasStockKeepingSelected && hasReadyMadeSelected
                    ? "Ready-Made"
                    : hasStockKeepingSelected && !hasReadyMadeSelected
                      ? "Department Quota"
                      : hasStockKeepingSelected && hasReadyMadeSelected
                        ? "Quota + Ready-Made"
                        : "Department Quota"}
                </span>
              </div>
            </div>

            {issueStatus === "error" && issueErrorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0 text-rose-500" />
                <span>{issueErrorMessage}</span>
              </div>
            )}

            {issueStatus === "success" ? (
              <div className="w-full py-4 md:py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 bg-emerald-500 text-white shadow-xl shadow-emerald-500/25">
                <CheckCircle2 size={24} />
                <span>Snacks Issued Successfully!</span>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleIssueSnack}
                  disabled={issueStatus !== "idle"}
                  className={cn(
                    "w-full py-4 md:py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl cursor-pointer",
                    totalSelectedItems > 0 && foundDept
                      ? "bg-amber-400 text-slate-900 hover:bg-amber-500 shadow-amber-400/30 scale-[1.01]"
                      : totalSelectedItems > 0 && !foundDept
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20"
                        : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed",
                  )}
                >
                  <Coffee
                    size={22}
                    className={
                      totalSelectedItems > 0
                        ? foundDept
                          ? "text-slate-900"
                          : "text-amber-400"
                        : "text-slate-400"
                    }
                  />
                  <span>
                    {totalSelectedItems === 0
                      ? "Select Snacks Above Using (+)"
                      : !foundDept
                        ? `Issue ${totalSelectedItems} Snacks (Use Production Pass)`
                        : `Confirm & Issue ${totalSelectedItems} ${totalSelectedItems === 1 ? "Snack" : "Snacks"}`}
                  </span>
                </button>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-2">
                  <span>
                    Department:{" "}
                    <strong className="text-slate-700">
                      {foundDept || "None Selected"}
                    </strong>
                  </span>
                  <span>
                    Bearer:{" "}
                    <strong className="text-slate-700">
                      {issuingUserId ||
                        (foundDept
                          ? `EMP-${foundDept.slice(0, 3).toUpperCase()}-REP`
                          : "N/A")}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {recentSnacks.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <History size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Recent 5 Departments
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  Latest departmental pass issuances (Stock Quotas & Fresh Daily
                  Batches)
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
              Recent 5 Depts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Time
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Department
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Bearer / Rep
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Items Issued
                  </th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentSnacks.slice(0, 5).map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-4 text-sm font-bold text-slate-500 whitespace-nowrap">
                      {tx.time}
                    </td>
                    <td className="py-4 text-sm font-black text-slate-900 whitespace-nowrap">
                      <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-xl text-xs font-black inline-block">
                        {tx.dept}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-slate-600 font-mono whitespace-nowrap">
                      {tx.user}
                    </td>
                    <td className="py-4 text-sm font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>
                          {tx.qty}x {tx.item}
                        </span>
                        {tx.category === "ready-made" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Fresh Snack
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-sm text-right whitespace-nowrap">
                      {tx.category === "ready-made" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <Sparkles size={13} className="text-amber-600" />
                          Ready-Made
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2
                            size={13}
                            className="text-emerald-600"
                          />
                          Quota Deducted
                        </span>
                      )}
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
