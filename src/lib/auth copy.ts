import { getToken } from "./authToken";

const KEY = "pcw_eats_user";

export interface AuthUser {
  id?: number | string;
  email: string;
  displayname?: string;
  username: string;
  role?: string;
  profilePicture?: string | null;
  [k: string]: unknown;
}

export function getCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Self-heal old/badly-shaped entries
    if (parsed && typeof parsed === "object" && "user" in parsed) {
      return (parsed.user as AuthUser) ?? null;
    }
    return parsed as AuthUser;
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

export async function fetchMe(): Promise<AuthUser | null> {
    const token = getToken();
    if (!token) return null;

  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "omit",
    });

    // const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.status === 401 || !res.ok) {
      clearUser();
      return null;
    }

    const json = await res.json();
    if (!json?.success || !json.data) {
      clearUser();
      return null;
    }

    // Handle both shapes:
    //   data: { user: {...}, valid: true }   ← your real response
    //   data: { id, email, ... }             ← flat
    const payload = json.data;
    const user: AuthUser | null =
      payload.user && typeof payload.user === "object"
        ? (payload.user as AuthUser)
        : (payload as AuthUser);

    if (!user) {
      clearUser();
      return null;
    }

    localStorage.setItem(KEY, JSON.stringify(user));
    return user;
  } catch {
    clearUser();
    return null;
  }
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } finally {
    clearUser();
    window.location.replace("/");
  }
}
