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
 * - /api/zkteco       : ZKTeco MB360 Biometric Device Bridge
 * - /api/reports      : Reporting and Cost Analytics
 */

import { Router } from 'express';
import itemsRouter from "./items";
import batchesRouter from "./batches";
import mealsRouter from "./meals";
import quotasRouter from "./quotas";
import canteensRouter from "./canteens";
import inventoryRouter from "./inventory";
import transactionsRouter from "./transactions";
import zktecoRouter from "./zkteco";
import reportsRouter from "./reports";
import { authRouter } from './auth';

export const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'PCW Eats Canteen ERP Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount domain routes
apiRouter.use("/auth", authRouter);
apiRouter.use('/items', itemsRouter);
apiRouter.use('/batches', batchesRouter);
apiRouter.use('/meals', mealsRouter);
apiRouter.use('/quotas', quotasRouter);
apiRouter.use('/canteens', canteensRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/zkteco', zktecoRouter);
apiRouter.use('/reports', reportsRouter);
