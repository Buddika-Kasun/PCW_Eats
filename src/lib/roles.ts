import { AuthUser } from "./auth";
import { View } from "../types";

export type Role = "sysadmin" | "admin" | "hr" | "canteen" | "user" | string;

const ADMIN_ROLES = new Set(["sysadmin", "admin", "hr"]);

export function isAdminRole(user: AuthUser | null): boolean {
  const role = (user?.role ?? "").toString().toLowerCase();
  return ADMIN_ROLES.has(role);
}

export function isCanteenRole(user: AuthUser | null): boolean {
  return (user?.role ?? "").toString().toLowerCase() === "canteen";
}

/** Which top-level view should this user land on first? */
export function defaultViewFor(user: AuthUser | null): View {
  if (isAdminRole(user)) return "admin-dashboard";
  if (isCanteenRole(user)) return "canteen-interface";
  return "user-dashboard";
}

/**
 * Can this user see the given view?
 * - Admins/sysadmin/hr: everything
 * - Canteen: canteen-interface only
 * - Others: user-dashboard only
 */
export function canAccessView(user: AuthUser | null, view: View): boolean {
  if (isAdminRole(user)) return true;
  if (isCanteenRole(user)) return view === "canteen-interface";
  return view === "user-dashboard";
}

/** Whether the sidebar shell should render for this user. */
export function shouldShowSidebar(user: AuthUser | null): boolean {
  return isAdminRole(user);
}
