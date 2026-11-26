/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quota Management — single tab.
 * Left: list of quota cards (edit / delete).
 * Right: shared editor (create or edit).
 * Below: items table for the quota being edited/created.
 * Map tab stays as its own tab with recent mappings.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  ClipboardList,
  Save,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { Quota, DepartmentQuotaMap, Item, QuotaItem } from "../types";
import { api, Department } from "../lib/api";
import { motion } from "motion/react";

type Panel = "quotas" | "map";

interface EditorState {
  mode: "create" | "edit";
  id: string | null; // null for create
  code: string;
  items: QuotaItem[];
}

const emptyEditor: EditorState = {
  mode: "create",
  id: null,
  code: "",
  items: [],
};

const QuotaManagement: React.FC = () => {
  // ── Server state ───────────────────────────────────────────────────
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [deptMaps, setDeptMaps] = useState<DepartmentQuotaMap[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Panel ──────────────────────────────────────────────────────────
  const [panel, setPanel] = useState<Panel>("quotas");

  // ── Shared editor (create or edit) ────────────────────────────────
  const [editor, setEditor] = useState<EditorState | null>(null);

  // ── Map panel state ────────────────────────────────────────────────
  const [mapDeptId, setMapDeptId] = useState<number | "">("");
  const [mapQuotaId, setMapQuotaId] = useState("");

  // ── Mapping card edit ─────────────────────────────────────────────
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editMapDeptId, setEditMapDeptId] = useState<number | "">("");
  const [editMapQuotaId, setEditMapQuotaId] = useState("");
  const [editMapEffectiveFrom, setEditMapEffectiveFrom] = useState("");
  const [savingMap, setSavingMap] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────
  const stockKeepingItems = useMemo(
    () => items.filter((it) => it.category !== "ready-made"),
    [items],
  );

  const totalCost = useMemo(() => {
    if (!editor) return 0;
    return editor.items.reduce((sum, qi) => {
      const item = items.find((it) => it.id === qi.itemId);
      return sum + (item?.price || 0) * qi.eligibleQty;
    }, 0);
  }, [editor, items]);

  // ── Loaders ────────────────────────────────────────────────────────
  const loadQuotas = useCallback(async () => {
    const res = await api.quotas.getAll();
    setQuotas(res.data ?? []);
    setDeptMaps(res.mappings ?? []);
  }, []);

  const loadItems = useCallback(async () => {
    const res = await api.items.getAll("stock-keeping");
    setItems(res.data ?? []);
  }, []);

  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const list = await api.departments.getAll({ limit: 100 });
      setDepartments(list);
    } catch (e) {
      console.warn("Failed to load departments:", e);
      setDepartments([]);
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      try {
        await Promise.all([loadQuotas(), loadItems(), loadDepartments()]);
      } catch (e) {
        console.error("Failed to load quota data:", e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [loadQuotas, loadItems, loadDepartments]);

  // ── Editor actions ────────────────────────────────────────────────
  const startCreate = () => {
    setEditor({ ...emptyEditor });
  };

  const startEdit = (q: Quota) => {
    setEditor({
      mode: "edit",
      id: q.id,
      code: q.code,
      items: q.items.map((i) => ({ ...i })),
    });
  };

  const cancelEditor = () => setEditor(null);

  const updateEditorItem = (
    index: number,
    field: keyof QuotaItem,
    value: string | number,
  ) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      next[index] = { ...next[index], [field]: value } as QuotaItem;
      return { ...prev, items: next };
    });
  };

  const addEditorItem = () => {
    setEditor((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              { itemId: stockKeepingItems[0]?.id || "", eligibleQty: 1 },
            ],
          }
        : prev,
    );
  };

  const removeEditorItem = (index: number) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      next.splice(index, 1);
      return { ...prev, items: next };
    });
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (!editor.code.trim() || editor.items.length === 0) {
      alert("Please enter a quota code and add at least one item.");
      return;
    }
    setSaving(true);
    try {
      if (editor.mode === "create") {
        await api.quotas.create(editor.code.trim(), editor.items);
      } else if (editor.id) {
        await api.quotas.update(editor.id, {
          code: editor.code.trim(),
          items: editor.items,
        });
      }
      await loadQuotas();
      setEditor(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save quota");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuota = async (q: Quota) => {
    if (
      !confirm(
        `Remove quota "${q.code}"? Existing mappings will remain until removed separately.`,
      )
    ) {
      return;
    }
    try {
      await api.quotas.delete(q.id);
      await loadQuotas();
      if (editor?.id === q.id) setEditor(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete quota");
    }
  };

  // ── Map actions ────────────────────────────────────────────────────
  const handleMap = async () => {
    if (!mapDeptId || !mapQuotaId) {
      alert("Please select a department and a quota.");
      return;
    }
    setSaving(true);
    try {
      await api.quotas.mapDepartment(String(mapDeptId), mapQuotaId);
      await loadQuotas();
      setMapDeptId("");
      setMapQuotaId("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to map quota");
    } finally {
      setSaving(false);
    }
  };

  const startEditMap = (map: DepartmentQuotaMap) => {
    setEditingMapId(map.id);
    setEditMapDeptId(map.department !== "" ? Number(map.department) : "");
    setEditMapQuotaId(map.quotaId);
    setEditMapEffectiveFrom(map.effectiveFrom);
  };

  const cancelEditMap = () => {
    setEditingMapId(null);
    setEditMapDeptId("");
    setEditMapQuotaId("");
    setEditMapEffectiveFrom("");
  };

  const saveEditMap = async () => {
    if (!editingMapId) return;
    if (!editMapDeptId || !editMapQuotaId) {
      alert("Please choose a department and quota.");
      return;
    }
    setSavingMap(true);
    try {
      await api.quotas.updateMapping(editingMapId, {
        department: String(editMapDeptId),
        quotaId: editMapQuotaId,
        effectiveFrom: editMapEffectiveFrom || undefined,
      });
      await loadQuotas();
      cancelEditMap();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update mapping");
    } finally {
      setSavingMap(false);
    }
  };

  const deleteMap = async (map: DepartmentQuotaMap) => {
    const quotaCode =
      quotas.find((q) => q.id === map.quotaId)?.code ?? map.quotaId;
    if (
      !confirm(
        `Remove mapping: ${departmentLabel(map.department)} → ${quotaCode}?`,
      )
    ) {
      return;
    }
    try {
      await api.quotas.deleteMapping(map.id);
      await loadQuotas();
      if (editingMapId === map.id) cancelEditMap();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete mapping");
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const departmentLabel = (deptId: string) => {
    const id = Number(deptId);
    const d = departments.find((x) => Number(x.id) === id);
    return d?.name ?? `Dept #${deptId}`;
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Quota Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Create, edit, and map daily snack quotas to departments.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 shadow-sm">
        <div className="p-2 bg-blue-100 rounded-xl text-blue-800 shrink-0">
          <ClipboardList size={18} />
        </div>
        <div className="space-y-0.5">
          <p className="font-black text-blue-900">Department Quota Policy</p>
          <p className="text-blue-800">
            Quotas apply strictly to <strong>Stock-Keeping inventory</strong>.{" "}
            <span className="font-semibold text-blue-950">
              Ready-made daily snacks are NOT mapped to quotas.
            </span>
          </p>
        </div>
      </div>

      {/* Two tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {(
          [
            ["quotas", "Quotas"],
            ["map", "Map Quota"],
          ] as [Panel, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPanel(key)}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
              panel === key
                ? "bg-white text-slate-900 shadow"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── QUOTAS TAB ─────────────────────────────────────────────── */}
      {panel === "quotas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quota list */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Quotas</h3>
              <button
                type="button"
                onClick={startCreate}
                className="flex items-center gap-2 px-3 py-2 bg-amber-400 text-slate-900 rounded-xl text-sm font-bold hover:bg-amber-500 transition-all"
              >
                <Plus size={16} />
                New Quota
              </button>
            </div>

            {loadingData && quotas.length === 0 && (
              <div className="p-4 bg-white border border-slate-100 rounded-2xl text-sm text-slate-500 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            )}

            {!loadingData && quotas.length === 0 && (
              <div className="p-4 bg-white border border-slate-100 rounded-2xl text-sm text-slate-500 text-center">
                No quotas yet. Click "New Quota" to create one.
              </div>
            )}

            {quotas.map((q) => {
              const isEditing = editor?.id === q.id && editor.mode === "edit";
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white p-4 rounded-2xl border shadow-sm transition-colors ${
                    isEditing
                      ? "border-2 border-amber-300"
                      : "border-slate-100 hover:border-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Code
                      </p>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {q.code}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {q.items.length} item{q.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => startEdit(q)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteQuota(q)}
                      className="px-2 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Editor */}
          <div className="lg:col-span-2 space-y-4">
            {!editor && (
              <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center text-sm text-slate-500">
                Select a quota to edit, or click "New Quota" to create one.
              </div>
            )}

            {editor && (
              <>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {editor.mode === "create" ? "New Quota" : "Editing"}
                      </p>
                      <h3 className="text-lg font-black text-slate-900">
                        {editor.mode === "create"
                          ? "Create Quota"
                          : editor.code || "—"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={cancelEditor}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      title="Close editor"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Quota Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STD-STOCK"
                      value={editor.code}
                      onChange={(e) =>
                        setEditor({ ...editor, code: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEditor}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEditor()}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Saving…
                        </>
                      ) : (
                        <>
                          <Save size={16} />{" "}
                          {editor.mode === "create"
                            ? "Save Quota"
                            : "Update Quota"}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Items table */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <ClipboardList size={20} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Quota Items
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={addEditorItem}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-400 text-slate-900 rounded-xl text-sm font-bold hover:bg-amber-500 transition-all"
                    >
                      <Plus size={16} /> Add Item
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            Item
                          </th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            UOM
                          </th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            Qty
                          </th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            Unit Cost
                          </th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            Total
                          </th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {editor.items.map((qi, idx) => {
                          const item = items.find((it) => it.id === qi.itemId);
                          return (
                            <tr key={idx}>
                              <td className="px-6 py-3">
                                <select
                                  value={qi.itemId}
                                  onChange={(e) =>
                                    updateEditorItem(
                                      idx,
                                      "itemId",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full min-w-30 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                  {stockKeepingItems.map((it) => (
                                    <option key={it.id} value={it.id}>
                                      {it.name} ({it.code})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-3">
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                  {item?.uom}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={qi.eligibleQty}
                                  onChange={(e) =>
                                    updateEditorItem(
                                      idx,
                                      "eligibleQty",
                                      parseInt(e.target.value),
                                    )
                                  }
                                  className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                />
                              </td>
                              <td className="px-6 py-3 text-sm font-medium text-slate-500">
                                LKR {(item?.price ?? 0).toLocaleString()}
                              </td>
                              <td className="px-6 py-3 text-sm font-bold text-slate-900">
                                LKR{" "}
                                {(
                                  (Number(item?.price) || 0) *
                                    (Number(qi?.eligibleQty) || 0) || 0
                                ).toLocaleString()}
                              </td>
                              <td className="px-6 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeEditorItem(idx)}
                                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {editor.items.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-6 py-10 text-center text-slate-400 text-sm"
                            >
                              No items yet. Click "Add Item" to start.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">
                        Items:{" "}
                        <strong className="text-slate-900">
                          {editor.items.length}
                        </strong>
                      </span>
                      <span className="text-slate-500">
                        Total:{" "}
                        <strong className="text-amber-600">
                          LKR {totalCost.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MAP TAB ────────────────────────────────────────────────── */}
      {panel === "map" && (
        <>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Department
                </label>
                <select
                  value={mapDeptId}
                  onChange={(e) =>
                    setMapDeptId(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  disabled={loadingDepts}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all disabled:opacity-60"
                >
                  <option value="">
                    {loadingDepts
                      ? "Loading departments…"
                      : "Select Department..."}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Quota
                </label>
                <select
                  value={mapQuotaId}
                  onChange={(e) => setMapQuotaId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                >
                  <option value="">Select Existing Quota...</option>
                  {quotas.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleMap()}
                disabled={saving || loadingData}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Mapping…
                  </>
                ) : (
                  <>
                    <Save size={18} /> Map Quota
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recent mappings */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 px-2">
              Recent Quota Mappings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {deptMaps
                .slice(-8)
                .reverse()
                .map((map) => {
                  const quota = quotas.find((q) => q.id === map.quotaId);
                  const isEditing = editingMapId === map.id;

                  if (isEditing) {
                    return (
                      <motion.div
                        key={map.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-4 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3"
                      >
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Department
                          </label>
                          <select
                            value={editMapDeptId}
                            onChange={(e) =>
                              setEditMapDeptId(
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                              )
                            }
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="">Select…</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Quota
                          </label>
                          <select
                            value={editMapQuotaId}
                            onChange={(e) => setEditMapQuotaId(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="">Select…</option>
                            {quotas.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.code}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Effective From
                          </label>
                          <input
                            type="date"
                            value={editMapEffectiveFrom}
                            onChange={(e) =>
                              setEditMapEffectiveFrom(e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={cancelEditMap}
                            className="flex-1 px-2 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveEditMap()}
                            disabled={savingMap}
                            className="flex-1 px-2 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-1"
                          >
                            {savingMap ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={map.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider">
                          {departmentLabel(map.department)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {map.effectiveFrom}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mb-3">
                        {quota?.code || "Unknown"}
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditMap(map)}
                          className="flex-1 px-2 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteMap(map)}
                          className="px-2 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              {deptMaps.length === 0 && (
                <div className="col-span-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 text-center">
                  No quota mappings yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default QuotaManagement;
