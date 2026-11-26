/**
 * ============================================================================
 * Hikvision DS-K1T343 Biometric API Routes (/api/hikvision) — Prisma/PostgreSQL
 * ============================================================================
 *
 *  GET  /api/hikvision/status        → connection state, IP, model
 *  POST /api/hikvision/config        → update IP / port / credentials / mode
 *  POST /api/hikvision/simulate-scan → simulated punch for testing
 *  POST /api/hikvision/punch         → ingest single punch (agent / polling)
 *  POST /api/hikvision/events        → device HTTP Listener webhook (real push)
 *  GET  /api/hikvision/logs          → latest biometric audit logs
 *  GET  /api/hikvision/sse           → live SSE stream (biometric_scan events)
 * ============================================================================
 */

import { Router, Request, Response } from "express";
import { hikvisionService } from "../services/hikvisionService";
import { getBiometricLogs } from "../db/store";

const router = Router();

// GET /api/hikvision/status
router.get("/status", async (_req: Request, res: Response) => {
  res.json({ success: true, data: await hikvisionService.getStatus() });
});

// POST /api/hikvision/config
router.post("/config", (req: Request, res: Response) => {
  try {
    const {
      ip,
      port,
      protocol,
      username,
      password,
      deviceName,
      mode,
      timeout,
    } = req.body ?? {};

    const updated = hikvisionService.updateConfig({
      ...(ip ? { ip: String(ip) } : {}),
      ...(port ? { port: Number(port) } : {}),
      ...(protocol === "http" || protocol === "https" ? { protocol } : {}),
      ...(username !== undefined ? { username: String(username) } : {}),
      ...(password !== undefined ? { password: String(password) } : {}),
      ...(deviceName ? { deviceName: String(deviceName) } : {}),
      ...(timeout ? { timeout: Number(timeout) } : {}),
      ...(mode ? { mode } : {}),
    });

    res.json({
      success: true,
      data: updated,
      message: "Hikvision DS-K1T343 configuration updated",
    });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/hikvision/simulate-scan
router.post("/simulate-scan", async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.body ?? {};
    const result = await hikvisionService.simulateScan(employeeId);
    res.json({ success: result.success, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/hikvision/punch — agent/poller ingestion
router.post("/punch", async (req: Request, res: Response) => {
  try {
    const {
      userIdOrCard,
      verifyType = "fingerprint",
      deviceId,
    } = req.body ?? {};
    if (!userIdOrCard) {
      return res
        .status(400)
        .json({ success: false, message: "userIdOrCard is required" });
    }

    const result = await hikvisionService.handleDevicePunch({
      userIdOrCard: String(userIdOrCard),
      verifyType,
      deviceId,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// POST /api/hikvision/events — Hikvision HTTP Listener webhook
// Point the device's "HTTP Listening" setting at this URL.
router.post("/events", async (req: Request, res: Response) => {
  try {
    const raw: any = req.body;

    // ── 2. Extract JSON body(ies) from the multipart envelope ────────
    //  The device sends multipart/form-data like:
    //    --MIME_boundary\r\n
    //    Content-Disposition: form-data; name="AccessControllerEvent"\r\n
    //    Content-Type: application/json\r\n
    //    Content-Length: 678\r\n
    //    \r\n
    //    { ...actual JSON... }\r\n
    //    --MIME_boundary--\r\n
    //
    //  We parse out each part's Content-Type + body and JSON.parse the body.
    const parts: any[] = [];

    if (typeof raw === "string") {
      // Split on boundary lines.  The first split piece is empty (before the
      // first boundary), so skip it.
      const chunks = raw.split(/--[\w-]+/).slice(1);

      for (const chunk of chunks) {
        // Detect the end marker "--MIME_boundary--"
        if (chunk.trim() === "--" || chunk.trim() === "") continue;

        // Split headers vs body on the first double-CRLF
        const splitIdx = chunk.indexOf("\r\n\r\n");
        if (splitIdx < 0) continue;

        const headerBlock = chunk.slice(0, splitIdx).trim();
        let bodyBlock = chunk.slice(splitIdx + 4);

        // Strip trailing CRLF that belongs to the boundary terminator
        bodyBlock = bodyBlock.replace(/\r\n$/, "");

        // Determine content-type
        const ctypeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerBlock);
        const ctype = ctypeMatch ? ctypeMatch[1].trim().toLowerCase() : "";

        if (
          ctype.includes("application/json") ||
          bodyBlock.trim().startsWith("{")
        ) {
          try {
            parts.push(JSON.parse(bodyBlock));
          } catch (e) {
            // JSON parse failed; skip this part
          }
        } else if (ctype.includes("xml") || bodyBlock.trim().startsWith("<")) {
          parts.push({ __xml: bodyBlock });
        }
      }
    } else if (raw && typeof raw === "object") {
      // express.json() already parsed it (plain JSON POST, e.g. from Postman)
      parts.push(raw);
    }

    if (parts.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: "No parsable body" });
    }

    // ── 3. Delegate each parsed part to the service ──────────────────
    //  The device sends 4 parts per scan (face pulses + the fingerprint
    //  match). handleIsapiEvent correctly ignores the ones without an
    //  employeeNoString.
    let lastResult: any = null;
    for (const part of parts) {
      if (part.__xml) continue; // XML handling omitted for brevity
      const result = await hikvisionService.handleIsapiEvent(part);
      if (result) lastResult = result;
    }

    return res.json(
      lastResult ?? {
        success: true,
        message: "No auth events in payload",
      },
    );
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: (e as Error).message });
  }
});

// GET /api/hikvision/logs
router.get("/logs", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const logs = await getBiometricLogs(limit);
    res.json({ success: true, data: logs, total: logs.length });
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// GET /api/hikvision/sse — live SSE stream
router.get("/sse", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  res.write(
    `data: ${JSON.stringify({ type: "connected", time: new Date().toISOString() })}\n\n`,
  );

  const onScan = (eventData: unknown) => {
    res.write(
      `data: ${JSON.stringify({ type: "biometric_scan", ...(eventData as object) })}\n\n`,
    );
  };

  hikvisionService.on("scan", onScan);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    hikvisionService.removeListener("scan", onScan);
  });
});

export const hikvisionRouter = router;
