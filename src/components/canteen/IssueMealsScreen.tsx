/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Meal-issuing terminal. Times use Asia/Colombo (Sri Lanka).
 * Sends the full user payload (dept, userName) so the server never
 * has to invent them. `item` is saved as the raw meal ID.
 *
 * Also subscribes to /api/hikvision/sse so a physical fingerprint scan
 * auto-fills the input and triggers the normal search/eligibility flow.
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
  QrCode,
  X,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BrowserQRCodeReader } from "@zxing/browser";
import {
  api,
  ActiveMeal,
  RecentMealRecord,
  SpecialOrderLookupOrder,
  SpecialOrderLookupGuest,
  SpecialOrderLookupMeal,
} from "../../lib/api";
import { Meal } from "../../types";
import { hhmmToAmPm } from "@/src/lib/date";
import { getCachedUser } from "@/src/lib/auth";
import { cn } from "../../lib/utils";

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

/* -------------------------------------------------------------------------- */
/* QR scan modal — opens the rear camera, decodes the first QR, then closes.   */
/* -------------------------------------------------------------------------- */
const QrScanModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}> = ({ open, onClose, onResult }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setStarting(true);

    const reader = new BrowserQRCodeReader();

    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          {
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          },
          videoRef.current!,
          (result) => {
            if (cancelled) return;
            if (!result) return;
            const text = result.getText().trim();
            if (!text) return;
            cancelled = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
            onResult(text);
          },
        );
        controlsRef.current = controls;
        if (!cancelled) setStarting(false);
      } catch (e: any) {
        if (cancelled) return;
        setStarting(false);
        setError(
          e?.message ??
            "Could not start the camera. Check permissions and that no other app is using it.",
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onResult]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Camera size={18} className="text-amber-500" />
            Scan QR Code
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative aspect-square w-full bg-slate-900 rounded-2xl overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
            <div className="absolute inset-6 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
            </div>
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-white text-xs font-bold gap-2">
                <Loader2 size={16} className="animate-spin" />
                Starting camera…
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-500 text-center">
            Point the camera at an order QR (e.g.&nbsp;
            <span className="font-mono font-bold text-slate-700">M1</span>). The
            result will be entered and searched automatically.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/* Biometric scan subscription (Hikvision DS-K1T343 via /api/hikvision/sse)   */
/* -------------------------------------------------------------------------- */
function useBiometricScan(
  enabled: boolean,
  onScan: (employeeNo: string) => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = api.hikvision.subscribeEvents((event) => {
      if (event.type !== "biometric_scan") return;
      const log = event.log;
      // console.log(">>> log.status:", log.status, "employeeNo:", log.employeeNo);
      if (!log || log.status !== "verified") return;
      const employeeNo = String(log.employeeNo ?? "").trim();
      if (!employeeNo) return;
      onScan(employeeNo);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/* -------------------------------------------------------------------------- */

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
  const [qrOpen, setQrOpen] = useState(false);

  const [specialOrder, setSpecialOrder] =
    useState<SpecialOrderLookupOrder | null>(null);
  const [specialGuest, setSpecialGuest] =
    useState<SpecialOrderLookupGuest | null>(null);
  const [specialMeal, setSpecialMeal] = useState<SpecialOrderLookupMeal | null>(
    null,
  );
  const [specialEligible, setSpecialEligible] = useState(false);
  const [releaseQty, setReleaseQty] = useState<number>(1);
  const [specialRemaining, setSpecialRemaining] = useState<number>(0);
  const [releasingSpecial, setReleasingSpecial] = useState(false);

  // NEW: scanner liveness indicator (fingerprint terminal via SSE)
  const [scannerLive, setScannerLive] = useState(false);

  const mealInputRef = useRef<HTMLInputElement>(null);
  // NEW: keeps a live reference to the scan handler so we don't re-subscribe
  // to SSE on every render.
  const handleScanFromDeviceRef = useRef<(employeeNo: string) => void>(
    () => {},
  );

  useEffect(() => {
    mealInputRef.current?.focus();
  }, []);

  /* NEW: probe the SSE stream once so the "Scanner Live" pill reflects
   * reality — the first handshake sets the flag. */
  useEffect(() => {
    const unsub = api.hikvision.subscribeEvents(() => setScannerLive(true));
    return () => unsub();
  }, []);

  /* NEW: subscribe to fingerprint scans from the device. */
  useBiometricScan(true, (employeeNo) => {
    handleScanFromDeviceRef.current(employeeNo);
  });

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
    setMealUserId("#" + normalized.id);
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
    setSpecialOrder(null);
    setSpecialGuest(null);
    setSpecialMeal(null);
    setSpecialEligible(false);
    setSpecialRemaining(0);

    if (!q) {
      setUserMatches([]);
      setMealSearchError("Please scan or enter an #Employee ID / Name.");
      return;
    }

    // ---- Special order / guest detection ---------------------------
    const stripped = q.replace(/^#/, "").toUpperCase();
    const looksLikeOrder = /^M\d+$/.test(stripped);
    const looksLikeGuest = /^S\d+$/.test(stripped);

    if (looksLikeOrder || looksLikeGuest) {
      setSearching(true);
      try {
        const res = await api.specialOrders.lookup(q);
        const d = res.data;
        if (d.type === "none") {
          setMealSearchError(d.reason ?? "Code not found.");
          return;
        }
        if (d.type === "order" && d.order) {
          setSpecialOrder(d.order);
          setSpecialMeal(d.meal ?? null);
          setSpecialRemaining(d.remaining ?? 0);
          setSpecialEligible(!!d.eligible);
          setReleaseQty(Math.min(1, d.remaining ?? 0) || 1);
          if (!d.eligible) {
            setMealSearchError(d.reason ?? "Order not eligible right now.");
          }
          return;
        }
        if (d.type === "guest" && d.guest && d.order) {
          setSpecialGuest(d.guest);
          setSpecialOrder(d.order);
          setSpecialMeal(d.meal ?? null);
          setSpecialRemaining(1);
          setSpecialEligible(!!d.eligible);
          setReleaseQty(d.remaining ? Math.min(1, d.remaining) : 1);
          if (!d.eligible) {
            setMealSearchError(d.reason ?? "Guest not eligible right now.");
          }
          return;
        }
      } catch (err: unknown) {
        setMealSearchError(
          err instanceof Error ? err.message : "Special order lookup failed",
        );
      } finally {
        setSearching(false);
      }
      return;
    }

    // ---- Existing behaviour (unchanged) ----------------------------
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

  /* NEW: keeps the ref pointing at the latest closure so the SSE callback
   * always sees the current state and handler. */
  handleScanFromDeviceRef.current = (employeeNo: string) => {
    // console.log("Handling scan:", employeeNo);

    setShowUserDropdown(false);
    setUserMatches([]);
    setMealSearchError(null);
    setMealsReason(null);
    setFoundMealUser(null);
    setSpecialOrder(null);
    setSpecialGuest(null);
    setSpecialMeal(null);
    setSpecialEligible(false);
    setSpecialRemaining(0);

    setMealUserId(`#${employeeNo}`);
    setTimeout(() => {
      void handleUserSearch(`#${employeeNo}`);
    }, 0);
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

  const doRelease = async (qty: number) => {
    if (!specialOrder) return;
    if (!specialEligible) return;
    if (qty < 1 || qty > specialRemaining) {
      setMealSearchError(
        `Choose a quantity between 1 and ${specialRemaining}.`,
      );
      return;
    }
    setReleasingSpecial(true);
    try {
      const res = await api.specialOrders.release(specialOrder.id, {
        count: specialGuest ? 1 : qty,
        canteenId: canteenId || "1",
        releasedBy: getCachedUser()?.id
          ? String(getCachedUser()!.id)
          : undefined,
      });
      setLastIssuedNotice({
        user: specialGuest
          ? `Guest ${specialGuest.id}`
          : `${res.data.releasedCount} guest meals`,
        meal: specialOrder.mealName,
        cost: specialMeal?.cost ?? 0,
      });
      setSpecialOrder(null);
      setSpecialGuest(null);
      setSpecialMeal(null);
      setSpecialEligible(false);
      setSpecialRemaining(0);
      setMealUserId("");
      void loadRecentMeals();
      setTimeout(() => setLastIssuedNotice(null), 4000);
    } catch (err: unknown) {
      setMealSearchError(
        err instanceof Error ? err.message : "Failed to release order",
      );
    } finally {
      setReleasingSpecial(false);
    }
  };

  const handleReleaseBulk = () => doRelease(releaseQty);
  const handleReleaseAll = () => doRelease(specialRemaining);

  /* QR result handler — paste into field and auto-search */
  const handleQrResult = useCallback(
    (text: string) => {
      setQrOpen(false);
      const cleaned = text.trim();
      setMealUserId(cleaned);
      setTimeout(() => {
        void handleUserSearch(cleaned);
      }, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
              <div className="flex items-center gap-2">
                {/* NEW: Scanner Live indicator */}
                <span
                  title={
                    scannerLive
                      ? "Fingerprint scanner connected"
                      : "Scanner stream offline"
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    scannerLive
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200",
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      scannerLive
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-slate-400",
                    )}
                  />
                  {scannerLive ? "Scanner Live" : "Scanner Offline"}
                </span>
                <span className="text-[11px] text-slate-400">
                  Scan, type Name/#ID then press Enter
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="relative flex flex-col md:flex-row items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
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
                    className="w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-bold focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleUserSearch()}
                    disabled={searching}
                    className="px-5 py-5 bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-slate-900 rounded-2xl font-black text-sm transition-all shadow-md shadow-amber-400/20 cursor-pointer"
                  >
                    {searching ? "…" : "Search"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    disabled={searching}
                    title="Scan QR code"
                    className="px-5 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 disabled:opacity-60 transition-all shadow-md cursor-pointer flex items-center justify-center"
                  >
                    <QrCode size={22} />
                  </button>
                </div>
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

        {specialOrder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl mx-auto p-6 bg-violet-50 border-2 border-violet-200 rounded-3xl space-y-4 text-left"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-violet-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest">
                    {specialGuest ? "Guest Release" : "Bulk Order Release"}
                  </span>
                  <span className="font-mono text-xs font-bold text-violet-800">
                    {specialOrder.orderNo}
                  </span>
                  {specialGuest && (
                    <span className="px-2 py-0.5 rounded bg-white border border-violet-300 text-violet-700 text-[10px] font-black uppercase tracking-widest">
                      {specialGuest.id}
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-black text-slate-900 mt-1">
                  {specialOrder.mealName}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {specialOrder.requesterName} · {specialOrder.departmentName}
                </p>
                <p className="text-xs text-slate-500 mt-1 italic">
                  "{specialOrder.purpose}"
                </p>
              </div>
              <button
                onClick={() => {
                  setSpecialOrder(null);
                  setSpecialGuest(null);
                  setSpecialMeal(null);
                  setSpecialEligible(false);
                  setMealUserId("");
                }}
                className="text-xs font-bold text-violet-600 hover:text-violet-800 px-3 py-1.5 rounded-lg hover:bg-violet-100 cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* Eligibility summary */}
            {specialMeal && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-violet-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Window
                  </p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">
                    {hhmmToAmPm(specialMeal.eligibleFrom)} –{" "}
                    {hhmmToAmPm(specialMeal.eligibleTo)}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-violet-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Unit Cost
                  </p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">
                    LKR {specialMeal.cost}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-violet-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Total
                  </p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">
                    {specialOrder.count}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-violet-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Remaining
                  </p>
                  <p className="font-mono font-bold text-emerald-700 mt-0.5">
                    {specialRemaining}
                  </p>
                </div>
              </div>
            )}

            {/* Release form — only when eligible & remaining */}
            {specialEligible && specialRemaining > 0 && (
              <div className="space-y-3">
                {!specialGuest && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Release Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={specialRemaining}
                      value={releaseQty}
                      onChange={(e) =>
                        setReleaseQty(
                          Math.max(
                            1,
                            Math.min(
                              specialRemaining,
                              Number(e.target.value) || 1,
                            ),
                          ),
                        )
                      }
                      className="w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <p className="text-[11px] text-slate-500">
                      Max {specialRemaining} · each unit consumes one guest ID
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleReleaseBulk}
                    disabled={releasingSpecial}
                    className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-black text-sm hover:bg-violet-700 disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {releasingSpecial && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    {specialGuest
                      ? `Release 1 for Guest ${specialGuest.id}`
                      : `Release ${releaseQty} Meal${releaseQty > 1 ? "s" : ""}`}
                  </button>
                  {!specialGuest && specialRemaining > 1 && (
                    <button
                      onClick={handleReleaseAll}
                      disabled={releasingSpecial}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {releasingSpecial && (
                        <Loader2 size={16} className="animate-spin" />
                      )}
                      Release All ({specialRemaining})
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

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
                        {hhmmToAmPm(meal.eligibleFrom)} -{" "}
                        {hhmmToAmPm(meal.eligibleTo)} Cost: LKR {meal.cost}
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

      {/* QR scan modal */}
      <AnimatePresence>
        {qrOpen && (
          <QrScanModal
            open={qrOpen}
            onClose={() => setQrOpen(false)}
            onResult={handleQrResult}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
