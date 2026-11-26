/**
 * ============================================================================
 * Transaction & Issuing Routes (/api/transactions)
 * ============================================================================
 * item = meal ID verbatim. dept / departmentId / userName come from the
 * frontend payload, with the resolved user record as fallback.
 */

import { Router, Request, Response } from "express";
import {
  getTransactions,
  createTransaction,
  getUserById,
  getUsers,
  getMeals,
  getItems,
  getDailyBatches,
  updateDailyBatch,
  getInventory,
  updateInventory,
  getDeptBalances,
  setDeptBalance,
  type TransactionRecord,
} from "../db/store";
import { nowInColombo, isInWindow, hasReceivedMealToday } from "./meals";

const router = Router();

async function resolveUser(raw: string): Promise<any | null> {
  const k = String(raw ?? "").trim();
  if (!k) return null;
  const stripped = k.replace(/^emp[-\s]?/i, "");
  const candidates = [
    k, k.toUpperCase(), k.toLowerCase(),
    stripped, stripped.toUpperCase(), stripped.toLowerCase(),
    `EMP-${stripped}`, `EMP-${stripped}`.toUpperCase(),
    `EMP${stripped}`, `EMP${stripped}`.toUpperCase(),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const hit = await getUserById(c);
    if (hit) return hit;
  }
  try {
    const all = await getUsers();
    const needle = stripped.toLowerCase();
    const hit = all.find((u: any) => {
      const keys = [u.id, u.biometricCardNo, u.employeeNo, u.username]
        .filter(Boolean)
        .map((v: any) => String(v).toLowerCase());
      return keys.some((v) => v === needle || v === k.toLowerCase());
    });
    if (hit) return hit;
  } catch { /* ignore */ }
  return null;
}

