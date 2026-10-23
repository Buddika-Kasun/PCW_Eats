/**
 * ============================================================================
 * Reporting & Analytics Routes (/api/reports) — Prisma/PostgreSQL
 * ============================================================================
 * Aggregates operational data for the Admin Dashboard and Reports views.
 * Supports multi-month breakdown, department cost ranking, and export formatting.
 */

import { Router, Request, Response } from "express";
import { getTransactions, getUsers, getDeptBalances } from "../db/store";

const router = Router();

/**
 * The frontend's month selector sends keys like "current", "last", "mar",
 * "feb", "jan". We map each to a YYYY-MM prefix used to filter transactions
 * that already exist in the database. Months without data fall back to the
 * original hard-coded baseline numbers so the UI still renders.
 */
const MONTHLY_CONFIG: Record<
  string,
  {
    label: string;
    prefix: string;
    fallbackTotalCost: number;
    fallbackPrevCost: number;
    fallbackTotalMeals: number;
    fallbackActiveEmployees: number;
  }
> = {
  current: {
    label: "Current Month",
    prefix: "2024-04",
    fallbackTotalCost: 242000,
    fallbackPrevCost: 210000,
    fallbackTotalMeals: 1240,
    fallbackActiveEmployees: 450,
  },
  last: {
    label: "Last Month",
    prefix: "2024-03",
    fallbackTotalCost: 210000,
    fallbackPrevCost: 195000,
    fallbackTotalMeals: 1080,
    fallbackActiveEmployees: 440,
  },
  mar: {
    label: "March",
    prefix: "2024-03",
    fallbackTotalCost: 195000,
    fallbackPrevCost: 215000,
    fallbackTotalMeals: 990,
    fallbackActiveEmployees: 435,
  },
  feb: {
    label: "February",
    prefix: "2024-02",
    fallbackTotalCost: 215000,
    fallbackPrevCost: 180000,
    fallbackTotalMeals: 1120,
    fallbackActiveEmployees: 430,
  },
  jan: {
    label: "January",
    prefix: "2024-01",
    fallbackTotalCost: 180000,
    fallbackPrevCost: 175000,
    fallbackTotalMeals: 920,
    fallbackActiveEmployees: 420,
  },
};

/**
 * GET /api/reports/dashboard?month=current
 * Aggregated stats for the selected month. Response shape matches the original
 * in-memory implementation so the Admin Dashboard needs no changes.
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const monthKey = String(req.query.month ?? "current");
    const cfg = MONTHLY_CONFIG[monthKey] ?? MONTHLY_CONFIG.current;

    // Pull real transactions for the month; fall back to baseline aggregates
    // when the database has no rows for that month.
    const transactions = await getTransactions();
    const monthTx = transactions.filter((t) => t.date.startsWith(cfg.prefix));

    const actualTotalCost = monthTx.reduce((s, t) => s + t.cost, 0);
    const actualTotalMeals = monthTx.filter((t) => t.type === "meal").length;

    const totalCost =
      monthTx.length > 0 ? actualTotalCost : cfg.fallbackTotalCost;
    const totalMeals =
      monthTx.length > 0 ? actualTotalMeals : cfg.fallbackTotalMeals;
    const activeEmployees = cfg.fallbackActiveEmployees; // not derivable from transactions alone
    const prevCost = cfg.fallbackPrevCost; // no prior-month lookup yet

    // Per-department cost, computed from real transactions when present,
    // otherwise split by the original static ratios.
    let deptCosts: Record<string, number>;
    if (monthTx.length > 0) {
      deptCosts = monthTx.reduce<Record<string, number>>((acc, t) => {
        acc[t.dept] = (acc[t.dept] ?? 0) + t.cost;
        return acc;
      }, {});
    } else {
      deptCosts = {
        Production: Math.round(totalCost * 0.4),
        Logistics: Math.round(totalCost * 0.22),
        IT: Math.round(totalCost * 0.18),
        HR: Math.round(totalCost * 0.11),
        Finance: Math.round(totalCost * 0.09),
      };
    }

    const deptData = Object.entries(deptCosts).map(([name, cost]) => ({
      name,
      cost,
    }));

    // Top departments table. Employee counts and meal shares stay as before
    // (the seed has no per-department employee roster here).
    const topDepartments = [
      {
        name: "Production",
        employees: 240,
        meals: Math.round(totalMeals * 0.55),
        cost: `LKR ${(deptCosts.Production ?? 0).toLocaleString()}`,
        status: "High",
      },
      {
        name: "Logistics",
        employees: 85,
        meals: Math.round(totalMeals * 0.2),
        cost: `LKR ${(deptCosts.Logistics ?? 0).toLocaleString()}`,
        status: "Normal",
      },
      {
        name: "IT",
        employees: 45,
        meals: Math.round(totalMeals * 0.13),
        cost: `LKR ${(deptCosts.IT ?? 0).toLocaleString()}`,
        status: "Normal",
      },
      {
        name: "HR",
        employees: 30,
        meals: Math.round(totalMeals * 0.07),
        cost: `LKR ${(deptCosts.HR ?? 0).toLocaleString()}`,
        status: "Low",
      },
      {
        name: "Finance",
        employees: 25,
        meals: Math.round(totalMeals * 0.05),
        cost: `LKR ${(deptCosts.Finance ?? 0).toLocaleString()}`,
        status: "Low",
      },
    ];

    res.json({
      success: true,
      data: {
        monthKey,
        monthLabel: cfg.label,
        totalCost,
        prevCost,
        costChange: "+15.2%",
        costTrend: "up",
        totalMeals,
        mealChange: "+8.1%",
        activeEmployees,
        deptData,
        topDepartments,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

/**
 * GET /api/reports/monthly?month=2024-04
 * Raw month breakdown used by the Reports view and CSV export.
 */
router.get("/monthly", async (req: Request, res: Response) => {
  try {
    const month = String(
      req.query.month ?? new Date().toISOString().slice(0, 7),
    );
    const all = await getTransactions();
    const inMonth = all.filter((t) => t.date.startsWith(month));

    const byDept: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let total = 0;
    for (const t of inMonth) {
      byDept[t.dept] = (byDept[t.dept] ?? 0) + t.cost;
      byType[t.type] = (byType[t.type] ?? 0) + t.cost;
      total += t.cost;
    }

    res.json({
      success: true,
      month,
      total,
      byDept,
      byType,
      count: inMonth.length,
      transactions: inMonth,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

/**
 * GET /api/reports/summary
 * Lightweight overall stats for widgets.
 */
router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const [tx, balances] = await Promise.all([
      getTransactions(),
      getDeptBalances(),
    ]);
    const totalCost = tx.reduce((s, t) => s + t.cost, 0);
    const totalQty = tx.reduce((s, t) => s + t.qty, 0);

    res.json({
      success: true,
      totalTransactions: tx.length,
      totalCost,
      totalQty,
      deptBalances: balances,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

/**
 * GET /api/reports/users - Employee directory for assignment and verification.
 */
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await getUsers();
    res.json({ success: true, data: users, total: users.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
