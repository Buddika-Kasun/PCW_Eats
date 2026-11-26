/**
 * ============================================================================
 * Meal Management Routes (/api/meals)
 * ============================================================================
 * Time: Asia/Colombo (Sri Lanka, UTC+05:30).
 * `transactions.item` for meals stores the MEAL ID (e.g. "mel-1794…") verbatim.
 * Duplicate check matches user canonical key + meal id (legacy: meal name).
 */

import { Router, Request, Response } from "express";
import {
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  getTransactions,
} from "../db/store";
import { Meal } from "../../src/types";

const router = Router();
const TIME_ZONE = "Asia/Colombo";

function actorOf(req: Request): string | null {
  const u = req.user;
  if (!u) return null;
  return String(u.id ?? u.username ?? u.email ?? "") || null;
}

export function nowInColombo(): { time: string; date: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const hour = g("hour") === "24" ? "00" : g("hour");
  return {
    time: `${hour}:${g("minute")}`,
    date: `${g("year")}-${g("month")}-${g("day")}`,
  };
}

export function isInWindow(now: string, from: string, to: string): boolean {
  if (!from || !to) return false;
  if (from <= to) return now >= from && now <= to;
  return now >= from || now <= to;
}

/** "27" / "EMP-027" / " emp-27 " → "27". Used for dedupe only. */
export function canonicalUserKey(raw: string | undefined | null): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^emp[-\s]?/, "")
    .replace(/^0+(?=\d)/, "");
}

function canonicalMealName(s: string | undefined | null): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function hasReceivedMealToday(
  tx: Array<{
    userId?: string;
    date: string;
    type: string;
    item: string;
    status?: string;
  }>,
  userId: string,
  meal: { id: string; name: string },
  today: string,
): boolean {
  const targetUser = canonicalUserKey(userId);
  const targetName = canonicalMealName(meal.name);

  return tx.some((t) => {
    if (String(t.type).toLowerCase() !== "meal") return false;
    if (t.date !== today) return false;
    if (String(t.status ?? "").toUpperCase() === "VOID") return false;
    if (canonicalUserKey(t.userId) !== targetUser) return false;
    const itemRaw = String(t.item ?? "").trim();
    // Prefer meal id match; fall back to legacy rows that stored meal name.
    return itemRaw === meal.id || canonicalMealName(itemRaw) === targetName;
  });
}

// GET /api/meals
router.get("/", async (_req: Request, res: Response) => {
  try {
    const meals = await getMeals();
    res.json({ success: true, data: meals, total: meals.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/meals/active?userId=...&excludeIssued=true
router.get("/active", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? String(req.query.userId).trim() : "";
    const excludeIssued = String(req.query.excludeIssued ?? "") === "true";

    const { time: currentTime, date: today } = nowInColombo();
    const meals = await getMeals();

    const activeMeals = meals.filter((m) =>
      isInWindow(currentTime, m.eligibleFrom, m.eligibleTo),
    );

    if (!userId) {
      return res.json({
        success: true,
        currentTime,
        timezone: TIME_ZONE,
        data: activeMeals,
        reason:
          activeMeals.length === 0
            ? "No meal window is currently open."
            : undefined,
      });
    }

    const allTx = await getTransactions();

    const withFlags = activeMeals.map((m) => ({
      ...m,
      alreadyIssued: hasReceivedMealToday(allTx, userId, m, today),
    }));

    const filtered = excludeIssued
      ? withFlags.filter((m) => !m.alreadyIssued)
      : withFlags;

    let reason: string | undefined;
    if (activeMeals.length === 0) {
      reason = "No meal window is currently open.";
    } else if (filtered.length === 0 && excludeIssued) {
      reason = "This employee has already received " + activeMeals.map((m) => m.name).join(", ") + " today.";
    }

    res.json({
      success: true,
      currentTime,
      timezone: TIME_ZONE,
      data: filtered,
      reason,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST / PUT / DELETE
router.post("/", async (req: Request, res: Response) => {
  try {
    const { code, name, cost, eligibleFrom, eligibleTo } = req.body;
    if (!code || !name || cost === undefined || !eligibleFrom || !eligibleTo) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }
    const actor = actorOf(req);
    const newMeal: Meal = {
      id: `mel-${Date.now()}`,
      code,
      name,
      cost: Number(cost),
      eligibleFrom,
      eligibleTo,
      createdBy: actor ?? undefined,
      updatedBy: actor ?? undefined,
    } as Meal;
    const created = await createMeal(newMeal);
    res.status(201).json({
      success: true,
      data: created,
      message: "Meal registered successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const updated = await updateMeal(req.params.id, {
      ...req.body,
      id: req.params.id,
      updatedBy: actorOf(req) ?? undefined,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Meal not found" });
    }
    res.json({
      success: true,
      data: updated,
      message: "Meal updated successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const meals = await getMeals();
    const existing = meals.find((m) => m.id === req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Meal not found" });
    }
    const ok = await deleteMeal(req.params.id);
    if (!ok) {
      return res
        .status(404)
        .json({ success: false, message: "Meal not found" });
    }
    res.json({
      success: true,
      data: existing,
      message: "Meal removed successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
