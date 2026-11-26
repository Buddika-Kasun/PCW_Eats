/**
 * ============================================================================
 * Item Management Routes (/api/items) — Prisma/PostgreSQL
 * ============================================================================
 * Supports retrieving, creating, updating, and deleting canteen items.
 * Distinguishes between:
 * - 'stock-keeping' items (tea, coffee, biscuits) which track perpetual inventory and quotas.
 * - 'ready-made' items (fish buns, vegetable samosas) which are fresh daily batches with zero rollover.
 */

import { Router, Request, Response } from "express";
import {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  createInventoryRecord,
} from "../db/store";
import { Item } from "../../src/types";

const router = Router();

// GET /api/items - Retrieve all items (optional ?category= filter)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    let result = await getItems();
    if (category) {
      result = result.filter((item) => item.category === category);
    }
    res.json({ success: true, data: result, total: result.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/items/:id - Retrieve item by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const items = await getItems();
    const item = items.find((i) => i.id === req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/items - Create new item
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      uom,
      price,
      category = "stock-keeping",
      shelfLife = "perpetual",
    } = req.body;

    if (!code || !name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Code, name, and price are required",
      });
    }

    const newItem: Item = {
      id: `itm-${Date.now()}`,
      code,
      name,
      uom: uom || "Unit",
      price: Number(price),
      category,
      shelfLife,
    };

    const created = await createItem(newItem);

    // If stock-keeping, also ensure an inventory record exists
    if (created.category === "stock-keeping") {
      await createInventoryRecord({
        id: `inv-${Date.now()}`,
        itemId: created.id,
        item: created.name,
        uom: created.uom,
        stock: 0,
        minLevel: 10,
        status: "Low",
      });
    }

    res.status(201).json({
      success: true,
      data: created,
      message: "Item created successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// PUT /api/items/:id - Update item
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const existingItems = await getItems();
    const existing = existingItems.find((i) => i.id === req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const updated = await updateItem(existing.id, {
      ...req.body,
      id: existing.id, // preserved by the helper anyway, kept for clarity
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    res.json({
      success: true,
      data: updated,
      message: "Item updated successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// DELETE /api/items/:id - Delete item
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existingItems = await getItems();
    const existing = existingItems.find((i) => i.id === req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const ok = await deleteItem(existing.id);
    if (!ok) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    res.json({
      success: true,
      data: existing,
      message: "Item deleted successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
