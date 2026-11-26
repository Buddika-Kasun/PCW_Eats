import { Router, Response, Request } from "express";
import {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  createInventoryRecord,
} from "../db/store";
import { Item } from "../../src/types";

const router = Router();

/** Resolve the human identifier for audit columns. */
function actorOf(req: Request): string | null {
  const u = req.user;
  if (!u) return null;
  return String(u.id ?? u.username ?? u.email ?? "") || null;
}

// GET — unchanged
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    let result = await getItems();
    if (category) result = result.filter((i) => i.category === category);
    res.json({ success: true, data: result, total: result.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET by id — unchanged
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const items = await getItems();
    const item = items.find((i) => i.id === req.params.id);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST — record createdBy / updatedBy
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

    const actor = actorOf(req);

    const newItem: Item = {
      id: `itm-${Date.now()}`,
      code,
      name,
      uom: uom || "Unit",
      price: Number(price),
      category,
      shelfLife,
      // audit fields (extend the Item type accordingly)
      createdBy: actor ?? undefined,
      updatedBy: actor ?? undefined,
    } as Item;

    const created = await createItem(newItem);

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

// PUT — record updatedBy
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const existingItems = await getItems();
    const existing = existingItems.find((i) => i.id === req.params.id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    const updated = await updateItem(existing.id, {
      ...req.body,
      id: existing.id,
      updatedBy: actorOf(req) ?? undefined, // overwrite on every edit
      // createdBy: existing.createdBy  — leave as-is
    });

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    res.json({
      success: true,
      data: updated,
      message: "Item updated successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// DELETE — unchanged
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existingItems = await getItems();
    const existing = existingItems.find((i) => i.id === req.params.id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    const ok = await deleteItem(existing.id);
    if (!ok)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

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
