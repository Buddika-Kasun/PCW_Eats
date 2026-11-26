/**
 * ============================================================================
 * User Routes (/api/users) — mounted at /api/users
 * ============================================================================
 * Thin proxy to PCW Ride's public user directory.
 * No auth required on the PCW Ride side — we just forward the query.
 *
 * PCW Ride response shape (from actual API):
 *   {
 *     success: true,
 *     data: {
 *       users: [{ id, displayname, role, phone, departmentName }, ...],
 *       total: N
 *     },
 *     message, timestamp, statusCode
 *   }
 * ============================================================================
 */

import { Router, Request, Response } from "express";
import { PCW_RIDE_API_URL } from "../config";

const router = Router();

/** Shape we return to our frontend. */
interface DirectoryUser {
  id: string;
  name: string;
  dept: string;
  role: string;
  phone: string;
  raw: unknown;
}

/** Normalise a PCW Ride user row → our flat DirectoryUser. */
function normaliseUser(u: any): DirectoryUser {
  return {
    id: String(u?.id ?? u?.username ?? ""),
    name: u?.displayname ?? u?.username ?? u?.email ?? u?.phone ?? "Unknown",
    dept: u?.departmentName ?? u?.department ?? u?.dept ?? "",
    role: u?.role ?? "",
    phone: u?.phone ?? "",
    raw: u,
  };
}

/**
 * GET /api/users/search?query=<term>
 */
router.get("/search", async (req: Request, res: Response) => {
  const query = String(req.query.query ?? "").trim();
  if (!query) {
    return res
      .status(400)
      .json({ success: false, message: "query is required" });
  }

  try {
    const url = `${PCW_RIDE_API_URL}/user/search-eats?query=${encodeURIComponent(
      query,
    )}`;

    const upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      console.warn(`PCW Ride user search failed [${upstream.status}]:`, text);
      return res.status(upstream.status).json({
        success: false,
        message: "User search failed upstream",
      });
    }

    const body: any = await upstream.json();

    // Extract the array of user rows from whatever nesting PCW Ride uses.
    // Known shape: body.data.users
    // Also tolerate: body.data (array), body.users, body itself (array).
    let rawData: any[] = [];
    if (Array.isArray(body)) {
      rawData = body;
    } else if (Array.isArray(body?.data?.users)) {
      rawData = body.data.users;
    } else if (Array.isArray(body?.data)) {
      rawData = body.data;
    } else if (Array.isArray(body?.users)) {
      rawData = body.users;
    }

    const data = rawData.map(normaliseUser);

    // Use upstream total if present, else our count.
    const total = Number(body?.data?.total ?? body?.total ?? data.length);

    return res.json({ success: true, data, total });
  } catch (err) {
    console.error("user/search proxy error:", err);
    return res.status(502).json({
      success: false,
      message: "Could not reach PCW Ride user directory",
    });
  }
});

/**
 * GET /api/users/:id — fetch one PCW Ride user by id.
 * PCW Ride may or may not expose this; if it doesn't, we fall back to
 * /user/search?query=<id> and pick the exact match.
 */
router.get("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    return res.status(400).json({ success: false, message: "id is required" });
  }

  try {
    // Try direct lookup first
    const directUrl = `${PCW_RIDE_API_URL}/user/${encodeURIComponent(id)}`;
    let directRes = await fetch(directUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    }).catch(() => null);

    if (directRes?.ok) {
      const body: any = await directRes.json();
      const u = body?.data?.user ?? body?.data ?? body?.user ?? body;
      if (u) {
        return res.json({ success: true, data: normaliseUser(u) });
      }
    }

    // Fallback: search by id and pick the exact match
    const searchUrl = `${PCW_RIDE_API_URL}/user/search?query=${encodeURIComponent(
      id,
    )}`;
    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!searchRes.ok) {
      return res.status(searchRes.status).json({
        success: false,
        message: "User lookup failed upstream",
      });
    }

    const searchBody: any = await searchRes.json();
    const rawData: any[] = Array.isArray(searchBody?.data?.users)
      ? searchBody.data.users
      : Array.isArray(searchBody?.data)
        ? searchBody.data
        : Array.isArray(searchBody)
          ? searchBody
          : [];

    const exact = rawData.find(
      (u) => String(u?.id ?? u?.username ?? "") === id,
    );

    if (!exact) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: normaliseUser(exact) });
  } catch (err) {
    console.error("user/:id proxy error:", err);
    return res.status(502).json({
      success: false,
      message: "Could not reach PCW Ride user directory",
    });
  }
});

export const usersRouter = router;
