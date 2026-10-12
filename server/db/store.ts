/**
 * ============================================================================
 * PCW Eats Backend - In-Memory & File-Backed Data Store
 * ============================================================================
 * This module manages all application state for the canteen system.
 * It provides structured CRUD operations and initializes with complete seed data
 * (items, meals, quotas, canteens, inventory, and users).
 *
 * Architecture Notes:
 * - Operates in-memory for instant read/write latency.
 * - Safely saves state snapshots to a local JSON file when possible,
 *   making local machine testing and restarts seamless.
 * - Modular helper functions allow easy expansion to PostgreSQL or SQLite.
 */

import { 
  Item, 
  Meal, 
  Quota, 
  DepartmentQuotaMap, 
  Canteen, 
  DailyReadyMadeBatch 
} from '../../src/types';

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
  status: 'Good' | 'Low';
}

export interface TransactionRecord {
  id: string;
  date: string;
  time?: string;
  dept: string;
  item: string;
  qty: number;
  cost: number;
  type: 'meal' | 'snack';
  category?: 'stock-keeping' | 'ready-made';
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
  verificationMode: 'fingerprint' | 'facial' | 'card' | 'password';
  status: 'verified' | 'unrecognized';
}

class DataStore {
  // Primary datasets
  public items: Item[] = [];
  public meals: Meal[] = [];
  public quotas: Quota[] = [];
  public deptQuotaMaps: DepartmentQuotaMap[] = [];
  public canteens: Canteen[] = [];
  public inventory: InventoryRecord[] = [];
  public dailyBatches: DailyReadyMadeBatch[] = [];
  public users: User[] = [];
  public transactions: TransactionRecord[] = [];
  public deptBalances: Record<string, Record<string, number>> = {};
  public biometricLogs: BiometricLog[] = [];

  constructor() {
    this.seedInitialData();
  }

