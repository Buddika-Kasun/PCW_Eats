/**
 * ============================================================================
 * Hikvision DS-K1T343 Biometric Integration Service — Prisma/PostgreSQL
 * ============================================================================
 *
 * Hardware Overview:
 * - Device: Hikvision DS-K1T343 (Face Recognition + Fingerprint + Card Terminal)
 * - Supported Modalities: Face, Fingerprint, RFID ID Card, PIN
 * - Protocol: ISAPI (Hikvision HTTP REST API) over TCP/80 with Digest auth
 * - Push Mode: HTTP Listening Host — device POSTs events to your server
 *
 * Identity resolution:
 * - Users are the source of truth in PCW Ride, NOT the local `users` table.
 * - Every punch calls fetchPcwUser() — the same resolver the dashboards use —
 *   so a single employee directory is used across the whole app.
 *
 * Real-time delivery:
 * - Every verified punch emits "scan" → SSE pushes to browser.
 * - The Canteen meal-issuing screen auto-populates the employee within
 *   ~300ms of the physical scan.
 */

import { EventEmitter } from "events";
import {
  createBiometricLog,
  getBiometricLogs,
  type BiometricLog,
} from "../db/store";
import { prisma } from "../db/prisma";
import { fetchPcwUser } from "../routes/dashboard";

/**
 * Config for the Hikvision DS-K1T343 over ISAPI.
 * - username/password: HTTP Digest credentials configured on the device.
 * - protocol: "http" | "https" — DS-K1T343 defaults to plain HTTP on port 80.
 */
export interface DeviceConfig {
  ip: string;
  port: number;
  protocol: "http" | "https";
  username: string;
  password: string;
  timeout: number;
  deviceName: string;
  enabled: boolean;
  mode: "real-hardware" | "simulation";
}

/**
 * Shape of the user we expose to callers (routes + SSE). This is the
 * normalised PCW Ride payload — not the local `users` table.
 */
export interface PunchUser {
  id: string;
  name: string;
  dept: string;
  departmentId?: string;
  role?: string;
  email?: string;
  phone?: string;
}

const MAX_LOGS = 50;

class HikvisionService extends EventEmitter {
  private config: DeviceConfig = {
    ip: "192.0.0.64",
    port: 80,
    protocol: "http",
    username: "admin",
    password: "", // set via POST /api/hikvision/config
    timeout: 5000,
    deviceName: "Hikvision DS-K1T343 Canteen Scanner #1",
    enabled: true,
    mode: "simulation",
  };

  private isConnected: boolean = true;
  private lastHeartbeat: Date = new Date();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Returns current hardware / service status. `recentLogsCount` reflects
   * persisted rows so the UI can display how many punches have been seen.
   */
  public async getStatus() {
    let recentLogsCount = 0;
    try {
      recentLogsCount = await prisma.biometricLog.count();
    } catch {
      recentLogsCount = 0;
    }

    return {
      connected: this.isConnected,
      config: this.config,
      lastHeartbeat: this.lastHeartbeat.toISOString(),
      recentLogsCount,
      deviceInfo: {
        model: "Hikvision DS-K1T343",
        firmware: "V3.3.x (ISAPI 2.0)",
        algorithms: "Deep Learning Face Recognition + Capacitive Fingerprint",
        capacity: {
          faces: 6000,
          fingerprints: 5000,
          cards: 6000,
          logs: 50000,
        },
        isapiBase: `${this.config.protocol}://${this.config.ip}:${this.config.port}/ISAPI`,
      },
    };
  }

  /**
   * Updates device configuration (IP, port, credentials, mode).
   * Synchronous — only mutates the in-memory config, no DB round-trip.
   */
  public updateConfig(newConfig: Partial<DeviceConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.lastHeartbeat = new Date();
    return this.config;
  }

