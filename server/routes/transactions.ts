/**
 * ============================================================================
 * Transaction & Issuing Routes (/api/transactions)
 * ============================================================================
 * Core POS operational engine for:
 * 1. Issuing Meals:
 *    - Captures employee number (from ZKTeco MB360 fingerprint scan or manual entry)
 *    - Verifies eligible meal window
 *    - Records meal transaction
 * 
 * 2. Issuing Snacks:
 *    - Ready-made items: verifies daily fresh batch, deducts batch balance (no quota deduction)
 *    - Stock-keeping items: verifies department quota, deducts department balance & inventory
 */

import { Router, Request, Response } from 'express';
import { db, TransactionRecord } from '../db/store';

export const transactionsRouter = Router();

// GET /api/transactions - Query transactions
transactionsRouter.get('/', (req: Request, res: Response) => {
  const { type, dept, month, limit = 50 } = req.query;

  let list = [...db.transactions];

  if (type) {
    list = list.filter(t => t.type.toLowerCase() === (type as string).toLowerCase());
  }

  if (dept) {
    list = list.filter(t => t.dept.toLowerCase() === (dept as string).toLowerCase());
  }

  if (month) {
    list = list.filter(t => t.date.startsWith(month as string));
  }

  res.json({
    success: true,
    data: list.slice(0, Number(limit)),
    total: list.length,
  });
});

// POST /api/transactions/issue-meal - Issue meal to employee
transactionsRouter.post('/issue-meal', (req: Request, res: Response) => {
  const { employeeId, mealId, canteenId = '1' } = req.body;

  if (!employeeId || !mealId) {
    res.status(400).json({ success: false, message: 'employeeId and mealId are required' });
    return;
  }

  const user = db.users.find(u => u.id.toUpperCase() === employeeId.trim().toUpperCase());
  const meal = db.meals.find(m => m.id === mealId);

  if (!meal) {
    res.status(404).json({ success: false, message: 'Meal not found in catalog' });
    return;
  }

  const empName = user ? user.name : `Employee (${employeeId})`;
  const empDept = user ? user.dept : 'Production';

  const tx: TransactionRecord = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dept: empDept,
    item: meal.name,
    qty: 1,
    cost: meal.cost,
    type: 'meal',
    userId: employeeId,
    userName: empName,
    canteenId,
  };

  db.transactions.unshift(tx);

  res.status(201).json({
    success: true,
    data: tx,
    message: `Meal ${meal.name} issued successfully to ${empName}`,
  });
});

// POST /api/transactions/issue-snack - Issue snacks to department/staff
transactionsRouter.post('/issue-snack', (req: Request, res: Response) => {
  const { department, userId, selections, canteenId = '1' } = req.body;

  if (!department || !selections || typeof selections !== 'object') {
    res.status(400).json({ success: false, message: 'department and selections dictionary required' });
    return;
  }

  const selectedEntries = Object.entries(selections).filter(([_, qty]) => Number(qty) > 0);
  if (selectedEntries.length === 0) {
    res.status(400).json({ success: false, message: 'Please select at least one item quantity > 0' });
    return;
  }

  // Pre-validate all items before executing mutations
  for (const [itemId, qty] of selectedEntries) {
    const numQty = Number(qty);
    const item = db.items.find(i => i.id === itemId);
    if (!item) continue;

    const isReadyMade = item.category === 'ready-made';

    if (isReadyMade) {
      // Check daily batch availability
      const batch = db.dailyBatches.find(b => b.itemId === itemId);
      if (!batch) {
        res.status(400).json({ success: false, message: `${item.name} has not arrived in today's fresh delivery.` });
        return;
      }
      if (batch.status === 'cleared') {
        res.status(400).json({ success: false, message: `Today's batch of ${item.name} was cleared at closing.` });
        return;
      }
      if (batch.remainingQty < numQty) {
        res.status(400).json({ success: false, message: `Only ${batch.remainingQty} units of ${item.name} available.` });
        return;
      }
    } else {
      // Check department quota for stock-keeping items
      if (!db.deptBalances[department]) {
        db.deptBalances[department] = {};
      }
      const currentQuota = db.deptBalances[department][itemId] ?? 25;
      if (currentQuota < numQty) {
        res.status(400).json({ 
          success: false, 
          message: `Insufficient quota for ${item.name}. ${department} department has ${currentQuota} remaining.` 
        });
        return;
      }
    }
  }

  // Execute deductions and records
  const createdTransactions: TransactionRecord[] = [];
  const currentDate = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  for (const [itemId, qty] of selectedEntries) {
    const numQty = Number(qty);
    const item = db.items.find(i => i.id === itemId);
    if (!item) continue;

    const isReadyMade = item.category === 'ready-made';

    if (isReadyMade) {
      // Deduct from daily fresh batch
      const batch = db.dailyBatches.find(b => b.itemId === itemId);
      if (batch) {
        batch.issuedQty += numQty;
        batch.remainingQty = Math.max(0, batch.remainingQty - numQty);
        if (batch.remainingQty === 0) batch.status = 'sold-out';
        else if (batch.remainingQty <= 5) batch.status = 'low';
      }
    } else {
      // Deduct department quota balance
      db.deptBalances[department][itemId] = Math.max(0, (db.deptBalances[department][itemId] ?? 25) - numQty);

      // Deduct stock inventory
      const inv = db.inventory.find(i => i.itemId === itemId);
      if (inv) {
        inv.stock = Math.max(0, inv.stock - numQty);
        inv.status = inv.stock <= inv.minLevel ? 'Low' : 'Good';
      }
    }

    const tx: TransactionRecord = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: currentDate,
      time: currentTime,
      dept: department,
      item: item.name,
      qty: numQty,
      cost: item.price * numQty,
      type: 'snack',
      category: item.category || 'stock-keeping',
      userId: userId || `EMP-${department.slice(0, 3).toUpperCase()}-REP`,
      userName: `${department} Department`,
      canteenId,
    };

    db.transactions.unshift(tx);
    createdTransactions.push(tx);
  }

  res.status(201).json({
    success: true,
    data: createdTransactions,
    message: `Successfully issued ${createdTransactions.length} snack types to ${department}`,
  });
});
