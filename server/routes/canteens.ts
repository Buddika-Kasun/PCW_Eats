/**
 * ============================================================================
 * Canteen Management Routes (/api/canteens) — Prisma/PostgreSQL
 * ============================================================================
 * Manages physical canteen locations and POS terminals.
 */

import { Router, Request, Response } from "express";
import { getCanteens, createCanteen } from "../db/store";
import { Canteen } from "../../src/types";

const router = Router();

// GET /api/canteens - List all canteens
router.get("/", async (_req: Request, res: Response) => {
  try {
    const canteens = await getCanteens();
    res.json({ success: true, data: canteens, total: canteens.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/canteens - Add new canteen
router.post("/", async (req: Request, res: Response) => {
  try {
    const { code, name, type = "Main" } = req.body;
    if (!code || !name) {
      return res
        .status(400)
        .json({ success: false, message: "Code and name are required" });
    }

    const newCanteen: Canteen = {
      id: `cnt-${Date.now()}`,
      code,
      name,
      type,
    };

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

export default router;
