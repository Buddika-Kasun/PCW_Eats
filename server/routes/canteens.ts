/**
 * ============================================================================
 * Canteen Management Routes (/api/canteens)
 * ============================================================================
 * Manages physical canteen locations and POS terminals.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/store';
import { Canteen } from '../../src/types';

export const canteensRouter = Router();

// GET /api/canteens - List all canteens
canteensRouter.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: db.canteens, total: db.canteens.length });
});

// POST /api/canteens - Add new canteen
canteensRouter.post('/', (req: Request, res: Response) => {
  const { code, name, type = 'Main' } = req.body;
  if (!code || !name) {
    res.status(400).json({ success: false, message: 'Code and name are required' });
    return;
  }

  const newCanteen: Canteen = {
    id: `cnt-${Date.now()}`,
    code,
    name,
    type,
  };

  db.canteens.push(newCanteen);
  res.status(201).json({ success: true, data: newCanteen, message: 'Canteen added successfully' });
});
