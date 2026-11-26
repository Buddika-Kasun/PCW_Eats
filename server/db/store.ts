import { prisma } from "./prisma";
import type {
  Item,
  Meal,
  Quota,
  DepartmentQuotaMap,
  Canteen,
  DailyReadyMadeBatch,
} from "../../src/types";

export interface User {
  id: string;
  name: string;
  dept: string;
  role: string;
  fingerprintEnrolled?: boolean;
  biometricCardNo?: string;
  active?: boolean;
}

export interface InventoryRecord {
  id: string;
  itemId: string;
  item: string;
  uom: string;
  stock: number;
  minLevel: number;
  status: "Good" | "Low";
  active?: boolean;
}

export interface TransactionRecord {
  id: string;
  date: string;
  time?: string;
  dept: string;
  departmentId?: string | null;
  item: string;
  qty: number;
  cost: number;
  type: "meal" | "snack";
  category?: "stock-keeping" | "ready-made";
  userId?: string;
  userName?: string;
  canteenId?: string;
  active?: boolean;
}

export interface BiometricLog {
  id: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  timestamp: string;
  deviceId: string;
  deviceIp: string;
  verificationMode: "fingerprint" | "facial" | "card" | "password";
  status: "verified" | "unrecognized";
}

// ---------- Items ----------
export async function getItems(): Promise<Item[]> {
  const rows = await prisma.item.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    uom: r.uom as Item["uom"],
    price: r.price,
    category: (r.category ?? "stock-keeping") as Item["category"],
    shelfLife: (r.shelfLife ?? "perpetual") as Item["shelfLife"],
  }));
}

export async function createItem(item: Item): Promise<Item> {
  const r = await prisma.item.create({
    data: {
      id: item.id,
      code: item.code,
      name: item.name,
      uom: item.uom,
      price: item.price,
      category: item.category ?? "stock-keeping",
      shelfLife: item.shelfLife ?? "perpetual",
      createdBy: item.createdBy ?? null,
      updatedBy: item.updatedBy ?? null,
    },
  });
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    uom: r.uom as Item["uom"],
    price: r.price,
    category: (r.category ?? "stock-keeping") as Item["category"],
    shelfLife: (r.shelfLife ?? "perpetual") as Item["shelfLife"],
    createdBy: item.createdBy ?? null,
    updatedBy: item.updatedBy ?? null,
  };
}

export async function updateItem(
  id: string,
  patch: Partial<Item>,
): Promise<Item | null> {
  try {
    const r = await prisma.item.update({
      where: { id, active: true }, // ← cannot update inactive
      data: {
        code: patch.code,
        name: patch.name,
        uom: patch.uom,
        price: patch.price,
        category: patch.category,
        shelfLife: patch.shelfLife,
        updatedBy: patch.updatedBy ?? undefined,
      },
    });
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      uom: r.uom as Item["uom"],
      price: r.price,
      category: (r.category ?? "stock-keeping") as Item["category"],
      shelfLife: (r.shelfLife ?? "perpetual") as Item["shelfLife"],
      updatedBy: r.updatedBy ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Soft delete — sets active = false. */
export async function deleteItem(id: string): Promise<boolean> {
  try {
    await prisma.item.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Meals ----------
export async function getMeals(): Promise<Meal[]> {
  const rows = await prisma.meal.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    cost: r.cost,
    eligibleFrom: r.eligibleFrom,
    eligibleTo: r.eligibleTo,
    createdBy: r.createdBy ?? undefined,
    updatedBy: r.updatedBy ?? undefined,
  }));
}

export async function createMeal(meal: Meal): Promise<Meal> {
  const r = await prisma.meal.create({ data: meal });
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    cost: r.cost,
    eligibleFrom: r.eligibleFrom,
    eligibleTo: r.eligibleTo,
    createdBy: r.createdBy ?? undefined,
    updatedBy: r.updatedBy ?? undefined,
  };
}

