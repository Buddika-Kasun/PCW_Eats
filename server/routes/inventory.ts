/**
 * ============================================================================
 * Inventory Management Routes (/api/inventory) — Prisma/PostgreSQL
 * ============================================================================
 * Manages perpetual stock-keeping warehouse & canteen storage levels.
 */

import { Router, Request, Response } from "express";
import {
  getInventory,
  updateInventory,
  createInventoryRecord,
  getItems,
} from "../db/store";

const router = Router();

// GET /api/inventory - List current stock
router.get("/", async (_req: Request, res: Response) => {
  try {
    const inventory = await getInventory();
    res.json({ success: true, data: inventory, total: inventory.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/inventory/adjust - Adjust or receive stock
router.post("/adjust", async (req: Request, res: Response) => {
  try {
    const { itemId, adjustmentQty, minLevel } = req.body;
    if (!itemId) {
      return res
        .status(400)
        .json({ success: false, message: "itemId is required" });
    }

    const inventory = await getInventory();
    const existing = inventory.find(
      (i) => i.itemId === itemId || i.id === itemId,
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Inventory item not found" });
    }

    let newStock = existing.stock;
    if (adjustmentQty !== undefined) {
      newStock = Math.max(0, existing.stock + Number(adjustmentQty));
    }
    const newMinLevel =
      minLevel !== undefined ? Number(minLevel) : existing.minLevel;
    const newStatus = newStock <= newMinLevel ? "Low" : "Good";

    const updated = await updateInventory(existing.id, {
      stock: newStock,
      minLevel: newMinLevel,
      status: newStatus,
    });

    res.json({
      success: true,
      data: updated,
      message: "Stock updated successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/inventory - Add new inventory track
router.post("/", async (req: Request, res: Response) => {
  try {
    const { itemId, stock = 0, minLevel = 10 } = req.body;

    const items = await getItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in catalog",
      });
    }

    const created = await createInventoryRecord({
      id: `inv-${Date.now()}`,
      itemId: item.id,
      item: item.name,
      uom: item.uom,
      stock: Number(stock),
      minLevel: Number(minLevel),
      status: Number(stock) <= Number(minLevel) ? "Low" : "Good",
    });

    res.status(201).json({
      success: true,
      data: created,
      message: "Inventory item added",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
