/**
 * ============================================================================
 * Dashboard Routes (/api/dashboard)
 * ============================================================================
 *   GET /api/dashboard/user/:userId
 *
 * Behaviour:
 *  - Fetches the user from PCW Ride (direct → search fallback).
 *  - Uses user.department.id as the department key everywhere.
 *  - Classifies today's meals into past / current / next.
 *  - Returns all of the user's transactions.
 *  - Returns the department's quota items with eligible vs taken counts.
 * ============================================================================
 */

import { Router, Request, Response } from "express";
import { PCW_RIDE_API_URL } from "../config";
import { prisma } from "../db/prisma";

const router = Router();
const TIME_ZONE = "Asia/Colombo";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

interface NormalisedUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  deptId: string; // department.id as string
  deptName: string; // department.name
  raw: any;
}

function normaliseUser(u: any): NormalisedUser {
  const dept = u?.department ?? {};
  return {
    id: String(u?.id ?? u?.username ?? ""),
    username: u?.username ?? "",
    name: u?.displayname ?? u?.username ?? u?.email ?? u?.phone ?? "Unknown",
    email: u?.email ?? "",
    phone: u?.phone ?? "",
    role: u?.role ?? "",
    deptId: String(dept?.id ?? u?.departmentId ?? ""),
    deptName: dept?.name ?? u?.departmentName ?? "",
    raw: u,
  };
}

