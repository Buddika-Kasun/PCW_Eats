/**
 * ============================================================================
 * ZKTeco MB360 Biometric API Routes (/api/zkteco) — Prisma/PostgreSQL
 * ============================================================================
 *
 * Provides HTTP endpoints and Server-Sent Events (SSE) for the ZKTeco MB360
 * Fingerprint & Facial recognition terminal.
 *
 * Endpoints:
 * - GET  /api/zkteco/status        : Returns connection state, configured IP, model
 * - POST /api/zkteco/config        : Update IP (default 192.168.1.201), Port, mode
 * - POST /api/zkteco/simulate-scan : Simulates an employee finger scan for testing
 * - POST /api/zkteco/punch         : Ingests punch log from device/agent
 * - GET  /api/zkteco/logs          : Returns latest biometric audit logs
 * - GET  /api/zkteco/events        : Live SSE stream pushing fingerprint events to browser
 */

import { Router, Request, Response } from "express";
import { zktecoService } from "../services/zktecoService";
import { getBiometricLogs } from "../db/store";

const router = Router();

// GET /api/zkteco/status - Device status and connection details
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: zktecoService.getStatus(),
  });
});

// POST /api/zkteco/config - Update device connection settings
router.post("/config", (req: Request, res: Response) => {
  try {
    const { ip, port, commKey, deviceName, mode } = req.body;
    const updated = zktecoService.updateConfig({
      ...(ip ? { ip } : {}),
      ...(port ? { port: Number(port) } : {}),
      ...(commKey !== undefined ? { commKey: Number(commKey) } : {}),
      ...(deviceName ? { deviceName } : {}),
      ...(mode ? { mode } : {}),
    });

    res.json({
      success: true,
      data: updated,
      message: "ZKTeco MB360 configuration updated",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/zkteco/simulate-scan - Trigger simulated fingerprint scan
router.post("/simulate-scan", async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.body;
    const result = await zktecoService.simulateScan(employeeId);
    res.json({
      success: result.success,
      data: result,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/zkteco/punch - Punch ingestion endpoint for real hardware or ADMS hook
router.post("/punch", async (req: Request, res: Response) => {
  try {
    const { userIdOrCard, verifyType = "fingerprint", deviceId } = req.body;
    if (!userIdOrCard) {
      return res
        .status(400)
        .json({ success: false, message: "userIdOrCard is required" });
    }

    const result = await zktecoService.handleDevicePunch({
      userIdOrCard,
      verifyType,
      deviceId,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/zkteco/logs - Recent biometric attendance logs
router.get("/logs", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const logs = await getBiometricLogs(limit);
    res.json({
      success: true,
      data: logs,
      total: logs.length,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/zkteco/events - Real-time Server-Sent Events (SSE) stream
router.get("/events", (req: Request, res: Response) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send initial handshake
  res.write(
    `data: ${JSON.stringify({ type: "connected", time: new Date().toISOString() })}\n\n`,
  );

  // Listener callback for biometric events
  const onScan = (eventData: unknown) => {
    res.write(
      `data: ${JSON.stringify({ type: "biometric_scan", ...(eventData as object) })}\n\n`,
    );
  };

  zktecoService.on("scan", onScan);

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 20000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    zktecoService.removeListener("scan", onScan);
  });
});

export default router;
