/**
 * ============================================================================
 * PCW Eats Full-Stack Server Entry Point (server.ts)
 * ============================================================================
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/routes";
import { prisma } from "./server/db/prisma";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const APP_URL = process.env.APP_URL || `http://localhost`;
  const isProduction = process.env.NODE_ENV === "production";

  const PCW_RIDE_API_URL =
    process.env.PCW_RIDE_API_URL || "http://localhost:5000/api/v1";

  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false,
      xFrameOptions: false,
    }),
  );

  app.use((_req, res, next) => {
    res.removeHeader("X-Frame-Options");
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many requests. Please try again later.",
      },
    }),
  );

  app.use(morgan(isProduction ? "combined" : "dev"));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // MUST be before any middleware that reads req.cookies
  app.use(cookieParser());

  // Inject Authorization header from the sid cookie so PCW Eats APIs can
  // authenticate using the SSO cookie set by /sso.
  app.use("/api", (req, _res, next) => {
    if (!req.headers.authorization && req.cookies?.sid) {
      req.headers.authorization = `Bearer ${req.cookies.sid}`;
    }
    next();
  });

  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const contentType = req.headers["content-type"] || "";
      if (
        contentType.includes("application/json") &&
        req.body !== undefined &&
        typeof req.body !== "object"
      ) {
        res
          .status(400)
          .json({ success: false, message: "JSON body must be an object." });
        return;
      }
    }
    next();
  });

  app.use("/api", apiRouter);

  app.use("/api", (_req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 401) res.clearCookie("sid", { path: "/" });
      return originalJson(body);
    };
    next();
  });

  // -------------------------------------------------------------------------
  // SSO entry point — /sso?token=<pcw-ride-access-token>
  // -------------------------------------------------------------------------
  // app.get("/sso", async (req, res) => {
  //   const token = String(req.query.token || "");
  //   if (!token) return res.redirect("/");

  //   try {
  //     const r = await fetch(`${PCW_RIDE_API_URL}/auth/validate`, {
  //       method: "POST",
  //       headers: { Authorization: `Bearer ${token}` },
  //     });

  //     if (!r.ok) {
  //       console.log("Auth error from PCW Ride:", await r.text());
  //       return res.redirect("/login");
  //     }

  //     console.log("Auth success, setting cookie and redirecting to /");

  //     res.cookie("sid", token, {
  //       httpOnly: true,
  //       sameSite: "lax",
  //       secure: isProduction,
  //       path: "/",
  //       maxAge: 1000 * 60 * 60 * 24 * 7,
  //     });

  //     return res.redirect("/");
  //   } catch (err) {
  //     console.error("SSO validation failed:", err);
  //     return res.redirect("/login");
  //   }
  // });

  // -------------------------------------------------------------------------
  // Welcome / SSO entry — PCW Ride redirects here with ?token=...
  // Validates token, sets sid cookie, then redirects to the SPA /welcome page.
  // The SPA /welcome page then calls /api/auth/me to hydrate the user.
  // -------------------------------------------------------------------------
  app.get("/welcome", async (req, res) => {
    const token = String(req.query.token || "");

    if (!token) {
      console.log("No token in /welcome request — redirecting to SPA welcome screen");
      // No token → send to SPA welcome screen to show "log in via PCW Ride".
      return res.redirect("/?auth=missing");
    }

    try {
      const r = await fetch(`${PCW_RIDE_API_URL}/auth/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) {
        console.log("SSO validation failed:", await r.text());
        return res.redirect("/?auth=failed");
      }

      console.log("SSO validation successfull");

      res.cookie("sid", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });

      // Fresh cookie — land on the SPA welcome/loading page.
      return res.redirect("/?auth=ok");
    } catch (err) {
      console.error("SSO validation error:", err);
      return res.redirect("/?auth=failed");
    }
  });

  // Frontend integration
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: `Route not found: ${_req.originalUrl}`,
    });
  });

  app.use(
    (
      err: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(
        `Request error on ${_req.method} ${_req.originalUrl}:`,
        err,
      );
      res.status(err.status || 500).json({
        success: false,
        message: isProduction ? "Something went wrong." : err.message,
      });
    },
  );

  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL connected via Prisma");
  } catch (err) {
    console.error(
      "❌ Could not connect to PostgreSQL. Check DATABASE_URL and that the DB is running.",
    );
    throw err;
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("====================================================");
    console.log(`🚀 PCW Eats Server running on ${APP_URL}:${PORT}`);
    console.log(`📡 API Endpoints live at ${APP_URL}:${PORT}/api`);
    console.log(`🫆 ZKTeco MB360 Bridge online at /api/zkteco`);
    console.log(`🔗 PCW Ride backend: ${PCW_RIDE_API_URL}`);
    console.log("====================================================");
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down…`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
