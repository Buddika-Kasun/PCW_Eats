/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Special Orders list, create modal, edit + delete + receipt view.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  X,
  Loader2,
  Trash2,
  Pencil,
  Receipt,
  ArrowLeft,
  ShoppingBag,
  Download,
  QrCode,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "qrcode";
import { cn } from "../lib/utils";
import { getCachedUser } from "../lib/auth";
import { api, SpecialOrder } from "../lib/api";
import { Meal } from "../types";

type ModalMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; order: SpecialOrder }
  | { kind: "receipt"; order: SpecialOrder };

interface Props {
  onBack: () => void;
  autoCreate?: boolean;
}

/* -------------------------------------------------------------------------- */
/* QR helper — renders to a canvas and lets you download the data-URL as PNG. */
/* -------------------------------------------------------------------------- */
const OrderQr: React.FC<{ value: string; orderNo: string }> = ({
  value,
  orderNo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(() => {
        setDataUrl(canvasRef.current!.toDataURL("image/png"));
      })
      .catch((e) => console.error("QR generation failed:", e));
  }, [value]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `order-${orderNo}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <canvas ref={canvasRef} className="block" />
      </div>
      <p className="text-[10px] font-mono font-bold text-slate-500">{value}</p>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!dataUrl}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg cursor-pointer"
      >
        <Download size={13} />
        Download QR
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */

const SpecialOrdersScreen: React.FC<Props> = ({ onBack, autoCreate }) => {
  const cached = getCachedUser();
  const userId =
    cached?.id != null ? String(cached.id === 1000 ? "999999" : cached.id) : "";
  const userName =
    cached?.displayname?.trim() || cached?.username?.trim() || "User";

  const [orders, setOrders] = useState<SpecialOrder[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>({ kind: "closed" });

  // count stored as string so the input can be empty without becoming NaN
  const [form, setForm] = useState({
    mealId: "",
    count: "1",
    purpose: "",
  });
  const [submitting, setSubmitting] = useState(false);

  /* ------------------------------------------------------------------ */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, mealsRes] = await Promise.all([
        api.specialOrders.list({ userId }),
        api.meals.getAll(),
      ]);
      setOrders(ordersRes.data ?? []);
      setMeals(mealsRes.data ?? []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------------------ */
  const openCreate = useCallback(() => {
    setForm({
      mealId: meals[0]?.id ?? "",
      count: "1",
      purpose: "",
    });
    setModal({ kind: "create" });
  }, [meals]);

  const openEdit = (o: SpecialOrder) => {
    setForm({
      mealId: o.mealId,
      count: String(o.count),
      purpose: o.purpose,
    });
    setModal({ kind: "edit", order: o });
  };

  useEffect(() => {
    if (autoCreate && meals.length > 0 && modal.kind === "closed") {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, meals.length]);

  /* ------------------------------------------------------------------ */
  const handleSubmit = async () => {
    const parsedCount = parseInt(form.count, 10);
    if (!form.mealId) {
      setError("Please pick a meal.");
      return;
    }
    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      setError("Count must be at least 1.");
      return;
    }
    if (form.purpose.trim().length < 3) {
      setError("Please provide a purpose (min 3 chars).");
      return;
    }

    const departmentId = String(
      cached?.deptId ?? cached?.dept ?? "unknown-dept",
    );
    const departmentName = String(cached?.dept ?? "Unknown");
    const requesterId = userId || "unknown-user";

    try {
      setSubmitting(true);
      if (modal.kind === "create") {
        const res = await api.specialOrders.create({
          requesterId,
          requesterName: userName,
          departmentId,
          departmentName,
          mealId: form.mealId,
          count: parsedCount,
          purpose: form.purpose.trim(),
        });
        await load();
        setModal({ kind: "receipt", order: res.data });
      } else if (modal.kind === "edit") {
        const res = await api.specialOrders.update(modal.order.id, {
          mealId: form.mealId,
          count: parsedCount,
          purpose: form.purpose.trim(),
          updatedBy: requesterId,
        });
        await load();
        setModal({ kind: "receipt", order: res.data });
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  const handleDelete = async (o: SpecialOrder) => {
    if (!window.confirm(`Delete order ${o.orderNo}?`)) return;
    try {
      await api.specialOrders.remove(o.id, userId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    }
  };

  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              Special Orders
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Bulk meal requests for guests, trainings, and meetings.
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus size={16} />
          <span>New Order</span>
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="cursor-pointer text-rose-400 hover:text-rose-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                {[
                  "Order No",
                  "Meal",
                  "Count",
                  "Purpose",
                  "Guest Range",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    <Loader2 className="animate-spin inline mr-2" size={16} />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    <ShoppingBag
                      size={24}
                      className="mx-auto mb-2 text-slate-200"
                    />
                    No special orders yet.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 text-sm">
                    {o.orderNo}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {o.mealName}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-slate-900">
                    {o.count}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                    {o.purpose}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-700">
                    {o.guestRangeStart && o.guestRangeEnd
                      ? `${o.guestRangeStart} – ${o.guestRangeEnd}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal({ kind: "receipt", order: o })}
                        title="View receipt"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 cursor-pointer"
                      >
                        <Receipt size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(o)}
                        title="Edit"
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(o)}
                        title="Delete"
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal.kind !== "closed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={() => setModal({ kind: "closed" })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg md:max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* ==== Create / Edit form ==== */}
              {(modal.kind === "create" || modal.kind === "edit") && (
                <>
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900">
                      {modal.kind === "create"
                        ? "New Special Order"
                        : `Edit ${modal.order.orderNo}`}
                    </h3>
                    <button
                      onClick={() => setModal({ kind: "closed" })}
                      className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* meal */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Meal
                      </label>
                      <select
                        value={form.mealId}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, mealId: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="">Select meal…</option>
                        {meals.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — LKR {m.cost}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* count — string state */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Guest Count
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={form.count}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, count: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <p className="text-[11px] text-slate-500">
                        {Number(form.count) || 0} guest user ID
                        {(Number(form.count) || 0) > 1 ? "s" : ""} will be
                        assigned (e.g. S1, S2, …)
                      </p>
                    </div>
                    {/* purpose */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Purpose
                      </label>
                      <textarea
                        rows={3}
                        value={form.purpose}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, purpose: e.target.value }))
                        }
                        placeholder="e.g. Quarterly review lunch for external auditors"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                      />
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        onClick={() => setModal({ kind: "closed" })}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-2.5 bg-amber-400 text-slate-900 rounded-xl font-black hover:bg-amber-500 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {submitting && (
                          <Loader2 size={16} className="animate-spin" />
                        )}
                        {modal.kind === "create"
                          ? "Create Order"
                          : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ==== Receipt ==== */}
              {modal.kind === "receipt" && (
                <>
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        Order Receipt
                      </h3>
                      <p className="text-xs text-slate-500">
                        Saved successfully
                      </p>
                    </div>
                    <button
                      onClick={() => setModal({ kind: "closed" })}
                      className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-5 flex flex-col md:flex-row gap-10 text-sm">
                    {/* Left: details */}
                    <div className="flex-1 min-w-0 space-y-3">
                      <Row label="Order ID" value={modal.order.orderNo} mono />
                      <Row label="Meal" value={modal.order.mealName} />
                      <Row
                        label="Guest Count"
                        value={String(modal.order.count)}
                        mono
                      />
                      <Row
                        label="Guest User IDs"
                        value={
                          modal.order.guestRangeStart &&
                          modal.order.guestRangeEnd
                            ? `${modal.order.guestRangeStart} → ${modal.order.guestRangeEnd}`
                            : "—"
                        }
                        mono
                      />
                      <Row
                        label="Department"
                        value={modal.order.departmentName}
                      />
                      <Row
                        label="Requester"
                        value={modal.order.requesterName}
                      />
                      <Row label="Purpose" value={modal.order.purpose} />

                      {modal.order.guestIds &&
                        modal.order.guestIds.length > 0 && (
                          <div className="pt-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                              All Guest IDs
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {modal.order.guestIds.map((g) => (
                                <span
                                  key={g}
                                  className="px-2 py-0.5 bg-slate-100 rounded font-mono text-xs font-bold text-slate-700"
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Right: QR */}
                    <div className="md:w-50 shrink-0 flex flex-col items-center md:border-l md:border-slate-100 md:pr-5 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <QrCode size={12} />
                        Scan to release
                      </div>
                      <OrderQr
                        value={modal.order.orderNo}
                        orderNo={modal.order.orderNo}
                      />
                      <p className="text-[10px] text-slate-400 text-center mt-2 max-w-[180px]">
                        Resolves to{" "}
                        <span className="font-mono font-bold text-slate-600">
                          {modal.order.orderNo}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <button
                      onClick={() => setModal({ kind: "closed" })}
                      className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Row: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
}> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-3">
    <span className="text-slate-500 font-medium">{label}</span>
    <span
      className={cn("text-slate-900 font-bold text-right", mono && "font-mono")}
    >
      {value || "—"}
    </span>
  </div>
);

export default SpecialOrdersScreen;
