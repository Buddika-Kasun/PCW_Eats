/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Utensils,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Meal } from "../types";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { formatAmPm, hhmmToAmPm } from "../lib/date";

const MealManagement: React.FC = () => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    cost: "", // string so leading zeros / decimals aren't stripped while typing
    eligibleFrom: "07:00",
    eligibleTo: "09:00",
  });

  // -------------------------------------------------------------------------
  // Load meals
  // -------------------------------------------------------------------------
  const loadMeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.meals.getAll();
      setMeals(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load meals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeals();
  }, []);

  // -------------------------------------------------------------------------
  // Modal handlers
  // -------------------------------------------------------------------------
  const handleOpenModal = (meal?: Meal) => {
    if (meal) {
      setEditingMeal(meal);
      setFormData({
        code: meal.code,
        name: meal.name,
        cost: String(meal.cost ?? ""),
        eligibleFrom: meal.eligibleFrom,
        eligibleTo: meal.eligibleTo,
      });
    } else {
      setEditingMeal(null);
      setFormData({
        code: `ML${String(meals.length + 1).padStart(3, "0")}`,
        name: "",
        cost: "",
        eligibleFrom: "07:00",
        eligibleTo: "09:00",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const costNum = Number(formData.cost);

    if (!formData.code.trim() || !formData.name.trim()) {
      setError("Meal code and name are required.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      setError("Cost must be a valid non-negative number.");
      setSaving(false);
      return;
    }
    if (formData.eligibleFrom >= formData.eligibleTo) {
      // Optional guard — allow overnight windows if you'd rather not block.
      // Comment this block out if 23:00–02:00 windows are legit for you.
      // setError("Eligible-to must be after eligible-from.");
      // setSaving(false);
      // return;
    }

    const payload = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      cost: costNum,
      eligibleFrom: formData.eligibleFrom,
      eligibleTo: formData.eligibleTo,
    } as Partial<Meal>;

    try {
      if (editingMeal) {
        const res = await api.meals.update(editingMeal.id, payload);
        setMeals((prev) =>
          prev.map((m) => (m.id === editingMeal.id ? res.data : m)),
        );
      } else {
        const res = await api.meals.create(payload);
        setMeals((prev) => [...prev, res.data]);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save meal");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this meal?")) return;
    setError(null);
    try {
      await api.meals.delete(id);
      setMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete meal");
    }
  };

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------
  const filteredMeals = meals.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Meal Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Define main meal types and their eligibility windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMeals}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-3 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : undefined}
            />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-400 text-slate-900 rounded-xl font-bold hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20 cursor-pointer"
          >
            <Plus size={20} />
            <span>Add New Meal</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Meal Code
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Time Range
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <Loader2
                      size={32}
                      className="mx-auto mb-3 animate-spin opacity-60"
                    />
                    <p>Loading meals…</p>
                  </td>
                </tr>
              )}

              {!loading &&
                filteredMeals.map((meal) => (
                  <tr
                    key={meal.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {meal.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {meal.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Clock size={14} className="text-amber-500" />
                        <span>
                          {hhmmToAmPm(meal.eligibleFrom)} -{" "}
                          {hhmmToAmPm(meal.eligibleTo)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      LKR {Number(meal.cost).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(meal)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(meal.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && filteredMeals.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <Utensils size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No meals found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingMeal ? "Edit Meal" : "Add New Meal"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Meal Code
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Meal Name
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    placeholder="e.g. Executive Lunch"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Eligible From
                    </label>
                    <input
                      required
                      type="time"
                      value={formData.eligibleFrom}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibleFrom: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Eligible To
                    </label>
                    <input
                      required
                      type="time"
                      value={formData.eligibleTo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibleTo: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Cost (LKR)
                  </label>
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    value={formData.cost}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) {
                        setFormData({ ...formData, cost: v });
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-amber-400 text-slate-900 rounded-xl font-bold hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save Meal"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MealManagement;
