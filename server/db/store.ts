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
}

export interface InventoryRecord {
  id: string;
  itemId: string;
  item: string;
  uom: string;
  stock: number;
  minLevel: number;
  status: "Good" | "Low";
}

export interface TransactionRecord {
  id: string;
  date: string;
  time?: string;
  dept: string;
  item: string;
  qty: number;
  cost: number;
  type: "meal" | "snack";
  category?: "stock-keeping" | "ready-made";
  userId?: string;
  userName?: string;
  canteenId?: string;
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
  const rows = await prisma.item.findMany();
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
  };
}

export async function updateItem(
  id: string,
  patch: Partial<Item>,
): Promise<Item | null> {
  try {
    const r = await prisma.item.update({
      where: { id },
      data: {
        code: patch.code,
        name: patch.name,
        uom: patch.uom,
        price: patch.price,
        category: patch.category,
        shelfLife: patch.shelfLife,
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
    };
  } catch {
    return null;
  }
}

export async function deleteItem(id: string): Promise<boolean> {
  try {
    await prisma.item.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Meals ----------
export async function getMeals(): Promise<Meal[]> {
  const rows = await prisma.meal.findMany();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    cost: r.cost,
    eligibleFrom: r.eligibleFrom,
    eligibleTo: r.eligibleTo,
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
  };
}

export async function updateMeal(
  id: string,
  patch: Partial<Meal>,
): Promise<Meal | null> {
  try {
    const r = await prisma.meal.update({
      where: { id },
      data: {
        code: patch.code,
        name: patch.name,
        cost: patch.cost,
        eligibleFrom: patch.eligibleFrom,
        eligibleTo: patch.eligibleTo,
      },
    });
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      cost: r.cost,
      eligibleFrom: r.eligibleFrom,
      eligibleTo: r.eligibleTo,
    };
  } catch {
    return null;
  }
}

export async function deleteMeal(id: string): Promise<boolean> {
  try {
    await prisma.meal.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Quotas ----------
export async function getQuotas(): Promise<Quota[]> {
  const rows = await prisma.quota.findMany();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    items: JSON.parse(r.itemsJson),
  }));
}

export async function createQuota(q: Quota): Promise<Quota> {
  const r = await prisma.quota.create({
    data: { id: q.id, code: q.code, itemsJson: JSON.stringify(q.items) },
  });
  return { id: r.id, code: r.code, items: JSON.parse(r.itemsJson) };
}

export async function updateQuota(
  id: string,
  patch: Partial<Quota>,
): Promise<Quota | null> {
  try {
    const r = await prisma.quota.update({
      where: { id },
      data: {
        code: patch.code,
        itemsJson: patch.items ? JSON.stringify(patch.items) : undefined,
      },
    });
    return { id: r.id, code: r.code, items: JSON.parse(r.itemsJson) };
  } catch {
    return null;
  }
}

export async function deleteQuota(id: string): Promise<boolean> {
  try {
    await prisma.quota.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Department Quota Maps ----------
export async function getDeptQuotaMaps(): Promise<DepartmentQuotaMap[]> {
  const rows = await prisma.departmentQuotaMap.findMany();
  return rows.map((r) => ({
    id: r.id,
    department: r.department,
    effectiveFrom: r.effectiveFrom,
    quotaId: r.quotaId,
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
  };
}

// ---------- Canteens ----------
export async function getCanteens(): Promise<Canteen[]> {
  const rows = await prisma.canteen.findMany();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type as Canteen["type"],
  }));
}

export async function createCanteen(canteen: Canteen): Promise<Canteen> {
  const r = await prisma.canteen.create({ data: canteen });
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type as Canteen["type"],
  };
}

// ---------- Inventory ----------
export async function getInventory(): Promise<InventoryRecord[]> {
  const rows = await prisma.inventory.findMany();
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
      where: { id },
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

// ---------- Daily batches ----------
export async function getDailyBatches(): Promise<DailyReadyMadeBatch[]> {
  const rows = await prisma.dailyBatch.findMany();
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
      where: { id },
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

// ---------- Users ----------
export async function getUsers(): Promise<User[]> {
  const rows = await prisma.user.findMany();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dept: r.dept,
    role: r.role,
    fingerprintEnrolled: r.fingerprintEnrolled ?? undefined,
    biometricCardNo: r.biometricCardNo ?? undefined,
  }));
}

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
  };
}

export async function getUserByBiometricCard(
  cardNo: string,
): Promise<User | null> {
  const r = await prisma.user.findFirst({
    where: { biometricCardNo: cardNo },
  });
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    dept: r.dept,
    role: r.role,
    fingerprintEnrolled: r.fingerprintEnrolled ?? undefined,
    biometricCardNo: r.biometricCardNo ?? undefined,
  };
}

// ---------- Transactions ----------
export async function getTransactions(): Promise<TransactionRecord[]> {
  const rows = await prisma.transaction.findMany();
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time ?? undefined,
    dept: r.dept,
    item: r.item,
    qty: r.qty,
    cost: r.cost,
    type: r.type as "meal" | "snack",
    category: (r.category ?? undefined) as TransactionRecord["category"],
    userId: r.userId ?? undefined,
    userName: r.userName ?? undefined,
    canteenId: r.canteenId ?? undefined,
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
    item: r.item,
    qty: r.qty,
    cost: r.cost,
    type: r.type as "meal" | "snack",
    category: (r.category ?? undefined) as TransactionRecord["category"],
    userId: r.userId ?? undefined,
    userName: r.userName ?? undefined,
    canteenId: r.canteenId ?? undefined,
  };
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

// ---------- Biometric logs ----------
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
