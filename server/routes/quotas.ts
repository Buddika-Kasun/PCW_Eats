/**
 * ============================================================================
 * Quota Management Routes (/api/quotas) — Prisma/PostgreSQL
 * ============================================================================
 * Handles department quotas for stock-keeping items.
 * Ready-made items do NOT map to quotas (they are tracked via daily batches).
 */

import { Router, Request, Response } from "express";
import {
  getQuotas,
  createQuota,
  getDeptQuotaMaps,
  createDeptQuotaMap,
  getDeptBalances,
} from "../db/store";
import { Quota, DepartmentQuotaMap } from "../../src/types";

const router = Router();

// GET /api/quotas - List all quotas with mappings and department balances
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [quotas, mappings, balances] = await Promise.all([
      getQuotas(),
      getDeptQuotaMaps(),
      getDeptBalances(),
    ]);
    res.json({ success: true, data: quotas, mappings, balances });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/quotas/department/:dept - Get department quota and remaining balances
router.get("/department/:dept", async (req: Request, res: Response) => {
  try {
    const deptName = req.params.dept;
    const [mappings, quotas, balances] = await Promise.all([
      getDeptQuotaMaps(),
      getQuotas(),
      getDeptBalances(),
    ]);

    const mapping =
      mappings.find(
        (m) => m.department.toLowerCase() === deptName.toLowerCase(),
      ) ?? null;
    const quota = mapping
      ? (quotas.find((q) => q.id === mapping.quotaId) ?? null)
      : null;

    // Match the old behavior: look up balances by the exact dept name the
    // client asked for. The seed uses capitalized department names, so a
    // case-insensitive fallback keeps the route forgiving.
    const deptBalances =
      balances[deptName] ??
      balances[
        Object.keys(balances).find(
          (k) => k.toLowerCase() === deptName.toLowerCase(),
        ) ?? ""
      ] ??
      {};

    res.json({
      success: true,
      department: deptName,
      mapping,
      quota,
      balances: deptBalances,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/quotas - Create quota template
router.post("/", async (req: Request, res: Response) => {
  try {
    const { code, items } = req.body;
    if (!code || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Valid code and items array required",
      });
    }

    const newQuota: Quota = {
      id: `qta-${Date.now()}`,
      code,
      items,
    };

    const created = await createQuota(newQuota);
    res.status(201).json({
      success: true,
      data: created,
      message: "Quota template created",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/quotas/mapping - Map quota to department
router.post("/mapping", async (req: Request, res: Response) => {
  try {
    const { department, effectiveFrom, quotaId } = req.body;
    if (!department || !quotaId) {
      return res.status(400).json({
        success: false,
        message: "Department and quotaId required",
      });
    }

    const newMap: DepartmentQuotaMap = {
      id: `map-${Date.now()}`,
      department,
      effectiveFrom: effectiveFrom || new Date().toISOString().split("T")[0],
      quotaId,
    };

    const created = await createDeptQuotaMap(newMap);
    res.status(201).json({
      success: true,
      data: created,
      message: "Department quota assigned",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
