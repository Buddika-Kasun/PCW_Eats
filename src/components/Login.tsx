import React, { useState } from "react";
import { Utensils, LogIn, Loader2, AlertTriangle, EyeOff, Eye } from "lucide-react";
import { fetchMe, AuthUser, login } from "../lib/auth";

interface LoginProps {
  onAuthed: (user: AuthUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onAuthed }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await login(username, password);

      if (!user) {
        setError("Invalid username or password.");
        return;
      }

      // Clear the /login URL so refreshing keeps the app in the authed shell
      window.history.replaceState({}, "", "/");

      onAuthed(user);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-800/60 border border-slate-700 rounded-2xl p-8 space-y-5"
      >
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center">
            <Utensils className="text-slate-900" size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">PCW Eats</h1>
          <p className="text-xs text-slate-400 uppercase tracking-widest">
            Staff Sign In
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-amber-400"
            required
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 rounded-lg bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-amber-400"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 transition disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Signing in…
            </>
          ) : (
            <>
              <LogIn size={16} />
              Sign In
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-slate-500">
          Normal users must access PCW Eats via the PCW Ride app.
        </p>
      </form>
    </div>
  );
};
