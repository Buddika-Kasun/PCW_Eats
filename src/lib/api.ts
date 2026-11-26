/**
 * ============================================================================
 * PCW Eats Frontend API Client (src/lib/api.ts)
 * ============================================================================
 */

import {
  Item,
  Meal,
  Quota,
  DepartmentQuotaMap,
  Canteen,
  DailyReadyMadeBatch,
} from "../types";
import { getToken } from "./authToken";

const BASE_URL = "/api";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  dept: string;
  role: string;
  fingerprintEnrolled?: boolean;
  biometricCardNo?: string;
}

export interface InventoryRecord {
  id: string;
  itemId: string;
  item: string;
  uom: string;
  stock: number;
  minLevel: number;
  status: "Good" | "Low";
}

export interface TransactionRecord {
  id: string;
  date: string;
  time?: string;
  dept: string;
  departmentId?: string | null;
  item: string; // meal ID or item ID (no prefix)
  qty: number;
  cost: number;
  type: "meal" | "snack";
  category?: "stock-keeping" | "ready-made";
  userId?: string;
  userName?: string;
  canteenId?: string;
  status?: "ACTIVE" | "VOID";
}

export interface BiometricLog {
  id: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  timestamp: string;
  deviceId: string;
  deviceIp: string;
  verificationMode: "fingerprint" | "facial" | "card" | "password";
  status: "verified" | "unrecognized";
}

export interface ZktecoConfig {
  ip: string;
  port: number;
  commKey: number;
  timeout: number;
  deviceName: string;
  enabled: boolean;
  mode: "real-hardware" | "simulation";
}

export interface ZktecoStatus {
  connected: boolean;
  config: ZktecoConfig;
  lastHeartbeat: string;
  recentLogsCount: number;
  deviceInfo: {
    model: string;
    firmware: string;
    algorithms: string;
    capacity: {
      fingerprints: number;
      faces: number;
      cards: number;
      logs: number;
    };
  };
}

export interface DashboardData {
  monthKey: string;
  monthLabel: string;
  totalCost: number;
  prevCost: number;
  costChange: string;
  costTrend: "up" | "down";
  totalMeals: number;
  mealChange: string;
  activeEmployees: number;
  deptData: { name: string; cost: number }[];
  topDepartments: {
    name: string;
    employees: number;
    meals: number;
    cost: string;
    status: "High" | "Normal" | "Low";
  }[];
}

export interface MonthlyReport {
  month: string;
  total: number;
  byDept: Record<string, number>;
  byType: Record<string, number>;
  count: number;
  transactions: TransactionRecord[];
}

export interface ActiveMeal extends Meal {
  alreadyIssued?: boolean;
}

export interface ActiveMealsResponse {
  success: boolean;
  currentTime: string;
  timezone?: string;
  data: ActiveMeal[];
  reason?: string;
}

export interface RecentMealRecord {
  id: string;
  time: string;
  user: string;
  userId: string;
  dept: string;
  departmentId?: string;
  mealId: string;
  meal: string;
  cost: number;
}

// near the other shared shapes
export interface Department {
  id: number;
  name: string;
}

