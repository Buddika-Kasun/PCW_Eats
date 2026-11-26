/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Inventory & Ready-Made Batches screen — fully API backed.
 * - Stock-keeping dropdown excludes already-tracked inventory items.
 * - Selected inventory row supports inline stock/minLevel editing + quick +50 restock.
 * - Ready-made batches are fetched from /api/batches on mount and after every mutation.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Sparkles,
  Calendar,
  Coffee,
  Clock,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
  Save,
  Package,
  ShieldAlert,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { api, InventoryRecord } from "../../lib/api";
import { Item, DailyReadyMadeBatch } from "../../types";

interface InventoryScreenProps {
  dailyBatches: DailyReadyMadeBatch[];
  onBatchesChange: React.Dispatch<React.SetStateAction<DailyReadyMadeBatch[]>>;
  initialTab?: "stock-keeping" | "ready-made";
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  dailyBatches,
  onBatchesChange,
  initialTab = "stock-keeping",
}) => {
  // ----- State ----------------------------------------------------------
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedInventoryItem, setSelectedInventoryItem] =
    useState<InventoryRecord | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    itemId: "",
    stock: 0,
    minLevel: 10,
  });

  // Editable stock / minLevel for the selected item
  const [editStock, setEditStock] = useState<number>(0);
  const [editMinLevel, setEditMinLevel] = useState<number>(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const [inventoryTab, setInventoryTab] = useState<
    "stock-keeping" | "ready-made"
  >(initialTab);

  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  
  const getNowTimeString = () =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }); // e.g. "02:37 PM"

  const [newBatchData, setNewBatchData] = useState({
    itemId: "",
    receivedQty: 50,
    deliveryTime: getNowTimeString(),
  });

  // ----- Data loading ---------------------------------------------------
  const refreshInventory = async () => {
    const res = await api.inventory.getAll();
    setInventory(res.data);
    return res.data;
  };

  const refreshBatches = async () => {
    const res = await api.batches.getAll();
    onBatchesChange(res.data);
    return res.data;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [invRes, itemsRes, batchesRes] = await Promise.all([
          api.inventory.getAll(),
          api.items.getAll(),
          api.batches.getAll(),
        ]);
        if (cancelled) return;

        setInventory(invRes.data);
        setItems(itemsRes.data);
        onBatchesChange(batchesRes.data);

        const firstReady = itemsRes.data.find(
          (i) => i.category === "ready-made",
        );
        if (firstReady) {
          setNewBatchData((p) => ({ ...p, itemId: firstReady.id }));
        }
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep edit fields in sync when a different row is selected
  useEffect(() => {
    if (selectedInventoryItem) {
      setEditStock(selectedInventoryItem.stock);
      setEditMinLevel(selectedInventoryItem.minLevel);
    }
  }, [selectedInventoryItem]);

  // ----- Derived dropdown lists ----------------------------------------
  const trackedItemIds = useMemo(
    () => new Set(inventory.map((i) => i.itemId)),
    [inventory],
  );

  const readyMadeItems = useMemo(
    () => items.filter((i) => i.category === "ready-made"),
    [items],
  );

  const stockKeepingItemsAvailable = useMemo(
    () =>
      items.filter(
        (i) =>
          (i.category || "stock-keeping") === "stock-keeping" &&
          !trackedItemIds.has(i.id),
      ),
    [items, trackedItemIds],
  );

  // ----- Stock-keeping actions -----------------------------------------
  const handleAddItem = async () => {
    if (!newItem.itemId) return;
    try {
      await api.inventory.create({
        itemId: newItem.itemId,
        stock: newItem.stock,
        minLevel: newItem.minLevel,
      });
      await refreshInventory();
      setShowAddItem(false);
      setNewItem({ itemId: "", stock: 0, minLevel: 10 });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSaveEdits = async () => {
    if (!selectedInventoryItem) return;
    try {
      setSavingEdit(true);
      const res = await api.inventory.adjust({
        itemId: selectedInventoryItem.itemId,
        adjustmentQty: editStock - selectedInventoryItem.stock,
        minLevel: editMinLevel,
      });
      setInventory((prev) =>
        prev.map((it) => (it.id === selectedInventoryItem.id ? res.data : it)),
      );
      setSelectedInventoryItem(res.data);
      setEditStock(res.data.stock);
      setEditMinLevel(res.data.minLevel);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleQuickRestock = async () => {
    if (!selectedInventoryItem) return;
    try {
      const res = await api.inventory.adjust({
        itemId: selectedInventoryItem.itemId,
        adjustmentQty: 50,
      });
      setInventory((prev) =>
        prev.map((it) => (it.id === selectedInventoryItem.id ? res.data : it)),
      );
      setSelectedInventoryItem(res.data);
      setEditStock(res.data.stock);
      setEditMinLevel(res.data.minLevel);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ----- Ready-made batch actions --------------------------------------
  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchData.itemId) return;
    try {
      await api.batches.create({
        itemId: newBatchData.itemId,
        receivedQty: Number(newBatchData.receivedQty),
        deliveryTime: newBatchData.deliveryTime,
      });
      await refreshBatches();
      setShowAddBatchModal(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleEndOfDayClearance = async () => {
    try {
      await api.batches.clearance();
      await refreshBatches();
      setShowClearanceModal(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleResetBatches = async () => {
    try {
      const res = await api.batches.reset();
      onBatchesChange(res.data);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ----- Computed -------------------------------------------------------
  const totalReceivedToday = useMemo(
    () => dailyBatches.reduce((acc, b) => acc + b.receivedQty, 0),
    [dailyBatches],
  );
  const totalIssuedToday = useMemo(
    () => dailyBatches.reduce((acc, b) => acc + b.issuedQty, 0),
    [dailyBatches],
  );
  const totalRemainingToday = useMemo(
    () => dailyBatches.reduce((acc, b) => acc + b.remainingQty, 0),
    [dailyBatches],
  );
  const isAllCleared = useMemo(
    () =>
      dailyBatches.length > 0 &&
      dailyBatches.every((b) => b.status === "cleared"),
    [dailyBatches],
  );

  // ----- Render ---------------------------------------------------------
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900">
            Inventory & Daily Snacks
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Manage perpetual stock-keeping warehouse items and fresh daily
            bakery batches.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setInventoryTab("stock-keeping")}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer",
              inventoryTab === "stock-keeping"
                ? "bg-white text-blue-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Box size={16} className="text-blue-600" />
            <span>Stock-Keeping Items</span>
          </button>
          <button
            onClick={() => setInventoryTab("ready-made")}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer",
              inventoryTab === "ready-made"
                ? "bg-white text-amber-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Sparkles size={16} className="text-amber-600" />
            <span>Today's Ready-Made Snacks</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-700 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tab 1: Stock-Keeping Inventory */}
      {inventoryTab === "stock-keeping" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                Perpetual Stock Inventory
              </h4>
              <p className="text-xs text-slate-500">
                Items with long shelf life (Tea, Coffee, Packaged Biscuits,
                Sugar) kept in stores.
              </p>
            </div>
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-slate-900 rounded-xl font-black hover:bg-amber-500 transition-all shadow-md shadow-amber-400/20 text-xs cursor-pointer"
            >
              <Plus size={18} />
              <span>Add Stock Item</span>
            </button>
          </div>

          {showAddItem && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-white p-8 rounded-[2.5rem] border-2 border-amber-400 shadow-xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-black text-slate-900">
                  Add Stock-Keeping Item to Inventory
                </h4>
                <button
                  onClick={() => setShowAddItem(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <Minus size={24} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Select Item
                  </label>
                  <select
                    value={newItem.itemId}
                    onChange={(e) =>
                      setNewItem({ ...newItem, itemId: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-amber-400"
                  >
                    <option value="">
                      {stockKeepingItemsAvailable.length === 0
                        ? "All stock-keeping items are already tracked"
                        : "Choose a stock-keeping item..."}
                    </option>
                    {stockKeepingItemsAvailable.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    value={newItem.stock}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        stock: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Min Reorder Level
                  </label>
                  <input
                    type="number"
                    value={newItem.minLevel}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        minLevel: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddItem}
                  disabled={!newItem.itemId}
                  className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 disabled:opacity-40 transition-all text-sm cursor-pointer"
                >
                  <Save size={18} />
                  <span>Save Stock Record</span>
                </button>
              </div>
            </motion.div>
          )}

          <div className="bg-white rounded-4xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Item Name
                    </th>
                    <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      UOM
                    </th>
                    <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Stock Level
                    </th>
                    <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Min Level
                    </th>
                    <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-8 py-10 text-center text-sm font-bold text-slate-400"
                      >
                        Loading inventory...
                      </td>
                    </tr>
                  ) : inventory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-8 py-10 text-center text-sm font-bold text-slate-400"
                      >
                        No inventory records yet. Add a stock item to get
                        started.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedInventoryItem(item)}
                        className={cn(
                          "hover:bg-slate-50 cursor-pointer transition-colors group",
                          selectedInventoryItem?.id === item.id
                            ? "bg-amber-50/50"
                            : "",
                        )}
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                              <Box size={20} />
                            </div>
                            <span className="font-black text-slate-900">
                              {item.item}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-slate-500">
                          {item.uom}
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xl font-black text-slate-900 font-mono">
                            {item.stock}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-slate-500 font-mono">
                          {item.minLevel}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                              item.status === "Low"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-emerald-50 text-emerald-600",
                            )}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedInventoryItem && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 text-white p-6 md:p-8 rounded-4xl space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-amber-400">
                    <Package size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black">
                      {selectedInventoryItem.item}
                    </h4>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                      Current Stock: {selectedInventoryItem.stock}{" "}
                      {selectedInventoryItem.uom}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleQuickRestock}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    +50 Quick Restock
                  </button>
                  <button
                    onClick={() => setSelectedInventoryItem(null)}
                    className="px-5 py-2.5 bg-amber-400 text-slate-900 hover:bg-amber-500 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>

              {/* Editable stock + min level */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Edit Stock
                  </label>
                  <input
                    type="number"
                    value={editStock}
                    onChange={(e) =>
                      setEditStock(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono font-bold text-sm text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Edit Min Level
                  </label>
                  <input
                    type="number"
                    value={editMinLevel}
                    onChange={(e) =>
                      setEditMinLevel(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono font-bold text-sm text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSaveEdits}
                    disabled={
                      savingEdit ||
                      (editStock === selectedInventoryItem.stock &&
                        editMinLevel === selectedInventoryItem.minLevel)
                    }
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 text-slate-900 hover:bg-amber-500 disabled:opacity-40 rounded-xl font-black text-xs transition-all cursor-pointer"
                  >
                    <Save size={16} />
                    <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Tab 2: Today's Ready-Made Snacks */}
      {inventoryTab === "ready-made" && (
        <div className="space-y-6">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-4xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 bg-amber-400 text-slate-900 rounded-2xl flex items-center justify-center shrink-0 shadow-md">
                <ShieldAlert size={24} />
              </div>

              <div className="space-y-1 min-w-0">
                <h4 className="text-lg font-black text-slate-900">
                  Zero-Overnight Carryover Policy
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  Ready-made snacks (Fish Buns, Fish Rolls, Vegetable Pastries)
                  are prepared fresh for <strong>today only</strong> and{" "}
                  <strong>CANNOT</strong> be rolled over to the next day. Log
                  batches when received each morning, and run the{" "}
                  <strong>End-of-Day Clearance</strong> before closing.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 w-full md:w-auto md:shrink-0">
              <button
                onClick={() => setShowAddBatchModal(true)}
                className="flex-1 md:flex-none basis-[calc(50%-0.375rem)] md:basis-auto md:w-52 flex items-center justify-center gap-2 px-5 py-3 bg-amber-400 text-slate-900 rounded-xl font-black hover:bg-amber-500 transition-all shadow-md shadow-amber-400/20 text-xs cursor-pointer"
              >
                <Plus size={18} className="shrink-0" />
                <span className="whitespace-nowrap">
                  Log Today's Fresh Delivery
                </span>
              </button>

              <button
                onClick={() => setShowClearanceModal(true)}
                disabled={isAllCleared || totalRemainingToday === 0}
                className="flex-1 md:flex-none basis-[calc(50%-0.375rem)] md:basis-auto md:w-52 flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 disabled:opacity-40 transition-all shadow-md text-xs cursor-pointer"
                title="Clear all unsold ready-made snacks with zero rollover"
              >
                <AlertTriangle size={18} className="shrink-0" />
                <span className="whitespace-nowrap">End-of-Day Clearance</span>
              </button>

              {/* <button
                onClick={handleResetBatches}
                className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Reset Today's Batches"
              >
                <RotateCcw size={16} />
              </button> */}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Received Today
                </span>
                <Calendar size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-slate-900 font-mono">
                {totalReceivedToday}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Total prepared / delivered
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Issued to Staff
                </span>
                <Coffee size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-slate-900 font-mono">
                {totalIssuedToday}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Deducted from dept quotas
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Fresh Remaining
                </span>
                <Sparkles size={16} className="text-emerald-500" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-emerald-600 font-mono">
                {totalRemainingToday}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Available for issue today
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Clearance Status
                </span>
                <Clock size={16} className="text-purple-500" />
              </div>
              <div className="mt-1">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-block",
                    isAllCleared
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {isAllCleared ? "Cleared at Closing" : "Active Issuing"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {isAllCleared
                  ? "Zero units carried over"
                  : "Open for staff issuance"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-4xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Snack Item
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Delivery / Prep
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Received
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Issued
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Remaining Fresh
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Unit Cost
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                      Batch Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dailyBatches.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-sm font-bold text-slate-400"
                      >
                        No batches logged today. Log a fresh delivery to get
                        started.
                      </td>
                    </tr>
                  ) : (
                    dailyBatches.map((batch) => (
                      <tr
                        key={batch.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                              <Sparkles size={18} />
                            </div>
                            <div>
                              <span className="font-black text-slate-900 block">
                                {batch.itemName}
                              </span>
                              <span className="text-[11px] text-slate-400 font-bold uppercase">
                                Ready-Made (Daily)
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-600 font-mono">
                          <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-slate-400" />
                            <span>{batch.deliveryTime}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-800">
                          {batch.receivedQty}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-amber-600">
                          {batch.issuedQty}
                        </td>
                        <td className="px-6 py-4 font-mono font-black text-slate-900 text-lg">
                          {batch.remainingQty}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-700">
                          LKR {batch.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1",
                              batch.status === "cleared"
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : batch.status === "sold-out"
                                  ? "bg-slate-200 text-slate-700"
                                  : batch.status === "low"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-emerald-100 text-emerald-800",
                            )}
                          >
                            {batch.status === "cleared"
                              ? "Cleared (0 Rollover)"
                              : batch.status === "sold-out"
                                ? "Sold Out"
                                : batch.status === "low"
                                  ? "Low Stock"
                                  : "Fresh & Available"}
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
      )}

      {/* Modal: Log Today's Fresh Delivery Batch */}
      <AnimatePresence>
        {showAddBatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddBatchModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center text-slate-900">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Log Today's Fresh Delivery
                    </h3>
                    <p className="text-xs text-slate-500">
                      Record fresh bakery snacks delivered for today only
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddBatchModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddBatch} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ready-Made Item
                  </label>
                  <select
                    value={newBatchData.itemId}
                    onChange={(e) =>
                      setNewBatchData({
                        ...newBatchData,
                        itemId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {readyMadeItems.length === 0 ? (
                      <option value="">No ready-made items available</option>
                    ) : (
                      readyMadeItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code}) — LKR {item.price}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Quantity Delivered
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newBatchData.receivedQty}
                      onChange={(e) =>
                        setNewBatchData({
                          ...newBatchData,
                          receivedQty: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Delivery Time
                    </label>
                    <input
                      type="text"
                      value={newBatchData.deliveryTime}
                      onChange={(e) =>
                        setNewBatchData({
                          ...newBatchData,
                          deliveryTime: e.target.value,
                        })
                      }
                      placeholder="e.g. 07:30 AM"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-tight">
                  ℹ️ Items added here are tracked as today's fresh batch. At
                  closing time, running End-of-Day Clearance ensures unsold
                  snacks are not rolled over into tomorrow.
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddBatchModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-amber-400 text-slate-900 rounded-xl font-black hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20 text-sm cursor-pointer"
                  >
                    Record Fresh Batch
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: End-of-Day Clearance */}
      <AnimatePresence>
        {showClearanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearanceModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <AlertTriangle size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900">
                  Run End-of-Day Clearance?
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  This will zero out all remaining unsold ready-made snacks (
                  {totalRemainingToday} units) and mark today's batches as
                  cleared.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl text-xs text-left space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Unsold Ready-Made Units:
                  </span>
                  <span className="font-bold text-rose-600">
                    {totalRemainingToday} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Overnight Rollover Policy:
                  </span>
                  <span className="font-bold text-slate-900">
                    Zero (Cannot be kept for tomorrow)
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowClearanceModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEndOfDayClearance}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 transition-all shadow-lg text-sm cursor-pointer"
                >
                  Confirm Clearance
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