export async function updateMeal(
  id: string,
  patch: Partial<Meal>,
): Promise<Meal | null> {
  try {
    const r = await prisma.meal.update({
      where: { id, active: true },
      data: {
        code: patch.code,
        name: patch.name,
        cost: patch.cost,
        eligibleFrom: patch.eligibleFrom,
        eligibleTo: patch.eligibleTo,
        updatedBy: patch.updatedBy ?? undefined,
      },
    });
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      cost: r.cost,
      eligibleFrom: r.eligibleFrom,
      eligibleTo: r.eligibleTo,
      createdBy: r.createdBy ?? undefined,
      updatedBy: r.updatedBy ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Soft delete — sets active = false. */
export async function deleteMeal(id: string): Promise<boolean> {
  try {
    await prisma.meal.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Quotas ----------
export async function getQuotas(): Promise<Quota[]> {
  const rows = await prisma.quota.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    items: JSON.parse(r.itemsJson),
    createdBy: r.createdBy ?? null,
    updatedBy: r.updatedBy ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createQuota(q: Quota): Promise<Quota> {
  const r = await prisma.quota.create({
    data: {
      id: q.id,
      code: q.code,
      itemsJson: JSON.stringify(q.items),
      createdBy: q.createdBy ?? null,
      updatedBy: q.updatedBy ?? null,
    },
  });
  return {
    id: r.id,
    code: r.code,
    items: JSON.parse(r.itemsJson),
    createdBy: r.createdBy ?? null,
    updatedBy: r.updatedBy ?? null,
  };
}

export async function updateQuota(
  id: string,
  patch: Partial<Quota>,
): Promise<Quota | null> {
  try {
    const r = await prisma.quota.update({
      where: { id, active: true },
      data: {
        code: patch.code,
        itemsJson: patch.items ? JSON.stringify(patch.items) : undefined,
        updatedBy: patch.updatedBy ?? undefined,
      },
    });
    return {
      id: r.id,
      code: r.code,
      items: JSON.parse(r.itemsJson),
      createdBy: r.createdBy ?? null,
      updatedBy: r.updatedBy ?? null,
    };
  } catch {
    return null;
  }
}

/** Soft delete — sets active = false. */
export async function deleteQuota(id: string): Promise<boolean> {
  try {
    await prisma.quota.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Department Quota Maps ----------
export async function getDeptQuotaMaps(): Promise<DepartmentQuotaMap[]> {
  const rows = await prisma.departmentQuotaMap.findMany({
    where: { active: true },
  });
  return rows.map((r) => ({
    id: r.id,
    department: r.department,
    effectiveFrom: r.effectiveFrom,
    quotaId: r.quotaId,
    createdBy: r.createdBy ?? null,
    updatedBy: r.updatedBy ?? null,
  }));
}

export async function createDeptQuotaMap(
  m: DepartmentQuotaMap,
): Promise<DepartmentQuotaMap> {
  const r = await prisma.departmentQuotaMap.create({ data: m });
  return {
    id: r.id,
    department: r.department,
    effectiveFrom: r.effectiveFrom,
    quotaId: r.quotaId,
    createdBy: r.createdBy ?? null,
    updatedBy: r.updatedBy ?? null,
  };
}

export async function updateDeptQuotaMap(
  id: string,
  patch: Partial<DepartmentQuotaMap>,
): Promise<DepartmentQuotaMap | null> {
  try {
    const r = await prisma.departmentQuotaMap.update({
      where: { id, active: true },
      data: {
        department: patch.department,
        effectiveFrom: patch.effectiveFrom,
        quotaId: patch.quotaId,
        updatedBy: patch.updatedBy ?? undefined,
      },
    });
    return {
      id: r.id,
      department: r.department,
      effectiveFrom: r.effectiveFrom,
      quotaId: r.quotaId,
      createdBy: r.createdBy ?? null,
      updatedBy: r.updatedBy ?? null,
    };
  } catch {
    return null;
  }
}

/** Soft delete — sets active = false. */
export async function deleteDeptQuotaMap(id: string): Promise<boolean> {
  try {
    await prisma.departmentQuotaMap.update({
      where: { id },
      data: { active: false },
    });
    return true;
  } catch {
    return false;
  }
}

// ---------- Canteens ----------
export async function getCanteens(): Promise<Canteen[]> {
  const rows = await prisma.canteen.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type as Canteen["type"],
    createdBy: r.createdBy ?? undefined,
    updatedBy: r.updatedBy ?? undefined,
  }));
}

export async function createCanteen(canteen: Canteen): Promise<Canteen> {
  const r = await prisma.canteen.create({
    data: {
      id: canteen.id,
      code: canteen.code,
      name: canteen.name,
      type: canteen.type,
      createdBy: canteen.createdBy ?? null,
      updatedBy: canteen.updatedBy ?? null,
    },
  });
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type as Canteen["type"],
    createdBy: r.createdBy ?? null,
    updatedBy: r.updatedBy ?? null,
  };
}

export async function updateCanteen(
  id: string,
  patch: Partial<Canteen>,
): Promise<Canteen | null> {
  try {
    const r = await prisma.canteen.update({
      where: { id, active: true },
      data: {
        code: patch.code,
        name: patch.name,
        type: patch.type,
        updatedBy: patch.updatedBy ?? undefined,
      },
    });
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type as Canteen["type"],
      createdBy: r.createdBy ?? undefined,
      updatedBy: r.updatedBy ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Soft delete — sets active = false. */
export async function deleteCanteen(id: string): Promise<boolean> {
  try {
    await prisma.canteen.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Inventory ----------
export async function getInventory(): Promise<InventoryRecord[]> {
  const rows = await prisma.inventory.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    item: r.item,
    uom: r.uom,
    stock: r.stock,
    minLevel: r.minLevel,
    status: r.status as "Good" | "Low",
  }));
}

export async function updateInventory(
  id: string,
  patch: Partial<InventoryRecord>,
): Promise<InventoryRecord | null> {
  try {
    const r = await prisma.inventory.update({
      where: { id, active: true },
      data: {
        item: patch.item,
        uom: patch.uom,
        stock: patch.stock,
        minLevel: patch.minLevel,
        status: patch.status,
      },
    });
    return {
      id: r.id,
      itemId: r.itemId,
      item: r.item,
      uom: r.uom,
      stock: r.stock,
      minLevel: r.minLevel,
      status: r.status as "Good" | "Low",
    };
  } catch {
    return null;
  }
}

export async function createInventoryRecord(
  record: InventoryRecord,
): Promise<InventoryRecord> {
  const r = await prisma.inventory.create({
    data: {
      id: record.id,
      itemId: record.itemId,
      item: record.item,
      uom: record.uom,
      stock: record.stock,
      minLevel: record.minLevel,
      status: record.status,
    },
  });
  return {
    id: r.id,
    itemId: r.itemId,
    item: r.item,
    uom: r.uom,
    stock: r.stock,
    minLevel: r.minLevel,
    status: r.status as "Good" | "Low",
  };
}

/** Soft delete — sets active = false. */
export async function deleteInventoryRecord(id: string): Promise<boolean> {
  try {
    await prisma.inventory.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Daily batches ----------
export async function getDailyBatches(): Promise<DailyReadyMadeBatch[]> {
  const rows = await prisma.dailyBatch.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    itemName: r.itemName,
    date: r.date,
    deliveryTime: r.deliveryTime ?? undefined,
    receivedQty: r.receivedQty,
    issuedQty: r.issuedQty,
    remainingQty: r.remainingQty,
    unitPrice: r.unitPrice,
    status: r.status as DailyReadyMadeBatch["status"],
    clearedAt: r.clearedAt ?? undefined,
    wasteQty: r.wasteQty ?? undefined,
  }));
}

export async function updateDailyBatch(
  id: string,
  patch: Partial<DailyReadyMadeBatch>,
): Promise<DailyReadyMadeBatch | null> {
  try {
    const r = await prisma.dailyBatch.update({
      where: { id, active: true },
      data: {
        issuedQty: patch.issuedQty,
        remainingQty: patch.remainingQty,
        status: patch.status,
        clearedAt: patch.clearedAt,
        wasteQty: patch.wasteQty,
      },
    });
    return {
      id: r.id,
      itemId: r.itemId,
      itemName: r.itemName,
      date: r.date,
      deliveryTime: r.deliveryTime ?? undefined,
      receivedQty: r.receivedQty,
      issuedQty: r.issuedQty,
      remainingQty: r.remainingQty,
      unitPrice: r.unitPrice,
      status: r.status as DailyReadyMadeBatch["status"],
      clearedAt: r.clearedAt ?? undefined,
      wasteQty: r.wasteQty ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function createDailyBatch(
  batch: DailyReadyMadeBatch,
): Promise<DailyReadyMadeBatch> {
  const r = await prisma.dailyBatch.create({
    data: {
      id: batch.id,
      itemId: batch.itemId,
      itemName: batch.itemName,
      date: batch.date,
      deliveryTime: batch.deliveryTime ?? null,
      receivedQty: batch.receivedQty,
      issuedQty: batch.issuedQty,
      remainingQty: batch.remainingQty,
      unitPrice: batch.unitPrice,
      status: batch.status,
      clearedAt: batch.clearedAt ?? null,
      wasteQty: batch.wasteQty ?? null,
    },
  });
  return {
    id: r.id,
    itemId: r.itemId,
    itemName: r.itemName,
    date: r.date,
    deliveryTime: r.deliveryTime ?? undefined,
    receivedQty: r.receivedQty,
    issuedQty: r.issuedQty,
    remainingQty: r.remainingQty,
    unitPrice: r.unitPrice,
    status: r.status as DailyReadyMadeBatch["status"],
    clearedAt: r.clearedAt ?? undefined,
    wasteQty: r.wasteQty ?? undefined,
  };
}

/** Soft delete — sets active = false. */
export async function deleteDailyBatch(id: string): Promise<boolean> {
  try {
    await prisma.dailyBatch.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Users ----------
export async function getUsers(): Promise<User[]> {
  const rows = await prisma.user.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dept: r.dept,
    role: r.role,
    fingerprintEnrolled: r.fingerprintEnrolled ?? undefined,
    biometricCardNo: r.biometricCardNo ?? undefined,
    active: r.active,
  }));
}

/**
 * Lookup by ID — returns the row even if inactive, so callers can show
 * "this user is disabled" instead of "not found". Filter at call sites.
 */
export async function getUserById(id: string): Promise<User | null> {
  const r = await prisma.user.findUnique({ where: { id } });
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    dept: r.dept,
    role: r.role,
    fingerprintEnrolled: r.fingerprintEnrolled ?? undefined,
    biometricCardNo: r.biometricCardNo ?? undefined,
    active: r.active,
  };
}

/** Only active users by biometric card. */
export async function getUserByBiometricCard(
  cardNo: string,
): Promise<User | null> {
  const r = await prisma.user.findFirst({
    where: { biometricCardNo: cardNo, active: true },
  });
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    dept: r.dept,
    role: r.role,
    fingerprintEnrolled: r.fingerprintEnrolled ?? undefined,
    biometricCardNo: r.biometricCardNo ?? undefined,
    active: r.active,
  };
}

/** Soft delete — sets active = false. */
export async function deleteUser(id: string): Promise<boolean> {
  try {
    await prisma.user.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Transactions ----------
export async function getTransactions(): Promise<TransactionRecord[]> {
  const rows = await prisma.transaction.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time ?? undefined,
    dept: r.dept,
    departmentId: r.departmentId ?? undefined,
    item: r.item,
    qty: r.qty,
    cost: r.cost,
    type: r.type as "meal" | "snack",
    category: (r.category ?? undefined) as TransactionRecord["category"],
    userId: r.userId ?? undefined,
    userName: r.userName ?? undefined,
    canteenId: r.canteenId ?? undefined,
    active: r.active,
  }));
}

export async function createTransaction(
  tx: TransactionRecord,
): Promise<TransactionRecord> {
  const r = await prisma.transaction.create({
    data: {
      id: tx.id,
      date: tx.date,
      time: tx.time ?? null,
      dept: tx.dept,
      departmentId: tx.departmentId ?? null,
      item: tx.item,
      qty: tx.qty,
      cost: tx.cost,
      type: tx.type,
      category: tx.category ?? null,
      userId: tx.userId ?? null,
      userName: tx.userName ?? null,
      canteenId: tx.canteenId ?? null,
    },
  });
  return {
    id: r.id,
    date: r.date,
    time: r.time ?? undefined,
    dept: r.dept,
    departmentId: r.departmentId ?? undefined,
    item: r.item,
    qty: r.qty,
    cost: r.cost,
    type: r.type as "meal" | "snack",
    category: (r.category ?? undefined) as TransactionRecord["category"],
    userId: r.userId ?? undefined,
    userName: r.userName ?? undefined,
    canteenId: r.canteenId ?? undefined,
    active: r.active,
  };
}

/** Soft delete — sets active = false. */
export async function deactivateTransaction(id: string): Promise<boolean> {
  try {
    await prisma.transaction.update({ where: { id }, data: { active: false } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Department balances ----------
export async function getDeptBalances(): Promise<
  Record<string, Record<string, number>>
> {
  const rows = await prisma.deptBalance.findMany();
  return Object.fromEntries(
    rows.map((r) => [r.department, JSON.parse(r.value)]),
  );
}

export async function setDeptBalance(
  department: string,
  balances: Record<string, number>,
): Promise<void> {
  await prisma.deptBalance.upsert({
    where: { department },
    update: { value: JSON.stringify(balances) },
    create: { department, value: JSON.stringify(balances) },
  });
}

// ---------- Biometric logs (audit — not soft-deleted) ----------
export async function getBiometricLogs(limit = 100): Promise<BiometricLog[]> {
  const rows = await prisma.biometricLog.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    employeeNo: r.employeeNo,
    employeeName: r.employeeName,
    department: r.department,
    timestamp: r.timestamp,
    deviceId: r.deviceId,
    deviceIp: r.deviceIp,
    verificationMode: r.verificationMode as BiometricLog["verificationMode"],
    status: r.status as BiometricLog["status"],
  }));
}

export async function createBiometricLog(
  log: BiometricLog,
): Promise<BiometricLog> {
  const r = await prisma.biometricLog.create({ data: log });
  return {
    id: r.id,
    employeeNo: r.employeeNo,
    employeeName: r.employeeName,
    department: r.department,
    timestamp: r.timestamp,
    deviceId: r.deviceId,
    deviceIp: r.deviceIp,
    verificationMode: r.verificationMode as BiometricLog["verificationMode"],
    status: r.status as BiometricLog["status"],
  };
}
