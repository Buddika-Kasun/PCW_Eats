/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canteen terminal picker. Extracted from CanteenInterface.tsx.
 */

import React from "react";
import {
  Tablet,
  ChevronRight,
  LogOut,
  Loader2,
  AlertCircle,
  Building2,
  LayoutDashboard,
} from "lucide-react";
import { motion } from "motion/react";
import { Canteen } from "../../types";

interface TerminalPickerProps {
  canteens: Canteen[];
  loading: boolean;
  error: string | null;
  admin: boolean;
  onPick: (id: string) => void;
  onSignOut: () => void;
  onBackToDashboard?: () => void;
  onRetry?: () => void;
}

export const TerminalPicker: React.FC<TerminalPickerProps> = ({
  canteens,
  loading,
  error,
  admin,
  onPick,
  onSignOut,
  onBackToDashboard,
  onRetry,
}) => {
  return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-6 relative">
      <button
        onClick={onSignOut}
        className="fixed top-4 right-4 z-10 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
      >
        <LogOut size={14} />
        <span>Sign Out</span>
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl text-center"
      >
        <div className="w-20 h-20 bg-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-400/20">
          <Tablet className="text-slate-900" size={40} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">
          Canteen Terminal
        </h2>
        <p className="text-slate-500 mb-8">
          Select your operating counter to open the point-of-issuance interface.
        </p>

        <div className="space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500">
              <Loader2 className="animate-spin text-amber-500" size={28} />
              <p className="text-sm font-semibold">Loading canteens…</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 flex items-start gap-3 text-left">
              <AlertCircle
                size={18}
                className="shrink-0 mt-0.5 text-rose-500"
              />
              <div className="flex-1">
                <p className="font-bold">Couldn't load canteens</p>
                <p className="text-xs mt-0.5">{error}</p>
                <button
                  onClick={onRetry ?? (() => window.location.reload())}
                  className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && canteens.length === 0 && (
            <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2">
              <Building2 size={32} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">
                No canteens configured yet
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Ask an administrator to add a canteen from the Canteen
                Management page before opening a terminal here.
              </p>
            </div>
          )}

          {!loading && !error && canteens.length > 0 && (
            <div className="space-y-4">
              {canteens.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPick(c.id)}
                  className="w-full p-6 bg-slate-50 hover:bg-amber-50 border-2 border-transparent hover:border-amber-400 rounded-2xl flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div className="text-left">
                    <p className="font-bold text-slate-900 text-lg">{c.name}</p>
                    <p className="text-sm text-slate-500">{c.type} Point</p>
                  </div>
                  <ChevronRight
                    className="text-slate-300 group-hover:text-amber-500 transition-colors"
                    size={24}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {admin && onBackToDashboard && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={onBackToDashboard}
              className="w-full py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3 transition-colors text-sm cursor-pointer"
            >
              <LayoutDashboard size={20} className="text-slate-500" />
              <span>Return to Main Admin Dashboard</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
