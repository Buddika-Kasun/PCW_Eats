/**
 * ============================================================================
 * Item Management Routes (/api/items)
 * ============================================================================
 * Supports retrieving, creating, updating, and deleting canteen items.
 * Distinguishes between:
 * - 'stock-keeping' items (tea, coffee, biscuits) which track perpetual inventory and quotas.
 * - 'ready-made' items (fish buns, vegetable samosas) which are fresh daily batches with zero rollover.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/store';
import { Item } from '../../src/types';

export const itemsRouter = Router();

// GET /api/items - Retrieve all items
itemsRouter.get('/', (req: Request, res: Response) => {
  const { category } = req.query;
  let result = db.items;
  if (category) {
    result = result.filter(item => item.category === category);
  }
  res.json({ success: true, data: result, total: result.length });
});

// GET /api/items/:id - Retrieve item by ID
itemsRouter.get('/:id', (req: Request, res: Response) => {
  const item = db.items.find(i => i.id === req.params.id);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }
  res.json({ success: true, data: item });
});

// POST /api/items - Create new item
itemsRouter.post('/', (req: Request, res: Response) => {
  const { code, name, uom, price, category = 'stock-keeping', shelfLife = 'perpetual' } = req.body;

  if (!code || !name || price === undefined) {
    res.status(400).json({ success: false, message: 'Code, name, and price are required' });
    return;
  }

  const newItem: Item = {
    id: `itm-${Date.now()}`,
    code,
    name,
    uom: uom || 'Unit',
    price: Number(price),
    category,
    shelfLife,
  };

  db.items.push(newItem);

  // If stock-keeping, also ensure an inventory record exists
  if (category === 'stock-keeping') {
    db.inventory.push({
      id: `inv-${Date.now()}`,
      itemId: newItem.id,
      item: newItem.name,
      uom: newItem.uom,
      stock: 0,
      minLevel: 10,
      status: 'Low',
    });
  }

  res.status(201).json({ success: true, data: newItem, message: 'Item created successfully' });
});

// PUT /api/items/:id - Update item
itemsRouter.put('/:id', (req: Request, res: Response) => {
  const index = db.items.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  const existing = db.items[index];
  const updated: Item = {
    ...existing,
    ...req.body,
    id: existing.id, // Preserve ID
  };

  db.items[index] = updated;
  res.json({ success: true, data: updated, message: 'Item updated successfully' });
});

// DELETE /api/items/:id - Delete item
itemsRouter.delete('/:id', (req: Request, res: Response) => {
  const index = db.items.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  const deleted = db.items.splice(index, 1)[0];
  res.json({ success: true, data: deleted, message: 'Item deleted successfully' });
});
