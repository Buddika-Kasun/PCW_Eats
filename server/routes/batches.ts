/**
 * ============================================================================
 * Daily Ready-Made Batch Routes (/api/batches)
 * ============================================================================
 * Implements the Zero-Overnight Carryover policy for daily ready-made items
 * (Fish buns, rolls, patties, samosas).
 * 
 * Capabilities:
 * - GET /api/batches: Today's active fresh deliveries and remaining counts
 * - POST /api/batches: Log morning delivery / batch arrival
 * - POST /api/batches/clearance: End-of-day zero-rollover clearance
 * - POST /api/batches/reset: Reset demo batches
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/store';
import { DailyReadyMadeBatch } from '../../src/types';

export const batchesRouter = Router();

// GET /api/batches - List today's ready-made batches
batchesRouter.get('/', (req: Request, res: Response) => {
  const totalReceived = db.dailyBatches.reduce((sum, b) => sum + b.receivedQty, 0);
  const totalIssued = db.dailyBatches.reduce((sum, b) => sum + b.issuedQty, 0);
  const totalRemaining = db.dailyBatches.reduce((sum, b) => sum + b.remainingQty, 0);
  const isAllCleared = db.dailyBatches.length > 0 && db.dailyBatches.every(b => b.status === 'cleared');

  res.json({
    success: true,
    data: db.dailyBatches,
    metrics: {
      totalReceived,
      totalIssued,
      totalRemaining,
      isAllCleared,
    },
  });
});

// POST /api/batches - Log a fresh delivery
batchesRouter.post('/', (req: Request, res: Response) => {
  const { itemId, receivedQty, deliveryTime = '07:30 AM' } = req.body;

  if (!itemId || !receivedQty || Number(receivedQty) <= 0) {
    res.status(400).json({ success: false, message: 'Valid itemId and positive receivedQty are required' });
    return;
  }

  const item = db.items.find(i => i.id === itemId);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  const numReceived = Number(receivedQty);
  const existingIndex = db.dailyBatches.findIndex(b => b.itemId === itemId);

  if (existingIndex >= 0) {
    // Append to existing batch
    const existing = db.dailyBatches[existingIndex];
    existing.receivedQty += numReceived;
    existing.remainingQty += numReceived;
    existing.deliveryTime = deliveryTime;
    existing.status = 'available';
    res.json({ success: true, data: existing, message: `Added ${numReceived} to today's ${item.name} batch` });
  } else {
    // Create new batch
    const newBatch: DailyReadyMadeBatch = {
      id: `batch-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      date: 'Today',
      deliveryTime,
      receivedQty: numReceived,
      issuedQty: 0,
      remainingQty: numReceived,
      unitPrice: item.price,
      status: 'available',
    };
    db.dailyBatches.push(newBatch);
    res.status(201).json({ success: true, data: newBatch, message: `Recorded fresh batch for ${item.name}` });
  }
});

// POST /api/batches/clearance - Run End-of-Day Clearance (Zero rollover enforcement)
batchesRouter.post('/clearance', (req: Request, res: Response) => {
  const clearanceTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let totalCleared = 0;

  db.dailyBatches.forEach(batch => {
    if (batch.status !== 'cleared') {
      totalCleared += batch.remainingQty;
      batch.wasteQty = batch.remainingQty;
      batch.remainingQty = 0;
      batch.status = 'cleared';
      batch.clearedAt = clearanceTime;
    }
  });

  res.json({
    success: true,
    clearedAt: clearanceTime,
    totalClearedUnits: totalCleared,
    message: `End-of-day clearance complete. ${totalCleared} unsold units marked as cleared. Zero rollover enforced.`,
  });
});

// POST /api/batches/reset - Reset demo batches
batchesRouter.post('/reset', (req: Request, res: Response) => {
  db.seedInitialData();
  res.json({ success: true, data: db.dailyBatches, message: 'Batches reset to demo state' });
});
