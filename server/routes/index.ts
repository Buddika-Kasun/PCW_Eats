/**
 * ============================================================================
 * Central API Router Hub (/api)
 * ============================================================================
 * Combines all modular route handlers into a single clean router.
 *
 * Endpoints Mounted:
 * - /api/items        : Item Catalog & Categories
 * - /api/batches      : Ready-Made Daily Fresh Batches & Clearance
 * - /api/meals        : Meals and Timing Windows
 * - /api/quotas       : Department Quotas & Balances
 * - /api/canteens     : Canteen Terminals
 * - /api/inventory    : Perpetual Stock Control
 * - /api/transactions : Meal & Snack Issuance
 * - /api/zkteco       : ZKTeco MB360 Biometric Device Bridge (legacy)
 * - /api/hikvision    : Hikvision DS-K1T343 Biometric Bridge
 * - /api/reports      : Reporting and Cost Analytics
 * - /api/dashboard    : Admin, User & Canteen dashboards
 * - /api/special-orders : Special bulk orders + guests
 * - /api/departments  : PCW Ride department proxy
 * ============================================================================
 */

import { Router } from "express";

import itemsRouter from "./items";
import batchesRouter from "./batches";
import mealsRouter from "./meals";
import quotasRouter from "./quotas";
import canteensRouter from "./canteens";
import inventoryRouter from "./inventory";
import transactionsRouter from "./transactions";
import zktecoRouter from "./zkteco";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { departmentsRouter } from "./departments";
import { dashboardRouter } from "./dashboard";
import { reportsRouter } from "./reports";
import { specialOrdersRouter } from "./specialOrders";
import { hikvisionRouter } from "./hikvision";

export const apiRouter = Router();

/* -------------------------------------------------------------------------- */
/* Health check                                                               */
/* -------------------------------------------------------------------------- */
apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    system: "PCW Eats Canteen ERP Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

/* -------------------------------------------------------------------------- */
/* Mount domain routes                                                        */
/* -------------------------------------------------------------------------- */
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/items", itemsRouter);
apiRouter.use("/batches", batchesRouter);
apiRouter.use("/meals", mealsRouter);
apiRouter.use("/quotas", quotasRouter);
apiRouter.use("/canteens", canteensRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/transactions", transactionsRouter);
apiRouter.use("/zkteco", zktecoRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/departments", departmentsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/special-orders", specialOrdersRouter);
apiRouter.use("/hikvision", hikvisionRouter);

export default apiRouter;
