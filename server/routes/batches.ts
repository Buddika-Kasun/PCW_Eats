/**
 * ============================================================================
 * Daily Ready-Made Batch Routes (/api/batches) — Prisma/PostgreSQL
 * ============================================================================
 * Implements the Zero-Overnight Carryover policy for daily ready-made items
 * (Fish buns, rolls, patties, samosas).
 *
 * Capabilities:
 * - GET  /api/batches          : Today's active fresh deliveries
 * - POST /api/batches          : Log morning delivery / batch arrival
 * - POST /api/batches/clear    : End-of-day zero-rollover clearance
 * - POST /api/batches/clearance: Alias for /clear (backward compat)
 * - POST /api/batches/reset    : Reset demo batches to seed state
 */

import { Router, Request, Response } from "express";
import {
  getDailyBatches,
  updateDailyBatch,
  getItems,
  createDailyBatch,
} from "../db/store";
import { prisma } from "../db/prisma";

const router = Router();

/**
 * GET /api/batches
 * List today's ready-made batches with aggregate metrics.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const batches = await getDailyBatches();

    const totalReceived = batches.reduce((sum, b) => sum + b.receivedQty, 0);
    const totalIssued = batches.reduce((sum, b) => sum + b.issuedQty, 0);
    const totalRemaining = batches.reduce((sum, b) => sum + b.remainingQty, 0);
    const isAllCleared =
      batches.length > 0 && batches.every((b) => b.status === "cleared");

    res.json({
      success: true,
      data: batches,
      metrics: { totalReceived, totalIssued, totalRemaining, isAllCleared },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

/**
 * POST /api/batches
 * Log a fresh delivery. If a batch already exists today for the item,
 * its received/remaining quantities are incremented; otherwise a new
 * batch row is created.
 *
 * Body: { itemId: string, receivedQty: number, deliveryTime?: string }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { itemId, receivedQty, deliveryTime = "07:30 AM" } = req.body;

    if (!itemId || !receivedQty || Number(receivedQty) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid itemId and positive receivedQty are required",
      });
    }

    const items = await getItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const numReceived = Number(receivedQty);
    const batches = await getDailyBatches();
    const existing = batches.find((b) => b.itemId === itemId);

    if (existing) {
      const updated = await updateDailyBatch(existing.id, {
        issuedQty: existing.issuedQty,
        remainingQty: existing.remainingQty + numReceived,
        status: "available",
      });
      // receivedQty and deliveryTime aren't part of updateDailyBatch's patch
      // surface, so apply them via a direct Prisma update.
      const refreshed = await prisma.dailyBatch.update({
        where: { id: existing.id },
        data: {
          receivedQty: existing.receivedQty + numReceived,
          deliveryTime,
          status: "available",
        },
      });

      return res.json({
        success: true,
        data: {
          ...updated,
          receivedQty: refreshed.receivedQty,
          deliveryTime: refreshed.deliveryTime ?? undefined,
        },
        message: `Added ${numReceived} to today's ${item.name} batch`,
      });
    }

    const newBatch = await createDailyBatch({
      id: `batch-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      date: "Today",
      deliveryTime,
      receivedQty: numReceived,
      issuedQty: 0,
      remainingQty: numReceived,
      unitPrice: item.price,
      status: "available",
    });

    return res.status(201).json({
      success: true,
      data: newBatch,
      message: `Recorded fresh batch for ${item.name}`,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

/**
 * POST /api/batches/clear  (and /clearance alias)
 * End-of-day clearance: every non-cleared batch has its remainingQty
 * zeroed out and recorded as waste. Zero rollover enforced.
 */
const runClearance = async (_req: Request, res: Response) => {
  try {
    const clearanceTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    let totalCleared = 0;

    const batches = await getDailyBatches();
    for (const batch of batches) {
      if (batch.status === "cleared") continue;
      totalCleared += batch.remainingQty;
      await updateDailyBatch(batch.id, {
        issuedQty: batch.issuedQty,
        remainingQty: 0,
        status: "cleared",
        wasteQty: batch.remainingQty,
        clearedAt: clearanceTime,
      });
    }

    res.json({
      success: true,
      clearedAt: clearanceTime,
      totalClearedUnits: totalCleared,
      message: `End-of-day clearance complete. ${totalCleared} unsold units marked as cleared. Zero rollover enforced.`,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
};

router.post("/clear", runClearance);
router.post("/clearance", runClearance);

/**
 * POST /api/batches/reset
 * Restore the demo batch rows. Since the old in-memory seed is gone,
 * this clears the daily_batches table and re-inserts the seed rows.
 */
router.post("/reset", async (_req: Request, res: Response) => {
  try {
    await prisma.dailyBatch.deleteMany();

    const seedBatches = [
      {
        id: "batch-1",
        itemId: "6",
        itemName: "Spicy Fish Bun",
        date: "Today",
        deliveryTime: "07:30 AM",
        receivedQty: 50,
        issuedQty: 18,
        remainingQty: 32,
        unitPrice: 80,
        status: "available",
      },
      {
        id: "batch-2",
        itemId: "7",
        itemName: "Crispy Fish Roll",
        date: "Today",
        deliveryTime: "07:30 AM",
        receivedQty: 40,
        issuedQty: 35,
        remainingQty: 5,
        unitPrice: 90,
        status: "low",
      },
      {
        id: "batch-3",
        itemId: "8",
        itemName: "Vegetable Samosa",
        date: "Today",
        deliveryTime: "08:00 AM",
        receivedQty: 60,
        issuedQty: 60,
        remainingQty: 0,
        unitPrice: 70,
        status: "sold-out",
      },
      {
        id: "batch-4",
        itemId: "9",
        itemName: "Chicken Puff Pastry",
        date: "Today",
        deliveryTime: "08:15 AM",
        receivedQty: 35,
        issuedQty: 12,
        remainingQty: 23,
        unitPrice: 110,
        status: "available",
      },
      {
        id: "batch-5",
        itemId: "10",
        itemName: "Ulundu Vadai",
        date: "Today",
        deliveryTime: "07:15 AM",
        receivedQty: 50,
        issuedQty: 25,
        remainingQty: 25,
        unitPrice: 65,
        status: "available",
      },
    ];

    await prisma.dailyBatch.createMany({ data: seedBatches });

    const batches = await getDailyBatches();
    res.json({
      success: true,
      data: batches,
      message: "Batches reset to demo state",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
