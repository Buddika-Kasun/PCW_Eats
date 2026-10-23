/**
 * ============================================================================
 * Transaction & Issuing Routes (/api/transactions) — Prisma/PostgreSQL
 * ============================================================================
 * Core POS operational engine for:
 * 1. Issuing Meals:
 *    - Captures employee number (from ZKTeco MB360 fingerprint scan or manual entry)
 *    - Verifies eligible meal window
 *    - Records meal transaction
 *
 * 2. Issuing Snacks:
 *    - Ready-made items: verifies daily fresh batch, deducts batch balance (no quota deduction)
 *    - Stock-keeping items: verifies department quota, deducts department balance & inventory
 */

import { Router, Request, Response } from "express";
import {
  getTransactions,
  createTransaction,
  getUserById,
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

const router = Router();

// GET /api/transactions - Query transactions (?type=&dept=&month=&limit=)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { type, dept, month, limit = 50 } = req.query;

    let list = await getTransactions();

    if (type) {
      const t = String(type).toLowerCase();
      list = list.filter((x) => x.type.toLowerCase() === t);
    }
    if (dept) {
      const d = String(dept).toLowerCase();
      list = list.filter((x) => x.dept.toLowerCase() === d);
    }
    if (month) {
      list = list.filter((x) => x.date.startsWith(String(month)));
    }

    // Newest first — replicates the old `unshift` semantics.
    list.sort((a, b) =>
      (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
    );
    list.reverse();

    res.json({
      success: true,
      data: list.slice(0, Number(limit)),
      total: list.length,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/transactions/issue-meal - Issue meal to employee
router.post("/issue-meal", async (req: Request, res: Response) => {
  try {
    const { employeeId, mealId, canteenId = "1" } = req.body;

    if (!employeeId || !mealId) {
      return res.status(400).json({
        success: false,
        message: "employeeId and mealId are required",
      });
    }

    const employeeKey = String(employeeId).trim();

    // Lookup by id first (case-insensitive), then by biometric card no.
    const userById = await getUserById(employeeKey.toUpperCase());
    const user = userById ?? (await getUserById(employeeKey));

    const meals = await getMeals();
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) {
      return res.status(404).json({
        success: false,
        message: "Meal not found in catalog",
      });
    }

    const empName = user ? user.name : `Employee (${employeeKey})`;
    const empDept = user ? user.dept : "Production";

    const tx: TransactionRecord = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      dept: empDept,
      item: meal.name,
      qty: 1,
      cost: meal.cost,
      type: "meal",
      userId: employeeKey,
      userName: empName,
      canteenId,
    };

    const created = await createTransaction(tx);

    res.status(201).json({
      success: true,
      data: created,
      message: `Meal ${meal.name} issued successfully to ${empName}`,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/transactions/issue-snack - Issue snacks to department/staff
router.post("/issue-snack", async (req: Request, res: Response) => {
  try {
    const { department, userId, selections, canteenId = "1" } = req.body;

    if (!department || !selections || typeof selections !== "object") {
      return res.status(400).json({
        success: false,
        message: "department and selections dictionary required",
      });
    }

    const selectedEntries = Object.entries(selections).filter(
      ([, qty]) => Number(qty) > 0,
    );
    if (selectedEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one item quantity > 0",
      });
    }

    // Load all the state we need in parallel up front.
    const [items, batches, inventory, balances] = await Promise.all([
      getItems(),
      getDailyBatches(),
      getInventory(),
      getDeptBalances(),
    ]);

    // ---- Pre-validate all items before executing mutations ----
    for (const [itemId, qty] of selectedEntries) {
      const numQty = Number(qty);
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;

      const isReadyMade = item.category === "ready-made";

      if (isReadyMade) {
        const batch = batches.find((b) => b.itemId === itemId);
        if (!batch) {
          return res.status(400).json({
            success: false,
            message: `${item.name} has not arrived in today's fresh delivery.`,
          });
        }
        if (batch.status === "cleared") {
          return res.status(400).json({
            success: false,
            message: `Today's batch of ${item.name} was cleared at closing.`,
          });
        }
        if (batch.remainingQty < numQty) {
          return res.status(400).json({
            success: false,
            message: `Only ${batch.remainingQty} units of ${item.name} available.`,
          });
        }
      } else {
        const currentQuota = balances[department]?.[itemId] ?? 25;
        if (currentQuota < numQty) {
          return res.status(400).json({
            success: false,
            message: `Insufficient quota for ${item.name}. ${department} department has ${currentQuota} remaining.`,
          });
        }
      }
    }

    // ---- Execute deductions and records ----
    const createdTransactions: TransactionRecord[] = [];
    const currentDate = new Date().toISOString().split("T")[0];
    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Local working copies so multi-line deductions in the same request
    // (two stock-keeping items from the same dept) see each other's writes.
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
        const batch = [...workingBatches.values()].find(
          (b) => b.itemId === itemId,
        );
        if (batch) {
          const nextIssued = batch.issuedQty + numQty;
          const nextRemaining = Math.max(0, batch.remainingQty - numQty);
          const nextStatus =
            nextRemaining === 0
              ? "sold-out"
              : nextRemaining <= 5
                ? "low"
                : batch.status;

          await updateDailyBatch(batch.id, {
            issuedQty: nextIssued,
            remainingQty: nextRemaining,
            status: nextStatus,
          });

          batch.issuedQty = nextIssued;
          batch.remainingQty = nextRemaining;
          batch.status = nextStatus as typeof batch.status;
        }
      } else {
        const current = workingBalances[department]?.[itemId] ?? 25;
        const nextQuota = Math.max(0, current - numQty);
        workingBalances[department][itemId] = nextQuota;

        const inv = [...workingInventory.values()].find(
          (i) => i.itemId === itemId,
        );
        if (inv) {
          const nextStock = Math.max(0, inv.stock - numQty);
          const nextStatus = nextStock <= inv.minLevel ? "Low" : "Good";
          await updateInventory(inv.id, {
            stock: nextStock,
            status: nextStatus,
          });
          inv.stock = nextStock;
          inv.status = nextStatus as typeof inv.status;
        }
      }

      const tx: TransactionRecord = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: currentDate,
        time: currentTime,
        dept: department,
        item: item.name,
        qty: numQty,
        cost: item.price * numQty,
        type: "snack",
        category: item.category || "stock-keeping",
        userId: userId || `EMP-${department.slice(0, 3).toUpperCase()}-REP`,
        userName: `${department} Department`,
        canteenId,
      };

      const created = await createTransaction(tx);
      createdTransactions.push(created);
    }

    // Persist any final dept balance changes once, after all items are processed.
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