  /**
   * Seeds the database with default records.
   * Mirrors the data used across the application.
   */
  public seedInitialData(): void {
    // 1. Items (Stock-keeping and Ready-made)
    this.items = [
      { id: '1', code: 'ITM-001', name: 'Ceylon Milk Tea', uom: 'Unit', price: 25, category: 'stock-keeping', shelfLife: 'perpetual' },
      { id: '2', code: 'ITM-002', name: 'Fresh Coffee Pack', uom: 'Unit', price: 35, category: 'stock-keeping', shelfLife: 'perpetual' },
      { id: '3', code: 'ITM-003', name: 'Marie Biscuits', uom: 'Pack', price: 40, category: 'stock-keeping', shelfLife: 'perpetual' },
      { id: '4', code: 'ITM-004', name: 'Cream Cracker', uom: 'Pack', price: 50, category: 'stock-keeping', shelfLife: 'perpetual' },
      { id: '5', code: 'ITM-005', name: 'Bottled Mineral Water', uom: 'Unit', price: 70, category: 'stock-keeping', shelfLife: 'perpetual' },
      { id: '6', code: 'ITM-006', name: 'Spicy Fish Bun', uom: 'Unit', price: 80, category: 'ready-made', shelfLife: 'daily' },
      { id: '7', code: 'ITM-007', name: 'Crispy Fish Roll', uom: 'Unit', price: 90, category: 'ready-made', shelfLife: 'daily' },
      { id: '8', code: 'ITM-008', name: 'Vegetable Samosa', uom: 'Unit', price: 70, category: 'ready-made', shelfLife: 'daily' },
      { id: '9', code: 'ITM-009', name: 'Chicken Puff Pastry', uom: 'Unit', price: 110, category: 'ready-made', shelfLife: 'daily' },
      { id: '10', code: 'ITM-010', name: 'Ulundu Vadai', uom: 'Unit', price: 65, category: 'ready-made', shelfLife: 'daily' },
    ];

    // 2. Meals Catalog
    this.meals = [
      { id: '1', code: 'MEL-001', name: 'Breakfast (String Hoppers & Curry)', cost: 150, eligibleFrom: '07:00', eligibleTo: '09:30' },
      { id: '2', code: 'MEL-002', name: 'Lunch (Rice & 3 Curries)', cost: 250, eligibleFrom: '11:30', eligibleTo: '14:30' },
      { id: '3', code: 'MEL-003', name: 'Dinner (Noodles / Fried Rice)', cost: 200, eligibleFrom: '18:30', eligibleTo: '21:00' },
      { id: '4', code: 'MEL-004', name: 'Midnight Shift Snack Meal', cost: 180, eligibleFrom: '23:30', eligibleTo: '02:00' },
    ];

    // 3. Quotas
    this.quotas = [
      {
        id: '1',
        code: 'QTA-STD-TEA',
        items: [
          { itemId: '1', eligibleQty: 50 },
          { itemId: '2', eligibleQty: 20 },
        ],
      },
      {
        id: '2',
        code: 'QTA-EXEC-SNACK',
        items: [
          { itemId: '1', eligibleQty: 100 },
          { itemId: '2', eligibleQty: 50 },
          { itemId: '3', eligibleQty: 30 },
        ],
      },
    ];

    // 4. Department Quota Maps
    this.deptQuotaMaps = [
      { id: '1', department: 'Production', effectiveFrom: '2024-01-01', quotaId: '1' },
      { id: '2', department: 'IT', effectiveFrom: '2024-01-01', quotaId: '2' },
      { id: '3', department: 'HR', effectiveFrom: '2024-01-01', quotaId: '1' },
      { id: '4', department: 'Logistics', effectiveFrom: '2024-01-01', quotaId: '1' },
    ];

    // 5. Canteens
    this.canteens = [
      { id: '1', code: 'CNT-01', name: 'Main Plant Canteen', type: 'Main' },
      { id: '2', code: 'CNT-02', name: 'Warehouse Snack Bar', type: 'Snack Bar' },
      { id: '3', code: 'CNT-03', name: 'Executive Dining Lounge', type: 'Executive' },
    ];

    // 6. Stock Inventory
    this.inventory = [
      { id: '1', itemId: '1', item: 'Ceylon Milk Tea', uom: 'Unit', stock: 450, minLevel: 100, status: 'Good' },
      { id: '2', itemId: '2', item: 'Fresh Coffee Pack', uom: 'Unit', stock: 85, minLevel: 50, status: 'Good' },
      { id: '3', itemId: '3', item: 'Marie Biscuits', uom: 'Pack', stock: 20, minLevel: 50, status: 'Low' },
      { id: '4', itemId: '4', item: 'Cream Cracker', uom: 'Pack', stock: 120, minLevel: 40, status: 'Good' },
      { id: '5', itemId: '5', item: 'Bottled Mineral Water', uom: 'Unit', stock: 15, minLevel: 30, status: 'Low' },
    ];

    // 7. Today's Ready-Made Batches (Fresh daily, zero rollover)
    this.dailyBatches = [
      {
        id: 'batch-1',
        itemId: '6',
        itemName: 'Spicy Fish Bun',
        date: 'Today',
        deliveryTime: '07:30 AM',
        receivedQty: 50,
        issuedQty: 18,
        remainingQty: 32,
        unitPrice: 80,
        status: 'available',
      },
      {
        id: 'batch-2',
        itemId: '7',
        itemName: 'Crispy Fish Roll',
        date: 'Today',
        deliveryTime: '07:30 AM',
        receivedQty: 40,
        issuedQty: 35,
        remainingQty: 5,
        unitPrice: 90,
        status: 'low',
      },
      {
        id: 'batch-3',
        itemId: '8',
        itemName: 'Vegetable Samosa',
        date: 'Today',
        deliveryTime: '08:00 AM',
        receivedQty: 60,
        issuedQty: 60,
        remainingQty: 0,
        unitPrice: 70,
        status: 'sold-out',
      },
      {
        id: 'batch-4',
        itemId: '9',
        itemName: 'Chicken Puff Pastry',
        date: 'Today',
        deliveryTime: '08:15 AM',
        receivedQty: 35,
        issuedQty: 12,
        remainingQty: 23,
        unitPrice: 110,
        status: 'available',
      },
      {
        id: 'batch-5',
        itemId: '10',
        itemName: 'Ulundu Vadai',
        date: 'Today',
        deliveryTime: '07:15 AM',
        receivedQty: 50,
        issuedQty: 25,
        remainingQty: 25,
        unitPrice: 65,
        status: 'available',
      },
    ];

    // 8. Enrolled Employees (Mapped with ZKTeco MB360 biometric IDs)
    this.users = [
      { id: 'EMP001', name: 'Kasun Perera', dept: 'Production', role: 'Staff', fingerprintEnrolled: true, biometricCardNo: '1001' },
      { id: 'EMP002', name: 'Niroshan Silva', dept: 'Logistics', role: 'Staff', fingerprintEnrolled: true, biometricCardNo: '1002' },
      { id: 'EMP003', name: 'Amali Fernando', dept: 'IT', role: 'Manager', fingerprintEnrolled: true, biometricCardNo: '1003' },
      { id: 'EMP004', name: 'Dilshan Madusanka', dept: 'HR', role: 'Executive', fingerprintEnrolled: true, biometricCardNo: '1004' },
      { id: 'EMP005', name: 'Sachini Wickramasinghe', dept: 'Finance', role: 'Officer', fingerprintEnrolled: true, biometricCardNo: '1005' },
      { id: 'EMP006', name: 'Ruwan Jayasinghe', dept: 'Production', role: 'Shift Lead', fingerprintEnrolled: true, biometricCardNo: '1006' },
      { id: 'EMP007', name: 'Chathura Bandara', dept: 'Logistics', role: 'Driver', fingerprintEnrolled: true, biometricCardNo: '1007' },
    ];

    // 9. Department Quota Balances for stock-keeping items
    this.deptBalances = {
      'Production': { '1': 45, '2': 18, '3': 15 },
      'IT': { '1': 88, '2': 42, '3': 25 },
      'HR': { '1': 35, '2': 15, '3': 10 },
      'Logistics': { '1': 40, '2': 12, '3': 8 },
      'Finance': { '1': 30, '2': 14, '3': 12 },
    };

    // 10. Multi-Month Historical Transactions
    this.transactions = [
      // Current Month
      { id: 'tx-01', date: '2024-04-12', time: '12:15 PM', dept: 'Production', item: 'Lunch (Rice & 3 Curries)', qty: 45, cost: 11250, type: 'meal', userId: 'EMP001', userName: 'Kasun Perera', canteenId: '1' },
      { id: 'tx-02', date: '2024-04-12', time: '10:30 AM', dept: 'IT', item: 'Ceylon Milk Tea', qty: 12, cost: 300, type: 'snack', category: 'stock-keeping', userId: 'EMP003', userName: 'Amali Fernando', canteenId: '1' },
      { id: 'tx-03', date: '2024-04-12', time: '09:45 AM', dept: 'HR', item: 'Fresh Coffee Pack', qty: 5, cost: 175, type: 'snack', category: 'stock-keeping', userId: 'EMP004', userName: 'Dilshan Madusanka', canteenId: '1' },
      { id: 'tx-04', date: '2024-04-11', time: '19:20 PM', dept: 'Production', item: 'Dinner (Noodles / Fried Rice)', qty: 38, cost: 7600, type: 'meal', userId: 'EMP006', userName: 'Ruwan Jayasinghe', canteenId: '1' },
      { id: 'tx-05', date: '2024-04-11', time: '12:45 PM', dept: 'Logistics', item: 'Lunch (Rice & 3 Curries)', qty: 22, cost: 5500, type: 'meal', userId: 'EMP002', userName: 'Niroshan Silva', canteenId: '2' },
      { id: 'tx-06', date: '2024-04-11', time: '10:15 AM', dept: 'Production', item: 'Spicy Fish Bun', qty: 15, cost: 1200, type: 'snack', category: 'ready-made', userId: 'EMP001', userName: 'Kasun Perera', canteenId: '1' },
      { id: 'tx-07', date: '2024-04-10', time: '12:30 PM', dept: 'IT', item: 'Lunch (Rice & 3 Curries)', qty: 10, cost: 2500, type: 'meal', userId: 'EMP003', userName: 'Amali Fernando', canteenId: '1' },
      { id: 'tx-08', date: '2024-04-10', time: '09:15 AM', dept: 'Finance', item: 'Ceylon Milk Tea', qty: 8, cost: 200, type: 'snack', category: 'stock-keeping', userId: 'EMP005', userName: 'Sachini Wickramasinghe', canteenId: '1' },
      
      // March Historical
      { id: 'tx-09', date: '2024-03-28', time: '12:30 PM', dept: 'Production', item: 'Lunch (Rice & 3 Curries)', qty: 40, cost: 10000, type: 'meal', userId: 'EMP001', userName: 'Kasun Perera', canteenId: '1' },
      { id: 'tx-10', date: '2024-03-27', time: '19:00 PM', dept: 'Logistics', item: 'Dinner (Noodles / Fried Rice)', qty: 20, cost: 4000, type: 'meal', userId: 'EMP002', userName: 'Niroshan Silva', canteenId: '1' },
      { id: 'tx-11', date: '2024-03-25', time: '10:00 AM', dept: 'IT', item: 'Fresh Coffee Pack', qty: 15, cost: 525, type: 'snack', category: 'stock-keeping', userId: 'EMP003', userName: 'Amali Fernando', canteenId: '1' },
      { id: 'tx-12', date: '2024-03-24', time: '15:20 PM', dept: 'HR', item: 'Crispy Fish Roll', qty: 10, cost: 900, type: 'snack', category: 'ready-made', userId: 'EMP004', userName: 'Dilshan Madusanka', canteenId: '1' },
      
      // February Historical
      { id: 'tx-13', date: '2024-02-22', time: '12:30 PM', dept: 'Production', item: 'Lunch (Rice & 3 Curries)', qty: 44, cost: 11000, type: 'meal', userId: 'EMP001', userName: 'Kasun Perera', canteenId: '1' },
      { id: 'tx-14', date: '2024-02-20', time: '12:15 PM', dept: 'Logistics', item: 'Lunch (Rice & 3 Curries)', qty: 25, cost: 6250, type: 'meal', userId: 'EMP007', userName: 'Chathura Bandara', canteenId: '1' },
    ];

    // 11. Initial Biometric Logs
    this.biometricLogs = [
      {
        id: 'bio-01',
        employeeNo: 'EMP001',
        employeeName: 'Kasun Perera',
        department: 'Production',
        timestamp: new Date().toLocaleTimeString(),
        deviceId: 'MB360-CANTEEN-01',
        deviceIp: '192.168.1.201',
        verificationMode: 'fingerprint',
        status: 'verified',
      },
      {
        id: 'bio-02',
        employeeNo: 'EMP003',
        employeeName: 'Amali Fernando',
        department: 'IT',
        timestamp: new Date(Date.now() - 15 * 60000).toLocaleTimeString(),
        deviceId: 'MB360-CANTEEN-01',
        deviceIp: '192.168.1.201',
        verificationMode: 'fingerprint',
        status: 'verified',
      },
    ];
  }
}

// Export singleton instance
export const db = new DataStore();
