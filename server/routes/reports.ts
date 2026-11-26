/**
 * ============================================================================
 * Reports Routes (/api/reports)
 * ============================================================================
 *   GET /api/reports/transactions?type=snack|meal&dept=...&canteenId=...&range=current|last|last3|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   GET /api/reports/inventory
 *   GET /api/reports/departments
 *   GET /api/reports/export?type=...&dept=...&canteenId=...&range=...&from=...&to=...
 *
 * Behaviour:
 *  - Transaction `item` column stores an ID (mel-... / itm-...). This router
 *    resolves those IDs to human-readable names/codes/uoms via batch lookups
 *    against the `meals` and `items` tables.
 *  - Departments come from the union of Transaction.dept + PCW Ride.
 *  - Export streams CSV with the same enrichment.
 * ============================================================================
 */

import { Router, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { PCW_RIDE_API_URL } from "../config";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

type RangeKey = "current" | "last" | "last3" | "custom";

interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseRange(
  range: RangeKey,
  from?: string,
  to?: string,
): DateRange | null {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  if (range === "current") {
    return {
      from: isoDate(new Date(Date.UTC(y, m, 1))),
      to: isoDate(new Date(Date.UTC(y, m + 1, 0))),
    };
  }
  if (range === "last") {
    return {
      from: isoDate(new Date(Date.UTC(y, m - 1, 1))),
      to: isoDate(new Date(Date.UTC(y, m, 0))),
    };
  }
  if (range === "last3") {
    return {
      from: isoDate(new Date(Date.UTC(y, m - 2, 1))),
      to: isoDate(new Date(Date.UTC(y, m + 1, 0))),
    };
  }
  if (
    from &&
    to &&
    /^\d{4}-\d{2}-\d{2}$/.test(from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return { from, to };
  }
  return null;
}

function normaliseType(raw?: string): "snack" | "meal" | null {
  const t = String(raw ?? "").toLowerCase();
  if (t === "snack" || t === "snacks") return "snack";
  if (t === "meal" || t === "meals") return "meal";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Enrich transactions: resolve item IDs → human-readable names                */
/* -------------------------------------------------------------------------- */

interface RawTxRow {
  id: string;
  date: string;
  time: string | null;
  dept: string;
  departmentId: string | null;
  item: string;
  qty: number;
  cost: number;
  type: string;
  category: string | null;
  userId: string | null;
  userName: string | null;
  canteenId: string | null;
}

interface EnrichedRow {
  id: string;
  date: string;
  time?: string | null;
  dept: string;
  departmentId?: string | null;
  itemId: string;
  item: string;
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

async function enrichTransactions(rows: RawTxRow[]): Promise<EnrichedRow[]> {
  if (rows.length === 0) return [];

  const mealIds = new Set<string>();
  const itemIds = new Set<string>();

  for (const r of rows) {
    const rawId = (r.item ?? "").trim();
    if (!rawId) continue;
    const t = String(r.type ?? "").toLowerCase();
    if (t === "meal" || rawId.startsWith("mel-")) {
      mealIds.add(rawId);
    } else if (t === "snack" || t === "item" || rawId.startsWith("itm-")) {
      itemIds.add(rawId);
    } else {
      // Unknown type — try both lookups to be safe
      mealIds.add(rawId);
      itemIds.add(rawId);
    }
  }

  const canteenIds = new Set<string>(
    rows.map((r) => r.canteenId).filter((x): x is string => Boolean(x)),
  );

  const [mealRows, itemRows, canteenRows] = await Promise.all([
    mealIds.size
      ? prisma.meal.findMany({
          where: { id: { in: Array.from(mealIds) } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([] as { id: string; code: string; name: string }[]),

    itemIds.size
      ? prisma.item.findMany({
          where: { id: { in: Array.from(itemIds) } },
          select: { id: true, code: true, name: true, uom: true },
        })
      : Promise.resolve(
          [] as { id: string; code: string; name: string; uom: string }[],
        ),

    canteenIds.size
      ? prisma.canteen.findMany({
          where: { id: { in: Array.from(canteenIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const mealById = new Map(mealRows.map((m) => [m.id, m]));
  const itemById = new Map(itemRows.map((i) => [i.id, i]));
  const canteenById = new Map(canteenRows.map((c) => [c.id, c]));

  return rows.map((r) => {
    const rawId = (r.item ?? "").trim();
    const meal = mealById.get(rawId);
    const item = itemById.get(rawId);

    const resolvedName = meal?.name ?? item?.name ?? rawId;
    const resolvedCode = meal?.code ?? item?.code ?? null;
    const resolvedUom = item?.uom ?? null;

    return {
      id: r.id,
      date: r.date,
      time: r.time,
      dept: r.dept,
      departmentId: r.departmentId,
      itemId: rawId,
      item: resolvedName,
      itemCode: resolvedCode,
      uom: resolvedUom,
      qty: r.qty,
      cost: r.cost,
      type: r.type,
      category: r.category,
      userId: r.userId,
      userName: r.userName,
      canteenId: r.canteenId,
      canteenName: r.canteenId
        ? (canteenById.get(r.canteenId)?.name ?? null)
        : null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* GET /api/reports/transactions                                               */
/* -------------------------------------------------------------------------- */
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const type = normaliseType(req.query.type as string | undefined);
    const dept = String(req.query.dept ?? "").trim();
    const canteenId = String(req.query.canteenId ?? "").trim();
    const rangeKey = String(
      req.query.range ?? "current",
    ).toLowerCase() as RangeKey;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;

    const range = parseRange(rangeKey, from, to);
    if (!range) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid range. Use current | last | last3 | custom (with from & to).",
      });
    }

    const where: any = {
      active: true,
      date: { gte: range.from, lte: range.to },
    };
    if (type) where.type = { in: [type, type.toUpperCase()] };
    if (dept) where.dept = dept;
    if (canteenId) where.canteenId = canteenId;

    const rows = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { time: "desc" }],
    });

    const enriched = await enrichTransactions(
      rows.map((t) => ({
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
        userId: t.userId,
        userName: t.userName,
        canteenId: t.canteenId,
      })),
    );

    const totalCost = enriched.reduce((s, t) => s + Number(t.cost ?? 0), 0);
    const totalQty = enriched.reduce((s, t) => s + Number(t.qty ?? 0), 0);

    return res.json({
      success: true,
      data: enriched,
      meta: {
        range: rangeKey,
        from: range.from,
        to: range.to,
        type: type ?? null,
        dept: dept || null,
        canteenId: canteenId || null,
        count: enriched.length,
        totalCost,
        totalQty,
      },
    });
  } catch (err) {
    console.error("reports/transactions error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not load transactions" });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/reports/inventory                                                  */
/* -------------------------------------------------------------------------- */
router.get("/inventory", async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.inventory.findMany({
      where: { active: true },
      orderBy: { item: "asc" },
    });
    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    console.error("reports/inventory error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not load inventory" });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/reports/departments                                                */
/* -------------------------------------------------------------------------- */
router.get("/departments", async (_req: Request, res: Response) => {
  try {
    const txDepts = await prisma.transaction.findMany({
      where: { active: true },
      select: { dept: true },
      distinct: ["dept"],
    });
    const names = new Set<string>(
      txDepts.map((d) => (d.dept || "").trim()).filter(Boolean),
    );

    try {
      const r = await fetch(`${PCW_RIDE_API_URL}/department/get-eats`, {
        headers: { Accept: "application/json" },
      });
      if (r.ok) {
        const body: any = await r.json();
        const arr: any[] = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.data?.departments)
            ? body.data.departments
            : Array.isArray(body)
              ? body
              : [];
        for (const d of arr) {
          const name = d?.name ?? d?.departmentName ?? d?.title;
          if (typeof name === "string" && name.trim()) {
            names.add(name.trim());
          }
        }
      }
    } catch {
      /* PCW Ride unreachable — tx-derived names still work */
    }

    const departments = Array.from(names).sort((a, b) => a.localeCompare(b));

    return res.json({ success: true, data: departments });
  } catch (err) {
    console.error("reports/departments error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not load departments" });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/reports/export                                                     */
/* -------------------------------------------------------------------------- */
router.get("/export", async (req: Request, res: Response) => {
  try {
    const type = normaliseType(req.query.type as string | undefined);
    const dept = String(req.query.dept ?? "").trim();
    const canteenId = String(req.query.canteenId ?? "").trim();
    const rangeKey = String(
      req.query.range ?? "current",
    ).toLowerCase() as RangeKey;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;

    const range = parseRange(rangeKey, from, to);
    if (!range) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid date range" });
    }

    const where: any = {
      active: true,
      date: { gte: range.from, lte: range.to },
    };
    if (type) where.type = { in: [type, type.toUpperCase()] };
    if (dept) where.dept = dept;
    if (canteenId) where.canteenId = canteenId;

    const rows = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { time: "desc" }],
    });

    const enriched = await enrichTransactions(
      rows.map((t) => ({
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
        userId: t.userId,
        userName: t.userName,
        canteenId: t.canteenId,
      })),
    );

    const header = [
      "Date",
      "Time",
      "Department",
      "Item Code",
      "Item Name",
      "UOM",
      "Qty",
      "Cost (LKR)",
      "Type",
      "Category",
      "Canteen",
      "User",
    ].join(",");

    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const body = enriched
      .map((t) =>
        [
          t.date,
          t.time ?? "",
          t.dept,
          t.itemCode ?? "",
          t.item,
          t.uom ?? "",
          t.qty,
          t.cost,
          t.type,
          t.category ?? "",
          t.canteenName ?? t.canteenId ?? "",
          t.userName ?? t.userId ?? "",
        ]
          .map(escape)
          .join(","),
      )
      .join("\n");

    const filename = `canteen_report_${type ?? "all"}_${rangeKey}_${range.from}_to_${range.to}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(`${header}\n${body}`);
  } catch (err) {
    console.error("reports/export error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not export report" });
  }
});

export const reportsRouter = router;
