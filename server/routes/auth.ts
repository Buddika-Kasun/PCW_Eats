// /**
//  * ============================================================================
//  * Auth Routes — mounted at /api/auth
//  * ============================================================================
//  */

// import { Router } from "express";

// const router = Router();

// const PCW_RIDE_API_URL =
//   process.env.PCW_RIDE_API_URL || "http://localhost:5000/api/v1";

// /** GET /api/auth/me — returns the user from the sid cookie */
// router.get("/me", async (req, res) => {
//   const token = req.cookies?.sid;
//   if (!token) {
//     return res.status(401).json({ success: false, message: "No session" });
//   }

//   try {
//     const r = await fetch(`${PCW_RIDE_API_URL}/auth/validate`, {
//       method: "POST",
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     if (!r.ok) {
//       res.clearCookie("sid", { path: "/" });
//       return res
//         .status(401)
//         .json({ success: false, message: "Invalid session" });
//     }

//     const user = await r.json();
//     return res.json({ success: true, data: user });
//   } catch (err) {
//     console.error("auth/me failed:", err);
//     res.clearCookie("sid", { path: "/" });
//     return res
//       .status(401)
//       .json({ success: false, message: "Auth check failed" });
//   }
// });

// /** POST /api/auth/logout */
// router.post("/logout", (_req, res) => {
//   res.clearCookie("sid", { path: "/" });
//   return res.json({ success: true });
// });

// export const authRouter = router;

/**
 * ============================================================================
 * Auth Routes — mounted at /api/auth
 * ============================================================================
 */

import { Router } from "express";
import { findLocalAccount, signLocalToken, verifyLocalToken } from "../services/localAuth";

const router = Router();

const PCW_RIDE_API_URL =
  process.env.PCW_RIDE_API_URL || "http://localhost:5000/api/v1";

const isProduction = process.env.NODE_ENV === "production";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

/** Extract "Bearer <token>" from the Authorization header. */
function getBearerToken(req: { headers: Record<string, any> }): string | null {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== "string") return null;
  const [scheme, value] = auth.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
}

// ---------------------------------------------------------------------------
// POST /api/auth/login  — local accounts (canteen / dev)
// ---------------------------------------------------------------------------
router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Username and password required" });
  }

  const user = findLocalAccount(username, password);
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid credentials" });
  }

  const token = signLocalToken(user);
  res.cookie("sid", token, COOKIE_OPTS);

  return res.json({ success: true, data: { user, valid: true, token } });
});

/** GET /api/auth/me — returns the user from the Bearer token */
router.get("/me", async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "No token" });
  }

  // 1) Local session (canteen / dev)? Validate offline.
  if (token.startsWith("local.")) {
    const user = verifyLocalToken(token);
    if (!user) {
      res.clearCookie("sid", { path: "/" });
      return res
        .status(401)
        .json({ success: false, message: "Invalid session" });
    }
    return res.json({ success: true, data: { user, valid: true } });
  }

  try {
    const r = await fetch(`${PCW_RIDE_API_URL}/auth/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const user = await r.json();
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error("auth/me failed:", err);
    return res
      .status(401)
      .json({ success: false, message: "Auth check failed" });
  }
});

/** POST /api/auth/logout — client just drops its stored token */
router.post("/logout", (_req, res) => {
  // No server-side session to destroy; the SPA clears localStorage itself.
  return res.json({ success: true });
});

export const authRouter = router;
