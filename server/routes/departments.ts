/**
 * ============================================================================
 * Departments proxy route (/api/departments)
 * ============================================================================
 * Proxies to PCW Ride backend:  GET {RIDE_API_BASE_URL}/department/get-all
 * Always forces limit=100 unless the caller explicitly sends one.
 */

import { Router, Request, Response } from "express";
import { PCW_RIDE_API_URL } from "../config";

const router = Router();

/**
 * GET /api/departments/get-all?page=1&search=hr&companyId=2&costCenterId=5
 *
 * Proxies to:  {RIDE_API_BASE_URL}/department/get-all?page=…&limit=100&…
 * Default limit is 100 when the caller doesn't provide one.
 */
router.get("/get-all", async (req: Request, res: Response) => {
  try {
    const { page, limit, search, companyId, costCenterId } = req.query;

    // Default limit=100
    const effectiveLimit =
      typeof limit === "string" && limit.trim() !== "" ? limit.trim() : "100";

    const params = new URLSearchParams();
    params.set("page", typeof page === "string" && page.trim() ? page : "1");
    params.set("limit", effectiveLimit);

    if (typeof search === "string" && search.trim()) {
      params.set("search", search.trim());
    }
    if (typeof companyId === "string" && companyId.trim()) {
      params.set("companyId", companyId.trim());
    }
    if (typeof costCenterId === "string" && costCenterId.trim()) {
      params.set("costCenterId", costCenterId.trim());
    }

    const url = `${PCW_RIDE_API_URL.replace(/\/+$/, "")}/department/get-all-for-eats?${params.toString()}`;

    const upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const body = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        message:
          (body as any)?.message ??
          `Ride backend responded ${upstream.status} ${upstream.statusText}`,
        data: (body as any)?.data ?? null,
      });
    }

    // Pass through the Ride response unchanged
    res.status(200).json(body);
  } catch (e) {
    res.status(500).json({
      success: false,
      message: `Failed to reach Ride backend: ${(e as Error).message}`,
      data: null,
    });
  }
});

export const departmentsRouter = router;
