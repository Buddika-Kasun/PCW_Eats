/**
 * ============================================================================
 * ZKTeco MB360 Biometric Integration Service — Prisma/PostgreSQL
 * ============================================================================
 *
 * Hardware Overview:
 * - Device: ZKTeco MB360 (Multi-Biometric Time Attendance and Access Control Terminal)
 * - Supported Modalities: Fingerprint, Facial Recognition, RFID ID Card, PIN
 * - Standard Protocol: TCP / UDP over Port 4370 (ZKTeco Standalone Protocol)
 * - ADMS Mode: HTTP Push to Cloud/Local Webhook (pushing punch logs automatically)
 *
 * How this service works in local machine deployment:
 * 1. Physical Device Connection:
 *    - The ZKTeco MB360 is assigned a static IP (e.g., 192.168.1.201) on the local LAN.
 *    - In production, a socket client (using `node-zklib` or raw TCP socket on port 4370)
 *      connects to the device, initializes real-time log event listening:
 *        `zk.getRealTimeLogs((log) => zktecoService.handleDevicePunch(log))`
 *    - Alternatively, in ADMS push mode, the device sends HTTP POST requests to:
 *        `POST /api/zkteco/adms/cdata?SN=MB360...`
 *
 * 2. Real-Time Frontend Delivery:
 *    - When an employee places their finger on the MB360 scanner, this service parses
 *      the User ID (e.g., '1001' or 'EMP001'), resolves the employee profile,
 *      and immediately dispatches the event via Server-Sent Events (SSE) or polling
 *      to the browser screen.
 *    - The Canteen Meal Issuing screen auto-populates the employee and displays
 *      their eligible meal in under 300ms!
 *
 * 3. Testing Without Hardware:
 *    - Includes a built-in simulation engine so developers can test the entire workflow
 *      locally without needing a physical terminal plugged in.
 */

import { EventEmitter } from "events";
import {
  getUserById,
  getUserByBiometricCard,
  createBiometricLog,
  getBiometricLogs,
  type BiometricLog,
  type User,
} from "../db/store";
import { prisma } from "../db/prisma";

export interface DeviceConfig {
  ip: string;
  port: number;
  commKey: number;
  timeout: number;
  deviceName: string;
  enabled: boolean;
  mode: "real-hardware" | "simulation";
}

const MAX_LOGS = 50;

class ZKTecoService extends EventEmitter {
  private config: DeviceConfig = {
    ip: "192.168.1.201",
    port: 4370,
    commKey: 0,
    timeout: 5000,
    deviceName: "ZKTeco MB360 Canteen Scanner #1",
    enabled: true,
    mode: "simulation",
  };

  private isConnected: boolean = true;
  private lastHeartbeat: Date = new Date();

  constructor() {
    super();
    // Allow multiple SSE client connections
    this.setMaxListeners(50);
  }

  /**
   * Returns current hardware / service status, including the current
   * number of recent biometric logs persisted in Postgres.
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
        model: "ZKTeco MB360",
        firmware: "Ver 8.0.4.3-2023",
        algorithms: "ZKFinger VX10.0 / ZKFace VX7.0",
        capacity: {
          fingerprints: 2000,
          faces: 1500,
          cards: 2000,
          logs: 100000,
        },
      },
    };
  }

  /**
   * Updates device configuration (IP, Port, Mode). Synchronous — only
   * touches the in-memory config object, no DB round-trip needed.
   */
  public updateConfig(newConfig: Partial<DeviceConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.lastHeartbeat = new Date();
    return this.config;
  }

  /**
   * Ingests a punch event (called either by physical TCP socket listener,
   * ADMS webhook, or simulation trigger).
   */
  public async handleDevicePunch(params: {
    userIdOrCard: string;
    verifyType?: "fingerprint" | "facial" | "card" | "password";
    deviceId?: string;
  }): Promise<{
    success: boolean;
    log: BiometricLog;
    user: User | null;
    message: string;
  }> {
    const {
      userIdOrCard,
      verifyType = "fingerprint",
      deviceId = this.config.deviceName,
    } = params;

    const normalizedQuery = userIdOrCard.trim().toUpperCase();

    // 1. Match employee by ID (case-insensitive) or biometric card / enroll ID
    let user: User | null = await getUserById(normalizedQuery);
    if (!user) {
      user = await getUserByBiometricCard(normalizedQuery);
    }

    const logEntry: BiometricLog = {
      id: `bio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employeeNo: user ? user.id : normalizedQuery,
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

    // 2. Persist the biometric log, then trim to the most recent MAX_LOGS rows.
    //    (The old in-memory version did `unshift` + `pop` when length > 50.)
    await createBiometricLog(logEntry);
    await this.trimLogs();

    // 3. Emit real-time event to all listening clients (SSE/WebSockets)
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
        ? `Fingerprint verified for ${user.name} (${user.id})`
        : `Card/Fingerprint ID ${normalizedQuery} not recognized in employee master directory`,
    };
  }

  /**
   * Triggers a simulated biometric scan for testing without physical reader.
   */
  public async simulateScan(targetEmployeeId?: string) {
    let empId = targetEmployeeId;

    if (!empId) {
      // Pick a random enrolled employee from Postgres
      const count = await prisma.user.count();
      if (count === 0) {
        throw new Error("No employees enrolled — cannot simulate a scan");
      }
      const skip = Math.floor(Math.random() * count);
      const randomUser = await prisma.user.findFirst({ skip, take: 1 });
      if (!randomUser) {
        throw new Error("No employees enrolled — cannot simulate a scan");
      }
      empId = randomUser.id;
    }

    return this.handleDevicePunch({
      userIdOrCard: empId,
      verifyType: "fingerprint",
      deviceId: `${this.config.deviceName} (Simulated)`,
    });
  }

  /**
   * Keep only the newest MAX_LOGS biometric logs. Mirrors the old
   * `biometricLogs.pop()` cap so the DB doesn't grow unbounded
   * during development.
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
export const zktecoService = new ZKTecoService();