export interface DepartmentListResponse {
  success: boolean;
  message?: string;
  data: {
    departments: Department[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// ---------------------------------------------------------------------------
// User Dashboard
// ---------------------------------------------------------------------------

export interface DashboardUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  deptId: string;
  deptName: string;
}

export type MealStatus = "taken" | "missed" | "eligible" | "upcoming";

export interface DashboardMeal {
  id: string;
  code: string;
  name: string;
  cost: number;
  eligibleFrom: string;
  eligibleTo: string;
  status: MealStatus;
  takenAt?: string;
}

export interface DashboardQuotaItem {
  itemId: string;
  itemName: string;
  uom: string;
  eligibleQty: number;
  takenQty: number;
  remainingQty: number;
}

export interface UserDashboardResponse {
  success: boolean;
  message?: string;
  data: {
    user: DashboardUser;
    meals: {
      past: DashboardMeal[];
      current: DashboardMeal[];
      next: DashboardMeal[];
    };
    transactions: TransactionRecord[];
    quotas: {
      departmentId: string;
      departmentName: string;
      effectiveFrom: string;
      items: DashboardQuotaItem[];
    };
    summary: {
      todayMealsIssued: number;
      todayMealsEligible: number;
      totalTransactions: number;
    };
  };
}

export interface AdminDashboardResponse {
  monthKey: string;
  monthLabel: string;
  totalCost: number;
  prevCost: number;
  costChange: string;
  costTrend: "up" | "down";
  totalMeals: number;
  mealChange: string;
  activeEmployees: number;
  deptData: { name: string; cost: number }[];
  topDepartments: {
    name: string;
    employees: number;
    meals: number;
    cost: string;
    status: "High" | "Normal" | "Low";
  }[];
  monthlyTrend: { month: string; cost: number }[];
  generatedAt: string;
}

export interface ReportTransaction {
  id: string;
  date: string;
  time?: string | null;
  dept: string;
  departmentId?: string | null;
  itemId?: string;
  item: string; // resolved display name
  itemCode?: string | null;
  uom?: string | null;
  qty: number;
  cost: number;
  type: string;
  category?: string | null;
  userId?: string | null;
  userName?: string | null;
  canteenId?: string | null;
  canteenName?: string | null;
}

export interface ReportInventoryRow {
  id: string;
  itemId: string;
  item: string;
  uom: string;
  stock: number;
  minLevel: number;
  status: "Good" | "Low";
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function fetchJson<T>(
  url: string,
  options?: RequestInit & { allowSoftFail?: boolean },
): Promise<T> {
  const { allowSoftFail, ...init } = options ?? {};
  const token = getToken();

  const response = await fetch(`${BASE_URL}${url}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      body.message ?? `API error: ${response.status} ${response.statusText}`,
    );
  }
  if (!allowSoftFail && body.success === false) {
    throw new Error(body.message ?? "Request failed");
  }
  return body as unknown as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.append(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const api = {
  // Admin Dashboard
  adminDashboard: {
    get: (month: string = "current") =>
      fetchJson<{ success: boolean; data: AdminDashboardResponse }>(
        `/dashboard/admin${qs({ month })}`,
      ),
  },
  // User Dashboard
  dashboard: {
    getUser: (userId: string) =>
      fetchJson<UserDashboardResponse>(
        `/dashboard/user/${encodeURIComponent(userId)}`,
      ),
  },
  // Reports
  reports: {
    transactions: (params: {
      type?: "snack" | "meal";
      dept?: string;
      range?: "current" | "last" | "last3" | "custom";
      from?: string;
      to?: string;
    }) =>
      fetchJson<{
        success: boolean;
        data: ReportTransaction[];
        meta: {
          range: string;
          from: string;
          to: string;
          type: string | null;
          dept: string | null;
          count: number;
          totalCost: number;
          totalQty: number;
        };
      }>(`/reports/transactions${qs(params)}`),

    inventory: () =>
      fetchJson<{
        success: boolean;
        data: ReportInventoryRow[];
        total: number;
      }>("/reports/inventory"),

    departments: () =>
      fetchJson<{ success: boolean; data: string[] }>("/reports/departments"),

    exportUrl: (params: {
      type?: "snack" | "meal";
      dept?: string;
      range?: "current" | "last" | "last3" | "custom";
      from?: string;
      to?: string;
    }) => `/api/reports/export${qs(params)}`,
  },
  // Items
  items: {
    getAll: (category?: "stock-keeping" | "ready-made") =>
      fetchJson<{ success: boolean; data: Item[]; total: number }>(
        `/items${qs({ category })}`,
      ),
    getById: (id: string) =>
      fetchJson<{ success: boolean; data: Item }>(
        `/items/${encodeURIComponent(id)}`,
      ),
    create: (item: Partial<Item>) =>
      fetchJson<{ success: boolean; data: Item; message: string }>("/items", {
        method: "POST",
        body: JSON.stringify(item),
      }),
    update: (id: string, item: Partial<Item>) =>
      fetchJson<{ success: boolean; data: Item; message: string }>(
        `/items/${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify(item) },
      ),
    delete: (id: string) =>
      fetchJson<{ success: boolean; data: Item; message: string }>(
        `/items/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
  },

  // Daily Ready-Made Batches
  batches: {
    getAll: () =>
      fetchJson<{
        success: boolean;
        data: DailyReadyMadeBatch[];
        metrics: {
          totalReceived: number;
          totalIssued: number;
          totalRemaining: number;
          isAllCleared: boolean;
        };
      }>("/batches"),
    create: (data: {
      itemId: string;
      receivedQty: number;
      deliveryTime?: string;
    }) =>
      fetchJson<{
        success: boolean;
        data: DailyReadyMadeBatch;
        message: string;
      }>("/batches", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    clearance: () =>
      fetchJson<{
        success: boolean;
        clearedAt: string;
        totalClearedUnits: number;
        message: string;
      }>("/batches/clear", { method: "POST" }),
    reset: () =>
      fetchJson<{
        success: boolean;
        data: DailyReadyMadeBatch[];
        message: string;
      }>("/batches/reset", { method: "POST" }),
  },

  // Meals & Eligible Windows
  meals: {
    getAll: () =>
      fetchJson<{ success: boolean; data: Meal[]; total: number }>("/meals"),

    getActive: () => fetchJson<ActiveMealsResponse>("/meals/active"),

    getActiveForUser: (userId: string) =>
      fetchJson<ActiveMealsResponse>(
        `/meals/active${qs({ userId, excludeIssued: "true" })}`,
      ),

    create: (meal: Partial<Meal>) =>
      fetchJson<{ success: boolean; data: Meal; message: string }>("/meals", {
        method: "POST",
        body: JSON.stringify(meal),
      }),
    update: (id: string, patch: Partial<Meal>) =>
      fetchJson<{ success: boolean; data: Meal; message: string }>(
        `/meals/${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify(patch) },
      ),
    delete: (id: string) =>
      fetchJson<{ success: boolean; data: Meal; message: string }>(
        `/meals/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
  },

  // Department
  departments: {
    getAll: async (params?: {
      page?: number;
      limit?: number;
      search?: string;
      companyId?: number;
      costCenterId?: number;
    }): Promise<Department[]> => {
      const res = await fetchJson<DepartmentListResponse>(
        `/departments/get-all${qs({
          page: params?.page,
          limit: params?.limit,
          search: params?.search,
          companyId: params?.companyId,
          costCenterId: params?.costCenterId,
        })}`,
      );
      return (res.data?.departments ?? []).map((d) => ({
        id: d.id,
        name: d.name,
      }));
    },
  },

  // Department Quotas
  quotas: {
    getAll: () =>
      fetchJson<{
        success: boolean;
        data: Quota[];
        mappings: DepartmentQuotaMap[];
        balances: Record<string, Record<string, number>>;
      }>("/quotas"),
    getByDept: (dept: string) =>
      fetchJson<{
        success: boolean;
        department: string;
        mapping: DepartmentQuotaMap | null;
        quota: Quota | null;
        balances: Record<string, number>;
      }>(`/quotas/department/${encodeURIComponent(dept)}`),
    create: (code: string, items: { itemId: string; eligibleQty: number }[]) =>
      fetchJson<{ success: boolean; data: Quota; message: string }>("/quotas", {
        method: "POST",
        body: JSON.stringify({ code, items }),
      }),
    update: (
      id: string,
      patch: {
        code?: string;
        items?: { itemId: string; eligibleQty: number }[];
      },
    ) =>
      fetchJson<{ success: boolean; data: Quota; message: string }>(
        `/quotas/${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify(patch) },
      ),
    delete: (id: string) =>
      fetchJson<{ success: boolean; message: string }>(
        `/quotas/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
    mapDepartment: (
      department: string,
      quotaId: string,
      effectiveFrom?: string,
    ) =>
      fetchJson<{
        success: boolean;
        data: DepartmentQuotaMap;
        message: string;
      }>("/quotas/mapping", {
        method: "POST",
        body: JSON.stringify({ department, quotaId, effectiveFrom }),
      }),
    updateMapping: (
      id: string,
      patch: {
        department?: string;
        quotaId?: string;
        effectiveFrom?: string;
      },
    ) =>
      fetchJson<{
        success: boolean;
        data: DepartmentQuotaMap;
        message: string;
      }>(`/quotas/mapping/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),

    deleteMapping: (id: string) =>
      fetchJson<{ success: boolean; message: string }>(
        `/quotas/mapping/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
  },

  // Perpetual Inventory
  inventory: {
    getAll: () =>
      fetchJson<{ success: boolean; data: InventoryRecord[]; total: number }>(
        "/inventory",
      ),
    adjust: (data: {
      itemId: string;
      adjustmentQty?: number;
      minLevel?: number;
    }) =>
      fetchJson<{
        success: boolean;
        data: InventoryRecord;
        message: string;
      }>("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    create: (data: { itemId: string; stock?: number; minLevel?: number }) =>
      fetchJson<{
        success: boolean;
        data: InventoryRecord;
        message: string;
      }>("/inventory", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Canteens
  canteens: {
    getAll: () =>
      fetchJson<{ success: boolean; data: Canteen[]; total: number }>(
        "/canteens",
      ),
    create: (data: {
      code: string;
      name: string;
      type?: "Main" | "Snack Bar" | "Executive";
    }) =>
      fetchJson<{ success: boolean; data: Canteen; message: string }>(
        "/canteens",
        { method: "POST", body: JSON.stringify(data) },
      ),
    update: (id: string, data: Partial<Canteen>) =>
      fetchJson<{ success: boolean; data: Canteen; message: string }>(
        `/canteens/${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify(data) },
      ),
    delete: (id: string) =>
      fetchJson<{ success: boolean; data: Canteen; message: string }>(
        `/canteens/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
  },

  // Transactions & Issuing
  transactions: {
    getAll: (params?: {
      type?: "meal" | "snack";
      dept?: string;
      month?: string;
      limit?: number;
    }) =>
      fetchJson<{
        success: boolean;
        data: TransactionRecord[];
        total: number;
      }>(`/transactions${qs(params ?? {})}`),

    recentMeals: (limit = 10) =>
      fetchJson<{
        success: boolean;
        date: string;
        data: RecentMealRecord[];
        total: number;
      }>(`/transactions/recent-meals${qs({ limit })}`),

    issueMeal: (data: {
      employeeId: string;
      mealId: string;
      canteenId?: string;
      dept?: string;
      departmentId?: string | number;
      userName?: string;
    }) =>
      fetchJson<{
        success: boolean;
        data: TransactionRecord & {
          mealName?: string;
          userName?: string;
          dept?: string;
          departmentId?: string | null;
        };
        message: string;
      }>("/transactions/issue-meal", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    issueSnack: (data: {
      department: string;
      userId?: string;
      selections: Record<string, number>;
      canteenId?: string;
    }) =>
      fetchJson<{
        success: boolean;
        data: TransactionRecord[];
        message: string;
      }>("/transactions/issue-snack", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // ZKTeco
  zkteco: {
    getStatus: () =>
      fetchJson<{ success: boolean; data: ZktecoStatus }>("/zkteco/status"),
    updateConfig: (config: Partial<ZktecoConfig>) =>
      fetchJson<{
        success: boolean;
        data: ZktecoConfig;
        message: string;
      }>("/zkteco/config", {
        method: "POST",
        body: JSON.stringify(config),
      }),
    simulateScan: (employeeId?: string) =>
      fetchJson<{
        success: boolean;
        data: {
          success: boolean;
          log: BiometricLog;
          user: User | null;
          message: string;
        };
      }>("/zkteco/simulate-scan", {
        method: "POST",
        body: JSON.stringify({ employeeId }),
        allowSoftFail: true,
      }),
    punch: (data: {
      userIdOrCard: string;
      verifyType?: "fingerprint" | "facial" | "card" | "password";
      deviceId?: string;
    }) =>
      fetchJson<{
        success: boolean;
        verified: boolean;
        employee?: User;
        log: BiometricLog;
        message: string;
      }>("/zkteco/punch", {
        method: "POST",
        body: JSON.stringify(data),
        allowSoftFail: true,
      }),
    getLogs: (limit?: number) =>
      fetchJson<{
        success: boolean;
        data: BiometricLog[];
        total: number;
      }>(`/zkteco/logs${qs({ limit })}`),

    subscribeEvents: (
      onScan: (event: {
        type: "biometric_scan";
        log: BiometricLog;
        user: User | null;
        timestamp: string;
      }) => void,
    ) => {
      const eventSource = new EventSource(`${BASE_URL}/zkteco/events`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "biometric_scan") onScan(payload);
        } catch (e) {
          console.error("Failed to parse SSE event:", e);
        }
      };
      eventSource.onerror = (err) => {
        console.warn("SSE connection interrupted:", err);
      };
      return () => eventSource.close();
    },
  },

  users: {
    search: (query: string) =>
      fetchJson<{ success: boolean; data: User[]; total: number }>(
        `/users/search${qs({ query })}`,
      ),
    getById: (id: string) =>
      fetchJson<{ success: boolean; data: User }>(
        `/users/${encodeURIComponent(id)}`,
      ),
  },
};

export type { User as ApiUser };