// GET /api/transactions
router.get("/", async (req: Request, res: Response) => {
  try {
    const { type, dept, month, limit = 50 } = req.query;
    let list = await getTransactions();

    if (type) list = list.filter((x) => x.type.toLowerCase() === String(type).toLowerCase());
    if (dept) list = list.filter((x) => x.dept.toLowerCase() === String(dept).toLowerCase());
    if (month) list = list.filter((x) => x.date.startsWith(String(month)));

    list.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
    list.reverse();

    res.json({ success: true, data: list.slice(0, Number(limit)), total: list.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/transactions/recent-meals
router.get("/recent-meals", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit ?? 10);
    const { date: today } = nowInColombo();
    const [allTx, meals] = await Promise.all([getTransactions(), getMeals()]);
    const mealById = new Map(meals.map((m) => [m.id, m] as const));
    const mealByName = new Map(meals.map((m) => [m.name.toLowerCase(), m] as const));

    const rows = allTx
      .filter((t) =>
        t.type.toLowerCase() === "meal" &&
        t.date === today &&
        String((t as any).status ?? "").toUpperCase() !== "VOID",
      )
      .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""))
      .slice(0, limit)
      .map((t) => {
        const itemRaw = String(t.item ?? "").trim();
        const meal = mealById.get(itemRaw) ?? mealByName.get(itemRaw.toLowerCase()) ?? null;
        return {
          id: t.id,
          time: t.time ?? "",
          user: t.userName ?? t.userId ?? "—",
          userId: t.userId ?? "",
          dept: t.dept || "—",
          departmentId: (t as any).departmentId ?? "",
          mealId: meal?.id ?? itemRaw,
          meal: meal?.name ?? itemRaw,
          cost: Number(t.cost),
        };
      });

    res.json({ success: true, date: today, data: rows, total: rows.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/transactions/issue-meal
router.post("/issue-meal", async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      mealId,
      canteenId = "1",
      dept: payloadDept,
      departmentId: payloadDepartmentId,
      userName: payloadUserName,
    } = req.body ?? {};

    if (!employeeId || !mealId) {
      return res.status(400).json({ success: false, message: "employeeId and mealId are required" });
    }

    const employeeKey = String(employeeId).trim();

    const meals = await getMeals();
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) {
      return res.status(404).json({ success: false, message: "Meal not found in catalog" });
    }

    const user = await resolveUser(employeeKey);

    const finalDept =
      (typeof payloadDept === "string" && payloadDept.trim()) ||
      (user?.dept as string | undefined) ||
      "";
    const finalUserName =
      (typeof payloadUserName === "string" && payloadUserName.trim()) ||
      (user?.name as string | undefined) ||
      "";
    const finalDepartmentId =
      payloadDepartmentId !== undefined && payloadDepartmentId !== null && String(payloadDepartmentId).trim() !== ""
        ? String(payloadDepartmentId)
        : user?.departmentId !== undefined && user?.departmentId !== null
          ? String(user.departmentId)
          : null;

    if (!finalUserName || !finalDept) {
      return res.status(400).json({
        success: false,
        message: "Cannot determine employee name/department. Send userName & dept in the request body, or ensure the user exists in the system.",
      });
    }

    const canonicalUserId = user?.id ? String(user.id) : employeeKey;

    const { time: currentTime, date: today } = nowInColombo();
    if (!isInWindow(currentTime, meal.eligibleFrom, meal.eligibleTo)) {
      return res.status(409).json({
        success: false,
        message: `"${meal.name}" is not available right now (window ${meal.eligibleFrom}–${meal.eligibleTo} Sri Lanka time).`,
      });
    }

    const allTx = await getTransactions();
    if (hasReceivedMealToday(allTx, canonicalUserId, meal, today)) {
      return res.status(409).json({
        success: false,
        message: `This employee has already received "${meal.name}" today.`,
      });
    }

    const tx: TransactionRecord = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: today,
      time: currentTime,
      dept: finalDept,
      departmentId: finalDepartmentId,  // ← NEW
      item: meal.id,
      qty: 1,
      cost: meal.cost,
      type: "meal",
      userId: canonicalUserId,
      userName: finalUserName,
      canteenId,
    } as TransactionRecord;

    const created = await createTransaction(tx);

    res.status(201).json({
      success: true,
      data: {
        ...created,
        mealName: meal.name,
        userName: finalUserName,
        dept: finalDept,
        departmentId: finalDepartmentId,
      },
      message: `Meal ${meal.name} issued successfully to ${finalUserName}`,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/transactions/issue-snack — unchanged except tx carries departmentId if given
router.post("/issue-snack", async (req: Request, res: Response) => {
  try {
    const {
      department,
      departmentId,
      userId,
      selections,
      canteenId = "1",
    } = req.body;

    if (!department || !selections || typeof selections !== "object") {
      return res.status(400).json({ success: false, message: "department and selections dictionary required" });
    }

    const selectedEntries = Object.entries(selections).filter(([, qty]) => Number(qty) > 0);
    if (selectedEntries.length === 0) {
      return res.status(400).json({ success: false, message: "Please select at least one item quantity > 0" });
    }

    const [items, batches, inventory, balances] = await Promise.all([
      getItems(), getDailyBatches(), getInventory(), getDeptBalances(),
    ]);

    for (const [itemId, qty] of selectedEntries) {
      const numQty = Number(qty);
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      const isReadyMade = item.category === "ready-made";
      if (isReadyMade) {
        const batch = batches.find((b) => b.itemId === itemId);
        if (!batch) return res.status(400).json({ success: false, message: `${item.name} has not arrived in today's fresh delivery.` });
        if (batch.status === "cleared") return res.status(400).json({ success: false, message: `Today's batch of ${item.name} was cleared at closing.` });
        if (batch.remainingQty < numQty) return res.status(400).json({ success: false, message: `Only ${batch.remainingQty} units of ${item.name} available.` });
      } else {
        const currentQuota = balances[department]?.[itemId] ?? 25;
        if (currentQuota < numQty) return res.status(400).json({ success: false, message: `Insufficient quota for ${item.name}. ${department} department has ${currentQuota} remaining.` });
      }
    }

    const createdTransactions: TransactionRecord[] = [];
    const { time: currentTime, date: currentDate } = nowInColombo();

    const workingBalances: Record<string, Record<string, number>> = {
      ...balances,
      [department]: { ...(balances[department] ?? {}) },
    };
    const workingBatches = new Map(batches.map((b) => [b.id, { ...b }]));
    const workingInventory = new Map(inventory.map((i) => [i.id, { ...i }]));

    for (const [itemId, qty] of selectedEntries) {
      const numQty = Number(qty);
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      const isReadyMade = item.category === "ready-made";

      if (isReadyMade) {
        const batch = [...workingBatches.values()].find((b) => b.itemId === itemId);
        if (batch) {
          const nextIssued = batch.issuedQty + numQty;
          const nextRemaining = Math.max(0, batch.remainingQty - numQty);
          const nextStatus = nextRemaining === 0 ? "sold-out" : nextRemaining <= 5 ? "low" : batch.status;
          await updateDailyBatch(batch.id, { issuedQty: nextIssued, remainingQty: nextRemaining, status: nextStatus });
          batch.issuedQty = nextIssued;
          batch.remainingQty = nextRemaining;
          batch.status = nextStatus as typeof batch.status;
        }
      } else {
        const current = workingBalances[department]?.[itemId] ?? 25;
        const nextQuota = Math.max(0, current - numQty);
        workingBalances[department][itemId] = nextQuota;
        const inv = [...workingInventory.values()].find((i) => i.itemId === itemId);
        if (inv) {
          const nextStock = Math.max(0, inv.stock - numQty);
          const nextStatus = nextStock <= inv.minLevel ? "Low" : "Good";
          await updateInventory(inv.id, { stock: nextStock, status: nextStatus });
          inv.stock = nextStock;
          inv.status = nextStatus as typeof inv.status;
        }
      }

      const tx: TransactionRecord = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: currentDate,
        time: currentTime,
        dept: department,
        departmentId: departmentId != null && String(departmentId).trim() !== "" ? String(departmentId) : null,
        item: item.id,
        qty: numQty,
        cost: item.price * numQty,
        type: "snack",
        category: item.category || "stock-keeping",
        userId: userId || `EMP-${department.slice(0, 3).toUpperCase()}-REP`,
        userName: `${department} Department`,
        canteenId,
      } as TransactionRecord;

      const created = await createTransaction(tx);
      createdTransactions.push(created);
    }

    await setDeptBalance(department, workingBalances[department]);

    res.status(201).json({
      success: true,
      data: createdTransactions,
      message: `Successfully issued ${createdTransactions.length} snack types to ${department}`,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;