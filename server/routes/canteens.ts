/**
 * ============================================================================
 * Canteen Management Routes (/api/canteens) — Prisma/PostgreSQL
 * ============================================================================
 * Manages physical canteen locations and POS terminals.
 */

import { Router, Request, Response } from "express";
import { getCanteens, createCanteen, updateCanteen, deleteCanteen } from "../db/store";
import { Canteen } from "../../src/types";

const router = Router();

/** Resolve the human identifier for audit columns. */
function actorOf(req: Request): string | null {
  const u = req.user;
  if (!u) return null;
  return String(u.id ?? u.username ?? u.email ?? "") || null;
}

// GET /api/canteens — list all
router.get("/", async (_req: Request, res: Response) => {
  try {
    const canteens = await getCanteens();
    res.json({ success: true, data: canteens, total: canteens.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/canteens — create (records createdBy / updatedBy)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { code, name, type = "Main" } = req.body;
    if (!code || !name) {
      return res
        .status(400)
        .json({ success: false, message: "Code and name are required" });
    }

    const actor = actorOf(req);

    const newCanteen: Canteen = {
      id: `cnt-${Date.now()}`,
      code,
      name,
      type,
      createdBy: actor ?? undefined,
      updatedBy: actor ?? undefined,
    } as Canteen;

    const created = await createCanteen(newCanteen);
    res.status(201).json({
      success: true,
      data: created,
      message: "Canteen added successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// PUT /api/canteens/:id — update (records updatedBy)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const existing = (await getCanteens()).find((c) => c.id === req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Canteen not found" });
    }

    const updated = await updateCanteen(req.params.id, {
      ...req.body,
      updatedBy: actorOf(req) ?? undefined,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Canteen not found" });
    }

    res.json({
      success: true,
      data: updated,
      message: "Canteen updated successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// DELETE /api/canteens/:id — delete
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existing = (await getCanteens()).find((c) => c.id === req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Canteen not found" });
    }
    await deleteCanteen(req.params.id);
    res.json({
      success: true,
      data: existing,
      message: "Canteen deleted successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
