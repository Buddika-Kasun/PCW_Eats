/**
 * ============================================================================
 * Meal Management Routes (/api/meals)
 * ============================================================================
 * Handles meal catalog items and eligibility time slots
 * (Breakfast, Lunch, Dinner, Midnight shift meals).
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/store';
import { Meal } from '../../src/types';

export const mealsRouter = Router();

// GET /api/meals - List all meal types
mealsRouter.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: db.meals, total: db.meals.length });
});

// GET /api/meals/active - Return meals currently eligible based on current local time
mealsRouter.get('/active', (req: Request, res: Response) => {
  const now = new Date();
  const currentHours = now.getHours().toString().padStart(2, '0');
  const currentMinutes = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  const eligibleMeals = db.meals.filter(meal => {
    // Basic window check
    if (meal.eligibleFrom <= meal.eligibleTo) {
      return currentTime >= meal.eligibleFrom && currentTime <= meal.eligibleTo;
    }
    // Overnight window check (e.g., 23:30 to 02:00)
    return currentTime >= meal.eligibleFrom || currentTime <= meal.eligibleTo;
  });

  res.json({
    success: true,
    currentTime,
    data: eligibleMeals.length > 0 ? eligibleMeals : [db.meals[1]], // Fallback to Lunch for testing
  });
});

// POST /api/meals - Add new meal
mealsRouter.post('/', (req: Request, res: Response) => {
  const { code, name, cost, eligibleFrom, eligibleTo } = req.body;

  if (!code || !name || cost === undefined || !eligibleFrom || !eligibleTo) {
    res.status(400).json({ success: false, message: 'All fields are required' });
    return;
  }

  const newMeal: Meal = {
    id: `mel-${Date.now()}`,
    code,
    name,
    cost: Number(cost),
    eligibleFrom,
    eligibleTo,
  };

  db.meals.push(newMeal);
  res.status(201).json({ success: true, data: newMeal, message: 'Meal registered successfully' });
});

// PUT /api/meals/:id - Update meal
mealsRouter.put('/:id', (req: Request, res: Response) => {
  const index = db.meals.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, message: 'Meal not found' });
    return;
  }

  db.meals[index] = { ...db.meals[index], ...req.body, id: db.meals[index].id };
  res.json({ success: true, data: db.meals[index], message: 'Meal updated successfully' });
});

// DELETE /api/meals/:id - Delete meal
mealsRouter.delete('/:id', (req: Request, res: Response) => {
  const index = db.meals.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ success: false, message: 'Meal not found' });
    return;
  }

  const deleted = db.meals.splice(index, 1)[0];
  res.json({ success: true, data: deleted, message: 'Meal removed successfully' });
});
