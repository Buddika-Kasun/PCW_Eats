import React, { useEffect, useState } from "react";
import { Utensils, AlertTriangle, Loader2, LogIn } from "lucide-react";
import { fetchMe, AuthUser } from "../lib/auth";

interface WelcomeProps {
  onAuthed: (user: AuthUser) => void;
}

type Status = "checking" | "ok" | "missing" | "failed";

export const Welcome: React.FC<WelcomeProps> = ({ onAuthed }) => {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");

    if (auth === "failed") {
      setStatus("failed");
      setMessage(
        "We couldn't validate your PCW Ride session. Please sign in again.",
      );
      return;
    }

    (async () => {
      const user = await fetchMe();
      if (user) {
        setStatus("ok");
        onAuthed(user);
        window.history.replaceState({}, "", "/");
      } else {
        setStatus("missing");
        setMessage(
          "Please sign in through the PCW Ride app to access PCW Eats.",
        );
      }
    })();
  }, [onAuthed]);

  return (
    <div className="min-h-dvh bg-slate-900 text-white flex items-center justify-center p-6 relative">
      {/* Staff sign-in — top right */}
      <a
        href="/login"
        className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
      >
        <LogIn size={14} />
        <span>Canteen Staff Sign In</span>
      </a>

      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center">
          <Utensils className="text-slate-900" size={32} />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">PCW Eats</h1>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            Canteen ERP
          </p>
        </div>

        {status === "checking" && (
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="animate-spin" size={18} />
            <span>Validating your session…</span>
          </div>
        )}

        {(status === "missing" || status === "failed") && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="text-amber-400" size={28} />
            </div>
            <p className="text-sm text-slate-300">{message}</p>
            {/* <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 transition"
            >
              <LogIn size={18} />
              Sign in as Canteen / Staff
            </a> */}
            <button
              onClick={() => window.location.reload()}
              className="w-full text-xs text-slate-400 hover:text-slate-200"
            >
              I've signed in — retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
