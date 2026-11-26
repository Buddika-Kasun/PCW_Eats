import React, { useEffect, useState } from "react";
import { Utensils, LogIn, AlertTriangle, Loader2 } from "lucide-react";
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

    // Always verify against the server — cookie is the source of truth.
    (async () => {
      const user = await fetchMe();
      if (user) {
        setStatus("ok");
        onAuthed(user);
        // Clean up the ?auth= flag
        window.history.replaceState({}, "", "/");
      } else {
        setStatus(auth === "missing" ? "missing" : "missing");
        setMessage(
          "Please sign in through the PCW Ride app to access PCW Eats.",
        );
      }
    })();
  }, [onAuthed]);

  return (
    <div className="min-h-dvh bg-slate-900 text-white flex items-center justify-center p-6">
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
              href="https://pcwride.app" // ← replace with real PCW Ride URL
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 transition"
            >
              <LogIn size={18} />
              Open PCW Ride app
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
