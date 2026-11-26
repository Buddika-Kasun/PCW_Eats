/**
 * ============================================================================
 * Special Orders Routes (/api/special-orders)
 * ============================================================================
 *  POST   /api/special-orders              → create order (+ guest users)
 *  GET    /api/special-orders              → list (filters: userId, deptId, month)
 *  GET    /api/special-orders/:id          → detail (with guests)
 *  PUT    /api/special-orders/:id          → update (purpose, count, meal)
 *  DELETE /api/special-orders/:id          → soft-delete order + guests
 *  GET    /api/special-orders/next-id      → preview next order id (optional)
 * ============================================================================
 */

import { Router, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { PCW_RIDE_API_URL } from "../config";
import { fetchPcwUser } from "./dashboard";
import { isInWindow, nowInColombo } from "./meals";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function yyyymmdd(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Generates "O" + YYYYMMDD + zero-padded sequence (e.g. O20261126001).
 * Sequence resets daily.
 */
async function generateOrderNo(): Promise<string> {
  const prefix = `M`;
  const last = await prisma.specialOrder.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: "desc" },
    select: { orderNo: true },
  });
  const seq = last ? Number(last.orderNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq)}`;
}

/**
 * Generates the next guest user id across the whole table, starting from
 * "S1001". Uses the highest numeric suffix currently stored.
 */
async function generateGuestIds(count: number): Promise<string[]> {
  const lastGuest = await prisma.specialOrderGuest.findFirst({
    where: { id: { startsWith: "S" } },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  const next = lastGuest ? Number(lastGuest.id.slice(1)) + 10 : 1;
  return Array.from({ length: count }, (_, i) => `S${next + i}`);
}

/* -------------------------------------------------------------------------- */
/* POST /api/special-orders                                                    */
/* -------------------------------------------------------------------------- */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      requesterId,
      requesterName,
      departmentId,
      departmentName,
      mealId,
      count,
      purpose,
    } = req.body ?? {};

    if (!requesterId || !mealId) {
      return res.status(400).json({
        success: false,
        message: "requesterId, departmentId, mealId are required",
      });
    }
    const qty = Math.max(1, Math.min(500, Number(count) || 0));
    if (!qty) {
      return res
        .status(400)
        .json({ success: false, message: "count must be at least 1" });
    }
    if (!purpose || String(purpose).trim().length < 3) {
      return res
        .status(400)
        .json({ success: false, message: "purpose is required" });
    }

    // Look up meal to get its name
    const meal = await prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) {
      return res
        .status(404)
        .json({ success: false, message: "Meal not found" });
    }

    const orderNo = await generateOrderNo();
    const guestIds = await generateGuestIds(qty);

    const requester = await fetchPcwUser(requesterId);

    const order = await prisma.specialOrder.create({
      data: {
        id: `so-${Date.now()}`,
        orderNo,
        requesterId: String(requester?.id ?? requesterId),
        requesterName: requester?.name ?? String(requesterName ?? ""),
        departmentId: String(requester?.deptId ?? departmentId ?? ""),
        departmentName: requester?.deptName ?? String(departmentName ?? ""),
        mealId: meal.id,
        mealName: meal.name,
        count: qty,
        releasedCount: 0,
        purpose: String(purpose),
        guestRangeStart: guestIds[0],
        guestRangeEnd: guestIds[guestIds.length - 1],
        createdBy: String(requesterId),
        updatedBy: String(requesterId),
        guests: {
          create: guestIds.map((id) => ({
            id,
            createdBy: String(requesterId),
            updatedBy: String(requesterId),
          })),
        },
      },
      include: { guests: true },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...order,
        guestRange: {
          start: order.guestRangeStart,
          end: order.guestRangeEnd,
          ids: order.guests.map((g) => g.id),
        },
      },
      message: "Special order created",
    });
  } catch (err) {
    console.error("special-orders POST error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not create special order" });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/special-orders                                                     */
/* -------------------------------------------------------------------------- */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    let newUserId;
    if (req.query.userId == "1000" || req.query.userId == "999999") {
      const fetchedUser = await fetchPcwUser(req.query.userId as string);
      newUserId = fetchedUser ? fetchedUser.id : null;
    }
    const deptId = String(req.query.deptId ?? "").trim();
    const month = String(req.query.month ?? "").trim(); // YYYY-MM

    const where: any = { active: true };
    if (userId) where.requesterId = newUserId;
    if (deptId) where.departmentId = deptId;
    if (month) {
      const from = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      where.createdAt = {
        gte: new Date(`${from}T00:00:00Z`),
        lte: new Date(`${to}T23:59:59Z`),
      };
    }

    const rows = await prisma.specialOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { guests: { where: { active: true }, select: { id: true } } },
    });

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        orderNo: r.orderNo,
        requesterId: r.requesterId,
        requesterName: r.requesterName,
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        mealId: r.mealId,
        mealName: r.mealName,
        count: r.count,
        releasedCount: r.releasedCount,
        purpose: r.purpose,
        guestRangeStart: r.guestRangeStart,
        guestRangeEnd: r.guestRangeEnd,
        guestIds: r.guests.map((g) => g.id),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total: rows.length,
    });
  } catch (err) {
    console.error("special-orders GET error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not load special orders" });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/special-orders/:id                                                 */
/* -------------------------------------------------------------------------- */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const row = await prisma.specialOrder.findFirst({
      where: { id: req.params.id, active: true },
      include: { guests: { where: { active: true } } },
    });
    if (!row) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("special-orders GET :id error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not load order" });
  }
});

/* -------------------------------------------------------------------------- */
/* PUT /api/special-orders/:id                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Allowed updates: purpose, mealId, count.
 * When count changes:
 *   - If new count > old count → create more guests
 *   - If new count < old count → soft-delete the extra guest users
 *   - Range fields recomputed from remaining active guests
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { purpose, mealId, count, updatedBy } = req.body ?? {};

    const existing = await prisma.specialOrder.findFirst({
      where: { id, active: true },
      include: { guests: { where: { active: true }, orderBy: { id: "asc" } } },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    let newMealId = existing.mealId;
    let newMealName = existing.mealName;
    if (mealId && mealId !== existing.mealId) {
      const meal = await prisma.meal.findUnique({ where: { id: mealId } });
      if (!meal) {
        return res
          .status(404)
          .json({ success: false, message: "Meal not found" });
      }
      newMealId = meal.id;
      newMealName = meal.name;
    }

    const newCount =
      count !== undefined
        ? Math.max(1, Math.min(500, Number(count)))
        : existing.count;

    const activeGuests = existing.guests.map((g) => g.id);

    // grow
    let added: string[] = [];
    if (newCount > activeGuests.length) {
      const need = newCount - activeGuests.length;
      added = await generateGuestIds(need);
      await prisma.specialOrderGuest.createMany({
        data: added.map((gid) => ({
          id: gid,
          orderId: id,
          createdBy: updatedBy ? String(updatedBy) : existing.requesterId,
          updatedBy: updatedBy ? String(updatedBy) : existing.requesterId,
        })),
      });
    }

    // shrink
    if (newCount < activeGuests.length) {
      const toRemove = activeGuests.slice(newCount);
      if (toRemove.length > 0) {
        await prisma.specialOrderGuest.updateMany({
          where: { id: { in: toRemove } },
          data: {
            active: false,
            updatedBy: updatedBy ? String(updatedBy) : existing.requesterId,
          },
        });
      }
    }

    // recompute range from final active set
    const finalGuests = await prisma.specialOrderGuest.findMany({
      where: { orderId: id, active: true },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    const rangeStart = finalGuests[0]?.id ?? null;
    const rangeEnd = finalGuests[finalGuests.length - 1]?.id ?? null;

    const updated = await prisma.specialOrder.update({
      where: { id },
      data: {
        purpose: purpose !== undefined ? String(purpose) : existing.purpose,
        mealId: newMealId,
        mealName: newMealName,
        count: newCount,
        guestRangeStart: rangeStart,
        guestRangeEnd: rangeEnd,
        updatedBy: updatedBy ? String(updatedBy) : existing.requesterId,
      },
      include: { guests: { where: { active: true } } },
    });

    return res.json({
      success: true,
      data: {
        ...updated,
        guestRange: {
          start: rangeStart,
          end: rangeEnd,
          ids: finalGuests.map((g) => g.id),
        },
      },
      message: "Order updated",
    });
  } catch (err) {
    console.error("special-orders PUT error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not update order" });
  }
});

/* -------------------------------------------------------------------------- */
/* DELETE /api/special-orders/:id                                             */
/* -------------------------------------------------------------------------- */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedBy = req.query.updatedBy ? String(req.query.updatedBy) : null;

    const existing = await prisma.specialOrder.findFirst({
      where: { id, active: true },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    await prisma.$transaction([
      prisma.specialOrderGuest.updateMany({
        where: { orderId: id },
        data: {
          active: false,
          updatedBy: updatedBy ?? existing.requesterId,
        },
      }),
      prisma.specialOrder.update({
        where: { id },
        data: {
          active: false,
          updatedBy: updatedBy ?? existing.requesterId,
        },
      }),
    ]);

    return res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    console.error("special-orders DELETE error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not delete order" });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/special-orders/lookup/:code                                        */
/* -------------------------------------------------------------------------- */
/**
 * Resolves a scanned code into one of:
 *   - { type: "order", order }
 *   - { type: "guest", guest, order }
 *   - { type: "none" }
 * Also computes eligibility via the currently-open meal window and duplicate
 * checks against Transaction rows.
 *
 * Accepted inputs:
 *   Guest : "S1", "#S1", "S1001"
 *   Order : "M1", "#M1", "M12", "1", "#1"   ("1" → "M1")
 */
router.get("/lookup/:code", async (req: Request, res: Response) => {
  try {
    const raw = String(req.params.code ?? "").trim();
    if (!raw) {
      return res
        .status(400)
        .json({ success: false, message: "code is required" });
    }
    const code = raw.replace(/^#/, "").toUpperCase();

    /* ==================================================================== */
    /* GUEST LOOKUP: S1, S2, … S1001 …                                      */
    /* ==================================================================== */
    if (/^S\d+$/.test(code)) {
      const guest = await prisma.specialOrderGuest.findFirst({
        where: { id: code, active: true },
        include: {
          order: {
            include: {
              guests: { where: { active: true }, select: { id: true } },
            },
          },
        },
      });
      if (!guest || !guest.order.active) {
        return res.json({
          success: true,
          data: {
            type: "none",
            reason: `Guest ${code} not found or its order was cancelled.`,
          },
        });
      }

      const { order } = guest;

      // Which meal window is open right now?
      const { time: now, date: today } = nowInColombo();
      const meals = await prisma.meal.findMany({ where: { active: true } });
      const openMeals = meals.filter((m) =>
        isInWindow(now, m.eligibleFrom, m.eligibleTo),
      );

      // Resolve the order's meal (by id, fallback to name)
      const orderMeal =
        meals.find((m) => m.id === order.mealId) ??
        meals.find(
          (m) =>
            m.name.trim().toLowerCase() === order.mealName.trim().toLowerCase(),
        );

      if (!orderMeal) {
        return res.json({
          success: true,
          data: {
            type: "guest",
            guest: {
              id: guest.id,
              orderId: order.id,
              orderNo: order.orderNo,
            },
            order: summarizeOrder(order),
            eligible: false,
            reason: "Meal referenced by this order no longer exists.",
          },
        });
      }

      if (!openMeals.some((m) => m.id === orderMeal.id)) {
        return res.json({
          success: true,
          data: {
            type: "guest",
            guest: {
              id: guest.id,
              orderId: order.id,
              orderNo: order.orderNo,
            },
            order: summarizeOrder(order),
            eligible: false,
            reason: `Meal window for "${orderMeal.name}" is not open right now.`,
          },
        });
      }

      // Duplicate check — MUST match the format written by /:id/release
      // ("guest:<orderId>:<guestId>"). Earlier code used "guest:<guestId>"
      // which never matched, allowing double-releases.
      const already = await prisma.transaction.findFirst({
        where: {
          active: true,
          date: today,
          type: "meal",
          item: orderMeal.id,
          userId: `guest:${order.id}:${guest.id}`,
        },
      });
      if (already) {
        return res.json({
          success: true,
          data: {
            type: "guest",
            guest: {
              id: guest.id,
              orderId: order.id,
              orderNo: order.orderNo,
            },
            order: summarizeOrder(order),
            eligible: false,
            reason: `Guest ${guest.id} has already received "${orderMeal.name}" today.`,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          type: "guest",
          guest: {
            id: guest.id,
            orderId: order.id,
            orderNo: order.orderNo,
          },
          order: summarizeOrder(order),
          meal: {
            id: orderMeal.id,
            code: orderMeal.code,
            name: orderMeal.name,
            cost: orderMeal.cost,
            eligibleFrom: orderMeal.eligibleFrom,
            eligibleTo: orderMeal.eligibleTo,
          },
          eligible: true,
          remaining: 1, // a single guest is 1 unit
        },
      });
    }

    /* ==================================================================== */
    /* ORDER LOOKUP: M1, M12, M123… or bare "1", "12"…                      */
    /* ==================================================================== */
    let order = await prisma.specialOrder.findFirst({
      where: { orderNo: code, active: true },
      include: { guests: { where: { active: true }, select: { id: true } } },
    });

    // Bare numeric input → treat as "M<n>" (e.g. "1" → "M1")
    if (!order && /^\d+$/.test(code)) {
      order = await prisma.specialOrder.findFirst({
        where: { orderNo: `M${code}`, active: true },
        include: {
          guests: { where: { active: true }, select: { id: true } },
        },
      });
    }

    if (!order) {
      return res.json({
        success: true,
        data: { type: "none", reason: `Order ${code} not found.` },
      });
    }

    // Open meal window check
    const { time: now, date: today } = nowInColombo();
    const meals = await prisma.meal.findMany({ where: { active: true } });
    const orderMeal =
      meals.find((m) => m.id === order.mealId) ??
      meals.find(
        (m) =>
          m.name.trim().toLowerCase() === order.mealName.trim().toLowerCase(),
      );

    if (!orderMeal) {
      return res.json({
        success: true,
        data: {
          type: "order",
          order: summarizeOrder(order),
          eligible: false,
          reason: "Meal referenced by this order no longer exists.",
        },
      });
    }

    if (!isInWindow(now, orderMeal.eligibleFrom, orderMeal.eligibleTo)) {
      return res.json({
        success: true,
        data: {
          type: "order",
          order: summarizeOrder(order),
          meal: {
            id: orderMeal.id,
            code: orderMeal.code,
            name: orderMeal.name,
            cost: orderMeal.cost,
            eligibleFrom: orderMeal.eligibleFrom,
            eligibleTo: orderMeal.eligibleTo,
          },
          eligible: false,
          reason: `Meal window for "${orderMeal.name}" is not open right now.`,
        },
      });
    }

    // Remaining = count − releasedCount. `releasedCount` is incremented
    // atomically in /:id/release, so we do NOT add releasedToday again
    // (the old code double-counted every release).
    const remaining = Math.max(0, order.count - order.releasedCount);

    if (remaining === 0) {
      return res.json({
        success: true,
        data: {
          type: "order",
          order: summarizeOrder(order),
          meal: {
            id: orderMeal.id,
            code: orderMeal.code,
            name: orderMeal.name,
            cost: orderMeal.cost,
            eligibleFrom: orderMeal.eligibleFrom,
            eligibleTo: orderMeal.eligibleTo,
          },
          eligible: false,
          remaining: 0,
          reason: `All ${order.count} meals for this order have already been released.`,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        type: "order",
        order: summarizeOrder(order),
        meal: {
          id: orderMeal.id,
          code: orderMeal.code,
          name: orderMeal.name,
          cost: orderMeal.cost,
          eligibleFrom: orderMeal.eligibleFrom,
          eligibleTo: orderMeal.eligibleTo,
        },
        eligible: true,
        remaining,
      },
    });
  } catch (err) {
    console.error("special-orders lookup error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not resolve code" });
  }
});

/* -------------------------------------------------------------------------- */
/* POST /api/special-orders/:id/release                                        */
/* -------------------------------------------------------------------------- */
/**
 * Releases `count` units from a special order.
 *  - Must not exceed remaining.
 *  - Creates one Transaction per released unit with userId = `guest:<orderId>:<guestId>`
 *    (or `guest:bulk:<orderId>` if guests have run out — shouldn't happen if
 *    releasedCount stays in sync with guest active count).
 *  - Increments order.releasedCount.
 */
router.post("/:id/release", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { count, canteenId, releasedBy } = req.body ?? {};
    const qty = Math.max(1, Math.min(500, Number(count) || 0));
    if (!qty) {
      return res
        .status(400)
        .json({ success: false, message: "count must be >= 1" });
    }

    const order = await prisma.specialOrder.findFirst({
      where: { id, active: true },
      include: {
        guests: { where: { active: true }, orderBy: { id: "asc" } },
      },
    });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const remaining = Math.max(0, order.count - order.releasedCount);
    if (remaining === 0) {
      return res.status(400).json({
        success: false,
        message: "All units already released for this order",
      });
    }
    if (qty > remaining) {
      return res.status(400).json({
        success: false,
        message: `Cannot release ${qty}; only ${remaining} remaining`,
      });
    }

    const { date: today, time: now } = nowInColombo();
    const meal = await prisma.meal.findUnique({
      where: { id: order.mealId },
    });
    const cost = meal?.cost ?? 0;

    // Pick the next qty guests that haven't been released yet
    const usedGuestIds = new Set(
      (
        await prisma.transaction.findMany({
          where: {
            active: true,
            date: today,
            type: "meal",
            item: order.mealId,
            userId: { startsWith: `guest:${order.id}:` },
          },
          select: { userId: true },
        })
      ).map((t) => t.userId ?? ""),
    );

    const unusedGuests = order.guests.filter(
      (g) => !usedGuestIds.has(`guest:${order.id}:${g.id}`),
    );
    if (unusedGuests.length < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${unusedGuests.length} unreleased guests left in this order`,
      });
    }

    const batch = unusedGuests.slice(0, qty);

    // One transaction per guest release
    const txs = await prisma.$transaction(
      batch.map((g) =>
        prisma.transaction.create({
          data: {
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: today,
            time: now,
            departmentId: order.departmentId,
            dept: order.departmentName,
            item: order.mealId,
            qty: 1,
            cost,
            type: "meal",
            category: "special-order",
            userId: `guest:${order.id}:${g.id}`,
            userName: `Guest ${g.id}`,
            canteenId: canteenId ?? null,
            active: true,
          },
        }),
      ),
    );

    // Update counters
    const updatedOrder = await prisma.specialOrder.update({
      where: { id },
      data: {
        releasedCount: { increment: qty },
        updatedBy: releasedBy ? String(releasedBy) : order.updatedBy,
      },
      include: {
        guests: { where: { active: true }, orderBy: { id: "asc" } },
      },
    });

    return res.json({
      success: true,
      data: {
        order: summarizeOrder(updatedOrder),
        releasedCount: qty,
        remaining: Math.max(0, updatedOrder.count - updatedOrder.releasedCount),
        releasedGuestIds: batch.map((g) => g.id),
        transactions: txs.map((t) => t.id),
      },
      message: `${qty} meal${qty > 1 ? "s" : ""} released`,
    });
  } catch (err) {
    console.error("special-orders release error:", err);
    return res
      .status(502)
      .json({ success: false, message: "Could not release order" });
  }
});

/* -------------------------------------------------------------------------- */
/* Helper: summarizeOrder                                                      */
/* -------------------------------------------------------------------------- */
function summarizeOrder(o: any) {
  return {
    id: o.id,
    orderNo: o.orderNo,
    requesterId: o.requesterId,
    requesterName: o.requesterName,
    departmentId: o.departmentId,
    departmentName: o.departmentName,
    mealId: o.mealId,
    mealName: o.mealName,
    count: o.count,
    releasedCount: o.releasedCount,
    remaining: Math.max(0, o.count - o.releasedCount),
    purpose: o.purpose,
    guestRangeStart: o.guestRangeStart,
    guestRangeEnd: o.guestRangeEnd,
    guestIds: Array.isArray(o.guests) ? o.guests.map((g: any) => g.id) : [],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export const specialOrdersRouter = router;