  /**
   * Ingests a punch event (called either by the device's HTTP Listening push,
   * by the ISAPI alertStream parser, or by the simulation trigger).
   *
   * Identity is resolved through PCW Ride — the same resolver used by
   * /api/dashboard/user/:userId — so a single directory powers both flows.
   *
   * `userIdOrCard` may be:
   *   - A PCW Ride employee ID (matched case-insensitively)
   *   - A biometric card number (fallback search on PCW Ride)
   *   - The device-side employeeNo (Hikvision's "employeeNoString")
   */
  public async handleDevicePunch(params: {
    userIdOrCard: string;
    verifyType?: "face" | "fingerprint" | "card" | "password";
    deviceId?: string;
  }): Promise<{
    success: boolean;
    log: BiometricLog;
    user: PunchUser | null;
    message: string;
  }> {
    const {
      userIdOrCard,
      verifyType = "fingerprint",
      deviceId = this.config.deviceName,
    } = params;

    const normalizedQuery = userIdOrCard.trim();

    /* ------------------------------------------------------------------ */
    /* 1. Resolve user from PCW Ride (source of truth)                    */
    /* ------------------------------------------------------------------ */
    let pcwUser: Awaited<ReturnType<typeof fetchPcwUser>> = null;
    try {
      pcwUser = await fetchPcwUser(normalizedQuery);
    } catch (err) {
      console.warn(
        `fetchPcwUser failed for "${normalizedQuery}" during punch:`,
        err,
      );
    }

    const user: PunchUser | null = pcwUser
      ? {
          id: pcwUser.id,
          name: pcwUser.name,
          dept: pcwUser.deptName || "Unassigned",
          departmentId: pcwUser.deptId || undefined,
          role: pcwUser.role,
          email: pcwUser.email,
          phone: pcwUser.phone,
        }
      : null;

    /* ------------------------------------------------------------------ */
    /* 2. Build the audit log                                             */
    /* ------------------------------------------------------------------ */
    const logEntry: BiometricLog = {
      id: `bio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employeeNo: user ? user.id : normalizedQuery.toUpperCase(),
      employeeName: user ? user.name : "Unknown Employee",
      department: user ? user.dept : "Unassigned",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      deviceId,
      deviceIp: this.config.ip,
      verificationMode: verifyType,
      status: user ? "verified" : "unrecognized",
    };

    /* ------------------------------------------------------------------ */
    /* 3. Persist, trim, emit                                             */
    /* ------------------------------------------------------------------ */
    try {
      await createBiometricLog(logEntry);
      await this.trimLogs();
    } catch (err) {
      console.warn("Could not persist biometric log:", err);
    }

    this.emit("scan", {
      log: logEntry,
      user,
      timestamp: new Date().toISOString(),
    });

    return {
      success: !!user,
      log: logEntry,
      user,
      message: user
        ? `Hikvision punch verified for ${user.name} (${user.id})`
        : `ID ${normalizedQuery} not recognised in PCW Ride directory`,
    };
  }

  /**
   * Parses one Hikvision ISAPI event payload into a punch event.
   * Tolerant of all common DS-K1T343 firmware payload shapes.
   */
  public async handleIsapiEvent(body: any): Promise<{
    success: boolean;
    log: BiometricLog;
    user: PunchUser | null;
    message: string;
  } | null> {
    // 1. Locate the AccessControllerEvent node regardless of how the device
    //    wraps it. Different DS-K1T343 firmware versions wrap differently.
    const ev =
      body?.AccessControllerEvent ??
      body?.EventNotificationAlert?.AccessControllerEvent ??
      body?.EventNotificationAlert ??
      body?.event ??
      body;

    if (!ev || typeof ev !== "object") return null;

    // 2. Extract employee identifier — the device may put it at any level
    const userIdOrCard = String(
      ev?.employeeNoString ??
        ev?.employeeNo ??
        ev?.cardNo ??
        ev?.cardNumber ??
        body?.employeeNoString ??
        body?.employeeNo ??
        body?.cardNo ??
        "",
    ).trim();

    // 3. If no employee ID anywhere → not a person-event (door open, tamper,
    //    network, etc.) → ignore it
    if (!userIdOrCard) return null;

    // 4. Pick verification mode from subEventType if present (soft — never
    //    rejects the event, only classifies it)
    const sub = Number(ev?.subEventType ?? ev?.minor ?? 0);
    let verifyType: "face" | "fingerprint" | "card" | "password" =
      "fingerprint";
    if (sub === 75 || sub === 21 || sub === 22) verifyType = "face";
    else if (sub === 2 || ev?.cardNo || ev?.cardNumber) verifyType = "card";
    else if (sub === 4) verifyType = "password";

    // 5. Delegate — this does the PCW Ride lookup, log row, and SSE emit
    return this.handleDevicePunch({
      userIdOrCard,
      verifyType,
      deviceId: this.config.deviceName,
    });
  }

  /**
   * Triggers a simulated biometric scan for local testing.
   *
   * Because users now live in PCW Ride (not the local DB), there is no safe
   * way to pick a random employee here. Callers must pass an explicit PCW
   * Ride user ID.
   */
  public async simulateScan(targetEmployeeId?: string) {
    if (!targetEmployeeId) {
      throw new Error(
        "simulateScan requires an explicit employeeId (users are resolved from PCW Ride)",
      );
    }
    return this.handleDevicePunch({
      userIdOrCard: targetEmployeeId,
      verifyType: "fingerprint",
      deviceId: `${this.config.deviceName} (Simulated)`,
    });
  }

  /**
   * Keep only the newest MAX_LOGS biometric logs.
   */
  private async trimLogs(): Promise<void> {
    const total = await prisma.biometricLog.count();
    if (total <= MAX_LOGS) return;

    const keep = await getBiometricLogs(MAX_LOGS);
    const keepIds = keep.map((l) => l.id);
    if (keepIds.length === 0) return;

    await prisma.biometricLog.deleteMany({
      where: { id: { notIn: keepIds } },
    });
  }
}

// Singleton instance
export const hikvisionService = new HikvisionService();