export async function fetchPcwUser(id: string): Promise<NormalisedUser | null> {
  // let newId = id;
  // 1. Direct lookup
  try {
    const directRes = await fetch(
      `${PCW_RIDE_API_URL}/user/get-eats/${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } },
    );
    if (directRes.ok) {
      const body: any = await directRes.json();
      const u = body?.data?.user ?? body?.data ?? body?.user ?? body;
      if (u && (u.id || u.username)) return normaliseUser(u);
    }
  } catch {
    /* fall through */
  }

  // 2. Search fallback
  const searchRes = await fetch(
    `${PCW_RIDE_API_URL}/user/search-eats?query=#${encodeURIComponent(id)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!searchRes.ok) return null;

  const body: any = await searchRes.json();
  const rows: any[] = Array.isArray(body?.data?.users)
    ? body.data.users
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : [];

  const exact = rows.find((u) => String(u?.id ?? u?.username ?? "") === id);
  return exact ? normaliseUser(exact) : null;
}

/** "12:00", "9:5", " 12:00 ", "12:00:00" → "12:00" (Colombo wall clock). */
export function normalizeHHmm(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  const m = /^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(hhmm: string): number {
  const n = normalizeHHmm(hhmm) ?? "00:00";
  const [h, m] = n.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Current Colombo wall-clock time as HH:mm. */
export function nowHHMM(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour");
  return `${hh}:${g("minute")}`;
}

/** Current Colombo calendar date as YYYY-MM-DD. */
export function todayISO(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/* -------------------------------------------------------------------------- */
/* Helpers (append below existing helpers)                                     */
/* -------------------------------------------------------------------------- */

function parseMonthKey(monthKey: string): { from: Date; to: Date } | null {
  // Accepts: "current" | "last" | "YYYY-MM" | "jan" | "feb" | ... | "dec"
  const now = new Date();
  const mk = (y: number, m: number) => ({
    from: new Date(Date.UTC(y, m, 1)),
    to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
  });

  if (monthKey === "current") {
    return mk(now.getUTCFullYear(), now.getUTCMonth());
  }
  if (monthKey === "last") {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    return mk(d.getUTCFullYear(), d.getUTCMonth());
  }

  // YYYY-MM
  const isoMatch = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]) - 1;
    if (m >= 0 && m <= 11) return mk(y, m);
    return null;
  }

  // Short month keys (jan..dec) — assume current year
  const shortMonths = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const idx = shortMonths.indexOf(monthKey.toLowerCase());
  if (idx >= 0) return mk(now.getUTCFullYear(), idx);

  return null;
}

function monthLabelFromKey(monthKey: string, from: Date): string {
  if (monthKey === "current") return "Current Month";
  if (monthKey === "last") return "Last Month";
  return from.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "0%" : "+100%";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function trendOf(current: number, previous: number): "up" | "down" {
  return current >= previous ? "up" : "down";
}

function dateStringToMonthKey(dateStr: string): string {
  // dateStr expected as YYYY-MM-DD
  return dateStr.slice(0, 7);
}

async function fetchActiveEmployeeCount(): Promise<number> {
  try {
    const res = await fetch(`${PCW_RIDE_API_URL}/user/get-eats-count`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn(
        `fetchActiveEmployeeCount: upstream ${res.status} ${res.statusText}`,
      );
      return 0;
    }

    // Parse the body exactly ONCE.
    // The upstream may return a bare number, { data: n }, { data: { count: n } },
    // or { count: n } — handle all shapes defensively.
    const raw = await res.text();
    let body: any = raw;
    try {
      body = JSON.parse(raw);
    } catch {
      /* raw was a bare number like "19" */
    }

    const n =
      typeof body === "number"
        ? body
        : typeof body?.data === "number"
          ? body.data
          : typeof body?.data?.count === "number"
            ? body.data.count
            : typeof body?.count === "number"
              ? body.count
              : Number(raw);

    return Number.isFinite(n) ? Number(n) : 0;
  } catch (err) {
    console.warn("fetchActiveEmployeeCount failed:", err);
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* GET /api/dashboard/admin?month=current|last|mar|feb|jan|YYYY-MM            */
/* -------------------------------------------------------------------------- */

router.get("/admin", async (req: Request, res: Response) => {
  try {
    const monthKey = String(req.query.month ?? "current")
      .trim()
      .toLowerCase();

    const range = parseMonthKey(monthKey);
    if (!range) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid month. Use 'current', 'last', 'jan'..'dec', or 'YYYY-MM'.",
      });
    }

    const { from, to } = range;
    const monthLabel = monthLabelFromKey(monthKey, from);

    // Previous month range (for delta comparisons)
    const prevFrom = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1),
    );
    const prevTo = new Date(
      Date.UTC(
        prevFrom.getUTCFullYear(),
        prevFrom.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    );

    // For the trend chart, load the last 5 months (including target)
    const trendFrom = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 4, 1),
    );

    const [activeEmployees, currentTx, prevTx, trendTx] = await Promise.all([
      fetchActiveEmployeeCount(),

      prisma.transaction.findMany({
        where: {
          active: true,
          date: {
            gte: from.toISOString().slice(0, 10),
            lte: to.toISOString().slice(0, 10),
          },
        },
      }),

      prisma.transaction.findMany({
        where: {
          active: true,
          date: {
            gte: prevFrom.toISOString().slice(0, 10),
            lte: prevTo.toISOString().slice(0, 10),
          },
        },
      }),

      prisma.transaction.findMany({
        where: {
          active: true,
          date: {
            gte: trendFrom.toISOString().slice(0, 10),
            lte: to.toISOString().slice(0, 10),
          },
        },
      }),
    ]);

    // ---- Aggregate current month -----------------------------------------
    const deptTotals = new Map<string, { cost: number; meals: number }>();
    let totalCost = 0;
    let totalMeals = 0;

    for (const tx of currentTx) {
      const dept = tx.dept || "Unassigned";
      const cost = Number(tx.cost ?? 0);
      const qty = Number(tx.qty ?? 0);
      const isMeal = String(tx.type ?? "").toLowerCase() === "meal";

      if (!deptTotals.has(dept)) deptTotals.set(dept, { cost: 0, meals: 0 });
      const entry = deptTotals.get(dept)!;
      entry.cost += cost;
      if (isMeal) entry.meals += qty;

      totalCost += cost;
      totalMeals += isMeal ? qty : 1;
    }

    const deptData = Array.from(deptTotals.entries())
      .map(([name, v]) => ({ name, cost: v.cost }))
      .sort((a, b) => b.cost - a.cost);

    // Employees per department — query PCW Ride search per dept if available,
    // otherwise fall back to unique userIds seen in the current month.
    const employeesByDept = new Map<string, Set<string>>();
    for (const tx of currentTx) {
      if (!tx.userId) continue;
      const dept = tx.dept || "Unassigned";
      if (!employeesByDept.has(dept)) employeesByDept.set(dept, new Set());
      employeesByDept.get(dept)!.add(tx.userId);
    }

    const topDepartments = deptData.slice(0, 5).map((d) => {
      const meals = deptTotals.get(d.name)?.meals ?? 0;
      const employees = employeesByDept.get(d.name)?.size ?? 0;
      const status: "High" | "Normal" | "Low" =
        d.cost > 85000 ? "High" : d.cost > 35000 ? "Normal" : "Low";
      return {
        name: d.name,
        employees,
        meals,
        cost: `LKR ${d.cost.toLocaleString()}`,
        status,
      };
    });

    // ---- Previous month totals -------------------------------------------
    let prevCost = 0;
    let prevMeals = 0;
    for (const tx of prevTx) {
      const cost = Number(tx.cost ?? 0);
      const qty = Number(tx.qty ?? 0);
      const isMeal = String(tx.type ?? "").toLowerCase() === "meal";
      prevCost += cost;
      prevMeals += isMeal ? qty : 1;
    }

    // ---- Trend: last 5 months buckets ------------------------------------
    const trendBuckets = new Map<string, number>();
    for (let i = 4; i >= 0; i--) {
      const d = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1),
      );
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      trendBuckets.set(key, 0);
    }
    for (const tx of trendTx) {
      const key = dateStringToMonthKey(tx.date);
      if (trendBuckets.has(key)) {
        trendBuckets.set(
          key,
          (trendBuckets.get(key) ?? 0) + Number(tx.cost ?? 0),
        );
      }
    }
    const monthlyTrend = Array.from(trendBuckets.entries()).map(
      ([key, cost]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
          month: "short",
        });
        return { month: label, cost };
      },
    );

    return res.json({
      success: true,
      data: {
        monthKey,
        monthLabel,
        totalCost,
        prevCost,
        costChange: pctChange(totalCost, prevCost),
        costTrend: trendOf(totalCost, prevCost),
        totalMeals,
        mealChange: pctChange(totalMeals, prevMeals),
        activeEmployees,
        deptData,
        topDepartments,
        monthlyTrend,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("dashboard/admin error:", err);
    return res.status(502).json({
      success: false,
      message: "Could not build admin dashboard data",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/dashboard/user/:userId                                             */
/* -------------------------------------------------------------------------- */
router.get("/user/:userId", async (req: Request, res: Response) => {
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "userId is required" });
  }

  try {
    /* ------------------------------------------------------------------ */
    /* 1. Resolve user from PCW Ride                                       */
    /* ------------------------------------------------------------------ */
    const pcwUser = await fetchPcwUser(userId);
    if (!pcwUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const deptId = pcwUser.deptId; // <-- department id key
    if (!deptId) {
      return res.status(422).json({
        success: false,
        message: "User has no department assigned in PCW Ride",
      });
    }

    /* ------------------------------------------------------------------ */
    /* 2. Load reference data in parallel                                  */
    /* ------------------------------------------------------------------ */
    const today = todayISO(); // <- now Colombo date
    const now = nowHHMM(); // <- now Colombo HH:mm

    const [allMeals, deptQuotaMap, userTransactions, todayUserTx] =
      await Promise.all([
        prisma.meal.findMany({ where: { active: true } }),

        // department column stores the PCW Ride department id
        prisma.departmentQuotaMap.findFirst({
          where: { department: deptId, active: true },
          orderBy: { effectiveFrom: "desc" },
        }),

        // All transactions for this user (userId + departmentId both matched)
        prisma.transaction.findMany({
          where: {
            active: true,
            OR: [{ userId }, { departmentId: deptId, userId }],
          },
          orderBy: [{ date: "desc" }, { time: "desc" }],
        }),

        // Today's transactions for this user (used for taken counts)
        prisma.transaction.findMany({
          where: { userId, date: today, active: true },
        }),
      ]);

    /* ------------------------------------------------------------------ */
    /* 3. Classify meals                                                   */
    /* ------------------------------------------------------------------ */
    const mealBuckets = {
      past: [] as any[],
      current: [] as any[],
      next: [] as any[],
    };

    for (const meal of allMeals) {
      const from = timeToMinutes(meal.eligibleFrom);
      const to = timeToMinutes(meal.eligibleTo);
      const nowMin = timeToMinutes(now);

      const issued = todayUserTx.find(
        (t) =>
          (t.type === "ISSUE" || t.type === "MEAL") &&
          (t.item?.toLowerCase() === meal.name.toLowerCase() ||
            t.category?.toLowerCase() === meal.code?.toLowerCase()),
      );

      const base = {
        id: meal.id,
        code: meal.code,
        name: meal.name,
        cost: meal.cost,
        eligibleFrom: meal.eligibleFrom,
        eligibleTo: meal.eligibleTo,
      };

      if (issued) {
        mealBuckets.past.push({
          ...base,
          status: "taken",
          takenAt: `${issued.date} ${issued.time ?? ""}`.trim(),
        });
      } else if (nowMin >= from && nowMin <= to) {
        mealBuckets.current.push({ ...base, status: "eligible" });
      } else if (nowMin < from) {
        mealBuckets.next.push({ ...base, status: "upcoming" });
      } else {
        mealBuckets.past.push({ ...base, status: "missed" });
      }
    }

    mealBuckets.next.sort(
      (a, b) => timeToMinutes(a.eligibleFrom) - timeToMinutes(b.eligibleFrom),
    );

    /* ------------------------------------------------------------------ */
    /* 4. Quota view for the department                                    */
    /* ------------------------------------------------------------------ */
    let quotaItems: any[] = [];
    let quotaEffectiveFrom = "";

    if (deptQuotaMap) {
      const quota = await prisma.quota.findUnique({
        where: { id: deptQuotaMap.quotaId },
      });

      if (quota) {
        quotaEffectiveFrom = deptQuotaMap.effectiveFrom;

        let parsed: any[] = [];
        try {
          parsed = JSON.parse(quota.itemsJson);
          if (!Array.isArray(parsed)) parsed = [];
        } catch {
          parsed = [];
        }

        const itemIds = parsed
          .map((p) => p.itemId)
          .filter((x): x is string => typeof x === "string");

        const itemRows = itemIds.length
          ? await prisma.item.findMany({ where: { id: { in: itemIds } } })
          : [];
        const itemById = new Map(itemRows.map((i) => [i.id, i]));

        quotaItems = parsed.map((p) => {
          const meta = itemById.get(p.itemId);
          const eligibleQty = Number(p.qty ?? p.quantity ?? 0);
          const takenQty = todayUserTx
            .filter(
              (t) =>
                t.item === (p.itemName ?? meta?.name ?? "") ||
                t.item === p.itemId,
            )
            .reduce((sum, t) => sum + Number(t.qty ?? 0), 0);

          return {
            itemId: p.itemId,
            itemName: p.itemName ?? meta?.name ?? p.itemId,
            uom: p.uom ?? meta?.uom ?? "",
            eligibleQty,
            takenQty,
            remainingQty: Math.max(0, eligibleQty - takenQty),
          };
        });
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5. Summary + response                                               */
    /* ------------------------------------------------------------------ */
    const summary = {
      todayMealsIssued: mealBuckets.past.filter((m) => m.status === "taken")
        .length,
      todayMealsEligible: mealBuckets.current.length,
      totalTransactions: userTransactions.length,
    };

    return res.json({
      success: true,
      data: {
        user: {
          id: pcwUser.id,
          username: pcwUser.username,
          name: pcwUser.name,
          email: pcwUser.email,
          phone: pcwUser.phone,
          role: pcwUser.role,
          deptId: pcwUser.deptId, // <- key on id
          deptName: pcwUser.deptName, // <- display name
        },
        meals: mealBuckets,
        transactions: userTransactions.map((t) => ({
          id: t.id,
          date: t.date,
          time: t.time,
          dept: t.dept,
          departmentId: t.departmentId,
          item: t.item,
          qty: t.qty,
          cost: t.cost,
          type: t.type,
          category: t.category,
          canteenId: t.canteenId,
        })),
        quotas: {
          departmentId: deptId,
          departmentName: pcwUser.deptName,
          effectiveFrom: quotaEffectiveFrom,
          items: quotaItems,
        },
        summary,
      },
    });
  } catch (err) {
    console.error("dashboard/user/:userId error:", err);
    return res.status(502).json({
      success: false,
      message: "Could not build dashboard data",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/dashboard/canteen?canteenId=...&date=YYYY-MM-DD                   */
/* -------------------------------------------------------------------------- */
router.get("/canteen", async (req: Request, res: Response) => {
  try {
    const canteenId = String(req.query.canteenId ?? "").trim();
    const date = String(req.query.date ?? todayISO()).trim(); // defaults to today (Colombo)

    /* ------------------------------------------------------------------ */
    /* 1. Today's meal issued count (from Transaction)                    */
    /* ------------------------------------------------------------------ */
    // A "meal issued" is a Transaction of type MEAL (or ISSUE) that is active.
    // If canteenId is provided, scope to that canteen.
    const mealWhere: any = {
      active: true,
      date,
      type: { in: ["meal"] },
    };
    if (canteenId) mealWhere.canteenId = canteenId;

    const [mealTx, specialOrders] = await Promise.all([
      prisma.transaction.findMany({ where: mealWhere }),

      // All active special orders for the date window.
      // SpecialOrder has no date column, so we use createdAt range for the day.
      // If you add an `orderDate` column later, swap this filter.
      prisma.specialOrder.findMany({
        where: {
          active: true,
          createdAt: {
            gte: new Date(`${date}T00:00:00.000Z`),
            lt: new Date(`${date}T23:59:59.999Z`),
          },
        },
        include: { guests: { where: { active: true } } },
      }),
    ]);

    /* ------------------------------------------------------------------ */
    /* 2. Aggregate meal issued count                                     */
    /* ------------------------------------------------------------------ */
    // Count each meal transaction by qty (fallback to 1 per row).
    const mealIssuedCount = mealTx.reduce(
      (sum, t) => sum + Number(t.qty ?? 1),
      0,
    );
    const mealTransactionRows = mealTx.length;
    const mealCost = mealTx.reduce((sum, t) => sum + Number(t.cost ?? 0), 0);

    /* ------------------------------------------------------------------ */
    /* 3. Special order aggregates                                       */
    /* ------------------------------------------------------------------ */
    const totalSpecialOrders = specialOrders.length;

    // "Issued" = at least one guest released, i.e. releasedCount > 0.
    // (If you prefer partial semantics, this counts orders with any release.)
    const issuedSpecialOrders = specialOrders.filter(
      (o) => Number(o.releasedCount ?? 0) > 0,
    ).length;

    const pendingSpecialOrders = totalSpecialOrders - issuedSpecialOrders;

    // Guest-level rollup (useful for the canteen to know headcount)
    const totalGuests = specialOrders.reduce(
      (sum, o) => sum + Number(o.count ?? 0),
      0,
    );
    const releasedGuests = specialOrders.reduce(
      (sum, o) => sum + Number(o.releasedCount ?? 0),
      0,
    );

    // Per-order breakdown (handy for a table on the canteen screen)
    const specialOrderBreakdown = specialOrders
      .map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        requesterName: o.requesterName,
        departmentName: o.departmentName,
        mealName: o.mealName,
        count: o.count,
        releasedCount: o.releasedCount,
        remainingCount: Math.max(0, o.count - o.releasedCount),
        status:
          o.releasedCount >= o.count
            ? "issued"
            : o.releasedCount > 0
              ? "partial"
              : "pending",
        guestRange:
          o.guestRangeStart && o.guestRangeEnd
            ? `${o.guestRangeStart}–${o.guestRangeEnd}`
            : null,
      }))
      .sort((a, b) => a.orderNo.localeCompare(b.orderNo));

    /* ------------------------------------------------------------------ */
    /* 4. Response                                                        */
    /* ------------------------------------------------------------------ */
    return res.json({
      success: true,
      data: {
        date,
        canteenId: canteenId || null,

        meals: {
          issuedCount: mealIssuedCount,
          transactionRows: mealTransactionRows,
          totalCost: mealCost,
        },

        specialOrders: {
          totalOrders: totalSpecialOrders,
          total: totalGuests,
          // issued: issuedSpecialOrders,
          issued: releasedGuests,
          // pending: pendingSpecialOrders,
          pending: totalGuests - releasedGuests,
          totalGuests,
          releasedGuests,
          breakdown: specialOrderBreakdown,
        },

        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("dashboard/canteen error:", err);
    return res.status(502).json({
      success: false,
      message: "Could not build canteen dashboard data",
    });
  }
});

export const dashboardRouter = router;
