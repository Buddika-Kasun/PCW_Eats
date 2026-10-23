/**
 * ============================================================================
 * Meal Management Routes (/api/meals) — Prisma/PostgreSQL
 * ============================================================================
 * Handles meal catalog items and eligibility time slots
 * (Breakfast, Lunch, Dinner, Midnight shift meals).
 */

import { Router, Request, Response } from "express";
import { getMeals, createMeal, updateMeal, deleteMeal } from "../db/store";
import { Meal } from "../../src/types";

const router = Router();

// GET /api/meals - List all meal types
router.get("/", async (_req: Request, res: Response) => {
  try {
    const meals = await getMeals();
    res.json({ success: true, data: meals, total: meals.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/meals/active - Return meals currently eligible based on current local time
router.get("/active", async (_req: Request, res: Response) => {
  try {
    const meals = await getMeals();
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, "0");
    const currentMinutes = now.getMinutes().toString().padStart(2, "0");
    const currentTime = `${currentHours}:${currentMinutes}`;

    const eligibleMeals = meals.filter((meal) => {
      // Basic window check
      if (meal.eligibleFrom <= meal.eligibleTo) {
        return (
          currentTime >= meal.eligibleFrom && currentTime <= meal.eligibleTo
        );
      }
      // Overnight window check (e.g., 23:30 to 02:00)
      return currentTime >= meal.eligibleFrom || currentTime <= meal.eligibleTo;
    });

    // Fallback to Lunch (the "MEL-002" seed row) when nothing is currently open,
    // so the POS screen still has something to show.
    const lunch = meals.find((m) => m.code === "MEL-002") ?? meals[1] ?? null;
    const data =
      eligibleMeals.length > 0 ? eligibleMeals : lunch ? [lunch] : [];

    res.json({ success: true, currentTime, data });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/meals - Add new meal
router.post("/", async (req: Request, res: Response) => {
  try {
    const { code, name, cost, eligibleFrom, eligibleTo } = req.body;

    if (!code || !name || cost === undefined || !eligibleFrom || !eligibleTo) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const newMeal: Meal = {
      id: `mel-${Date.now()}`,
      code,
      name,
      cost: Number(cost),
      eligibleFrom,
      eligibleTo,
    };

    const created = await createMeal(newMeal);
    res.status(201).json({
      success: true,
      data: created,
      message: "Meal registered successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// PUT /api/meals/:id - Update meal
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const updated = await updateMeal(req.params.id, {
      ...req.body,
      id: req.params.id, // preserve id; updateMeal ignores it anyway
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Meal not found" });
    }
    res.json({
      success: true,
      data: updated,
      message: "Meal updated successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// DELETE /api/meals/:id - Delete meal
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    // Fetch first so we can echo the deleted row back (matches original behavior)
    const meals = await getMeals();
    const existing = meals.find((m) => m.id === req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Meal not found" });
    }

    const ok = await deleteMeal(req.params.id);
    if (!ok) {
      return res
        .status(404)
        .json({ success: false, message: "Meal not found" });
    }

    res.json({
      success: true,
      data: existing,
      message: "Meal removed successfully",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

export default router;
