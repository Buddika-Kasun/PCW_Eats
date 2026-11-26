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
  Building2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Canteen } from "../types";
import { CANTEEN_TYPES } from "../constants";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";

type CanteenType = "Main" | "Snack Bar" | "Executive";

const CanteenManagement: React.FC = () => {
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCanteen, setEditingCanteen] = useState<Canteen | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "Main" as CanteenType,
  });

  // -------------------------------------------------------------------------
  // Load canteens
  // -------------------------------------------------------------------------
  const loadCanteens = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.canteens.getAll();
      setCanteens(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load canteens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCanteens();
  }, []);

  // -------------------------------------------------------------------------
  // Modal handlers
  // -------------------------------------------------------------------------
  const handleOpenModal = (canteen?: Canteen) => {
    if (canteen) {
      setEditingCanteen(canteen);
      setFormData({
        code: canteen.code,
        name: canteen.name,
        type: canteen.type as CanteenType,
      });
    } else {
      setEditingCanteen(null);
      setFormData({
        code: `CAN${String(canteens.length + 1).padStart(3, "0")}`,
        name: "",
        type: "Main",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!formData.code.trim() || !formData.name.trim()) {
      setError("Code and name are required.");
      setSaving(false);
      return;
    }

    const payload = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      type: formData.type,
    };

    try {
      if (editingCanteen) {
        const res = await api.canteens.update(editingCanteen.id, payload);
        setCanteens((prev) =>
          prev.map((c) => (c.id === editingCanteen.id ? res.data : c)),
        );
      } else {
        const res = await api.canteens.create(payload);
        setCanteens((prev) => [...prev, res.data]);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save canteen");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this canteen?")) return;
    setError(null);
    try {
      await api.canteens.delete(id);
      setCanteens((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete canteen");
    }
  };

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------
  const filteredCanteens = canteens.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Canteen Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage physical canteen locations and their types.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCanteens}
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
            <span>Add New Canteen</span>
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
                  Canteen Code
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Type
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
                    colSpan={4}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <Loader2
                      size={32}
                      className="mx-auto mb-3 animate-spin opacity-60"
                    />
                    <p>Loading canteens…</p>
                  </td>
                </tr>
              )}

              {!loading &&
                filteredCanteens.map((canteen) => (
                  <tr
                    key={canteen.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {canteen.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {canteen.name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          canteen.type === "Main"
                            ? "bg-blue-50 text-blue-600"
                            : canteen.type === "Executive"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-emerald-50 text-emerald-600",
                        )}
                      >
                        {canteen.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(canteen)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(canteen.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && filteredCanteens.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <Building2 size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No canteens found matching your search.</p>
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
                  {editingCanteen ? "Edit Canteen" : "Add New Canteen"}
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
                    Canteen Code
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
                    Canteen Name
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    placeholder="e.g. West Wing Snack Bar"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Canteen Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as CanteenType,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  >
                    {CANTEEN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
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
                      "Save Canteen"
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

export default CanteenManagement;
