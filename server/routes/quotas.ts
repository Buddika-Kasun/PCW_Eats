/**
 * ============================================================================
 * Quota Management Routes (/api/quotas)
 * ============================================================================
 * Handles department quotas for stock-keeping items.
 * Ready-made items do NOT map to quotas (they are tracked via daily batches).
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/store';
import { Quota, DepartmentQuotaMap } from '../../src/types';

export const quotasRouter = Router();

// GET /api/quotas - List all quotas
quotasRouter.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: db.quotas,
    mappings: db.deptQuotaMaps,
    balances: db.deptBalances,
  });
});

// GET /api/quotas/department/:dept - Get department quota and remaining balances
quotasRouter.get('/department/:dept', (req: Request, res: Response) => {
  const deptName = req.params.dept;
  const mapping = db.deptQuotaMaps.find(m => m.department.toLowerCase() === deptName.toLowerCase());
  const quota = mapping ? db.quotas.find(q => q.id === mapping.quotaId) : null;
  const balances = db.deptBalances[deptName] || {};

  res.json({
    success: true,
    department: deptName,
    mapping,
    quota,
    balances,
  });
});

// POST /api/quotas - Create quota template
quotasRouter.post('/', (req: Request, res: Response) => {
  const { code, items } = req.body;
  if (!code || !Array.isArray(items)) {
    res.status(400).json({ success: false, message: 'Valid code and items array required' });
    return;
  }

  const newQuota: Quota = {
    id: `qta-${Date.now()}`,
    code,
    items,
  };

  db.quotas.push(newQuota);
  res.status(201).json({ success: true, data: newQuota, message: 'Quota template created' });
});

// POST /api/quotas/mapping - Map quota to department
quotasRouter.post('/mapping', (req: Request, res: Response) => {
  const { department, effectiveFrom, quotaId } = req.body;
  if (!department || !quotaId) {
    res.status(400).json({ success: false, message: 'Department and quotaId required' });
    return;
  }

  const newMap: DepartmentQuotaMap = {
    id: `map-${Date.now()}`,
    department,
    effectiveFrom: effectiveFrom || new Date().toISOString().split('T')[0],
    quotaId,
  };

  db.deptQuotaMaps.push(newMap);
  res.status(201).json({ success: true, data: newMap, message: 'Department quota assigned' });
});
