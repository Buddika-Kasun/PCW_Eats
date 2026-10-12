/**
 * ============================================================================
 * Inventory Management Routes (/api/inventory)
 * ============================================================================
 * Manages perpetual stock-keeping warehouse & canteen storage levels.
 */

import { Router, Request, Response } from 'express';
import { db, InventoryRecord } from '../db/store';

export const inventoryRouter = Router();

// GET /api/inventory - List current stock
inventoryRouter.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: db.inventory, total: db.inventory.length });
});

// POST /api/inventory/adjust - Adjust or receive stock
inventoryRouter.post('/adjust', (req: Request, res: Response) => {
  const { itemId, adjustmentQty, minLevel } = req.body;
  if (!itemId) {
    res.status(400).json({ success: false, message: 'itemId is required' });
    return;
  }

  const existing = db.inventory.find(i => i.itemId === itemId || i.id === itemId);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Inventory item not found' });
    return;
  }

  if (adjustmentQty !== undefined) {
    existing.stock = Math.max(0, existing.stock + Number(adjustmentQty));
  }
  if (minLevel !== undefined) {
    existing.minLevel = Number(minLevel);
  }

  existing.status = existing.stock <= existing.minLevel ? 'Low' : 'Good';

  res.json({ success: true, data: existing, message: 'Stock updated successfully' });
});

// POST /api/inventory - Add new inventory track
inventoryRouter.post('/', (req: Request, res: Response) => {
  const { itemId, stock = 0, minLevel = 10 } = req.body;
  const item = db.items.find(i => i.id === itemId);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found in catalog' });
    return;
  }

  const newRecord: InventoryRecord = {
    id: `inv-${Date.now()}`,
    itemId: item.id,
    item: item.name,
    uom: item.uom,
    stock: Number(stock),
    minLevel: Number(minLevel),
    status: Number(stock) <= Number(minLevel) ? 'Low' : 'Good',
  };

  db.inventory.push(newRecord);
  res.status(201).json({ success: true, data: newRecord, message: 'Inventory item added' });
});
