/**
 * ============================================================================
 * PCW Eats Frontend API Client (src/lib/api.ts)
 * ============================================================================
 * Strongly typed client for communicating with the Express backend (/api).
 * Modular and reusable across all components.
 */

import {
  Item,
  Meal,
  Quota,
  DepartmentQuotaMap,
  Canteen,
  DailyReadyMadeBatch,
} from "../types";

const BASE_URL = "/api";

// ---------------------------------------------------------------------------
// Shared shapes (mirrors server/db/store.ts interfaces)
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
  item: string;
  qty: number;
  cost: number;
  type: "meal" | "snack";
  category?: "stock-keeping" | "ready-made";
  userId?: string;
  userName?: string;
  canteenId?: string;
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

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/**
 * Low-level fetch wrapper. Throws on network/HTTP failure and on
 * `{ success: false }` bodies so callers can `try/catch` uniformly.
 * Pass `{ allowSoftFail: true }` for endpoints whose 200 body may carry
 * `success: false` (e.g. zkteco simulate-scan).
 */
async function fetchJson<T>(
  url: string,
  options?: RequestInit & { allowSoftFail?: boolean },
): Promise<T> {
  const { allowSoftFail, ...init } = options ?? {};

  const response = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

  // Daily Ready-Made Batches (Zero Rollover)
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
    getActive: () =>
      fetchJson<{ success: boolean; currentTime: string; data: Meal[] }>(
        "/meals/active",
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
    issueMeal: (data: {
      employeeId: string;
      mealId: string;
      canteenId?: string;
    }) =>
      fetchJson<{
        success: boolean;
        data: TransactionRecord;
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

  // ZKTeco MB360 Biometric Hardware
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
        allowSoftFail: true, // unknown employee returns 200 with success:false
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

    /**
     * Connects to the Server-Sent Events (SSE) stream for instant real-time
     * punch capture. Returns an unsubscribe function for useEffect cleanup.
     */
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
          if (payload.type === "biometric_scan") {
            onScan(payload);
          }
        } catch (e) {
          console.error("Failed to parse SSE event:", e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn(
          "SSE connection interrupted, browser will auto-reconnect:",
          err,
        );
      };

      return () => {
        eventSource.close();
      };
    },
  },

  // Reports & Analytics
  reports: {
    getDashboard: (month: string = "current") =>
      fetchJson<{ success: boolean; data: DashboardData }>(
        `/reports/dashboard${qs({ month })}`,
      ),
    getMonthly: (month: string) =>
      fetchJson<{ success: boolean } & MonthlyReport>(
        `/reports/monthly${qs({ month })}`,
      ),
    getSummary: () =>
      fetchJson<{
        success: boolean;
        totalTransactions: number;
        totalCost: number;
        totalQty: number;
        deptBalances: Record<string, Record<string, number>>;
      }>("/reports/summary"),
    getUsers: () =>
      fetchJson<{ success: boolean; data: User[]; total: number }>(
        "/reports/users",
      ),
  },
};

// Convenience re-export so components can `import { api, User } from '../lib/api'`
export type { User as ApiUser };
