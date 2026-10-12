/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Item, Meal, Quota, Canteen, DepartmentQuotaMap, DailyReadyMadeBatch } from './types';

export const MOCK_ITEMS: Item[] = [
  { id: '1', code: 'ITM001', name: 'Tea', uom: 'Unit', price: 25, category: 'stock-keeping', shelfLife: 'perpetual' },
  { id: '2', code: 'ITM002', name: 'Coffee', uom: 'Unit', price: 35, category: 'stock-keeping', shelfLife: 'perpetual' },
  { id: '3', code: 'ITM003', name: 'Biscuit', uom: 'Pack', price: 15, category: 'stock-keeping', shelfLife: 'perpetual' },
  { id: '4', code: 'ITM004', name: 'Packaged Bun', uom: 'Unit', price: 40, category: 'stock-keeping', shelfLife: 'perpetual' },
  { id: '5', code: 'ITM005', name: 'Fruit Juice', uom: 'Unit', price: 60, category: 'stock-keeping', shelfLife: 'perpetual' },
  { id: '6', code: 'ITM006', name: 'Fish Bun', uom: 'Unit', price: 80, category: 'ready-made', shelfLife: 'daily' },
  { id: '7', code: 'ITM007', name: 'Fish Roll', uom: 'Unit', price: 70, category: 'ready-made', shelfLife: 'daily' },
  { id: '8', code: 'ITM008', name: 'Vegetable Pastry', uom: 'Unit', price: 65, category: 'ready-made', shelfLife: 'daily' },
  { id: '9', code: 'ITM009', name: 'Egg Roti', uom: 'Unit', price: 75, category: 'ready-made', shelfLife: 'daily' },
];

export const MOCK_DAILY_READY_MADE_BATCHES: DailyReadyMadeBatch[] = [
  {
    id: 'batch-01',
    itemId: '6',
    itemName: 'Fish Bun',
    date: 'Today',
    deliveryTime: '07:15 AM',
    receivedQty: 60,
    issuedQty: 25,
    remainingQty: 35,
    unitPrice: 80,
    status: 'available',
  },
  {
    id: 'batch-02',
    itemId: '7',
    itemName: 'Fish Roll',
    date: 'Today',
    deliveryTime: '07:15 AM',
    receivedQty: 50,
    issuedQty: 18,
    remainingQty: 32,
    unitPrice: 70,
    status: 'available',
  },
  {
    id: 'batch-03',
    itemId: '8',
    itemName: 'Vegetable Pastry',
    date: 'Today',
    deliveryTime: '08:00 AM',
    receivedQty: 35,
    issuedQty: 15,
    remainingQty: 20,
    unitPrice: 65,
    status: 'available',
  },
  {
    id: 'batch-04',
    itemId: '9',
    itemName: 'Egg Roti',
    date: 'Today',
    deliveryTime: '07:30 AM',
    receivedQty: 25,
    issuedQty: 25,
    remainingQty: 0,
    unitPrice: 75,
    status: 'sold-out',
  },
];

export const MOCK_MEALS: Meal[] = [
  { id: '1', code: 'ML001', name: 'Breakfast', cost: 150, eligibleFrom: '07:00', eligibleTo: '09:30' },
  { id: '2', code: 'ML002', name: 'Lunch', cost: 250, eligibleFrom: '12:00', eligibleTo: '14:30' },
  { id: '3', code: 'ML003', name: 'Dinner', cost: 200, eligibleFrom: '19:00', eligibleTo: '21:30' },
];

export const MOCK_QUOTAS: Quota[] = [
  { 
    id: '1', 
    code: 'QTA-STD', 
    items: [
      { itemId: '1', eligibleQty: 2 }, // 2 Teas per day
      { itemId: '3', eligibleQty: 1 }, // 1 Biscuit per day
    ] 
  },
];

export const MOCK_CANTEENS: Canteen[] = [
  { id: '1', code: 'CAN001', name: 'Main Canteen', type: 'Main' },
  { id: '2', code: 'CAN002', name: 'Executive Lounge', type: 'Executive' },
  { id: '3', code: 'CAN003', name: 'Production Snack Bar', type: 'Snack Bar' },
];

export const MOCK_DEPT_QUOTAS: DepartmentQuotaMap[] = [
  { id: '1', department: 'IT', effectiveFrom: '2024-01-01', quotaId: '1' },
  { id: '2', department: 'HR', effectiveFrom: '2024-01-01', quotaId: '1' },
  { id: '3', department: 'Production', effectiveFrom: '2024-01-01', quotaId: '1' },
];

export const DEPARTMENTS = ['IT', 'HR', 'Production', 'Finance', 'Logistics', 'Sales'];
export const UOMS = ['Unit', 'Kg', 'Litre', 'Pack', 'Plate'];
export const CANTEEN_TYPES = ['Main', 'Snack Bar', 'Executive'];

export const MOCK_TRANSACTIONS = [
  // Current Month (April)
  { id: '1', date: '2024-04-12', dept: 'Production', item: 'Lunch', qty: 45, cost: 11250, type: 'meal' },
  { id: '2', date: '2024-04-12', dept: 'IT', item: 'Tea', qty: 12, cost: 300, type: 'snack' },
  { id: '3', date: '2024-04-12', dept: 'HR', item: 'Coffee', qty: 5, cost: 175, type: 'snack' },
  { id: '4', date: '2024-04-11', dept: 'Production', item: 'Dinner', qty: 38, cost: 7600, type: 'meal' },
  { id: '5', date: '2024-04-11', dept: 'Logistics', item: 'Lunch', qty: 22, cost: 5500, type: 'meal' },
  { id: '6', date: '2024-04-11', dept: 'Sales', item: 'Bun', qty: 15, cost: 600, type: 'snack' },
  { id: '7', date: '2024-04-10', dept: 'IT', item: 'Lunch', qty: 10, cost: 2500, type: 'meal' },
  { id: '8', date: '2024-04-10', dept: 'Finance', item: 'Tea', qty: 8, cost: 200, type: 'snack' },
  
  // Last Month (March)
  { id: '9', date: '2024-03-28', dept: 'Production', item: 'Lunch', qty: 40, cost: 10000, type: 'meal' },
  { id: '10', date: '2024-03-27', dept: 'Logistics', item: 'Dinner', qty: 20, cost: 4000, type: 'meal' },
  { id: '11', date: '2024-03-25', dept: 'IT', item: 'Coffee', qty: 15, cost: 525, type: 'snack' },
  { id: '12', date: '2024-03-24', dept: 'HR', item: 'Fish Bun', qty: 10, cost: 800, type: 'snack' },
  { id: '13', date: '2024-03-20', dept: 'Finance', item: 'Lunch', qty: 12, cost: 3000, type: 'meal' },
  { id: '14', date: '2024-03-18', dept: 'Sales', item: 'Tea', qty: 14, cost: 350, type: 'snack' },

  // February
  { id: '15', date: '2024-02-22', dept: 'Production', item: 'Lunch', qty: 44, cost: 11000, type: 'meal' },
  { id: '16', date: '2024-02-20', dept: 'Logistics', item: 'Lunch', qty: 25, cost: 6250, type: 'meal' },
  { id: '17', date: '2024-02-18', dept: 'IT', item: 'Tea', qty: 18, cost: 450, type: 'snack' },
  { id: '18', date: '2024-02-15', dept: 'Finance', item: 'Biscuits', qty: 12, cost: 480, type: 'snack' },
];


export const MOCK_INVENTORY = [
  { id: '1', item: 'Tea', uom: 'Unit', stock: 450, minLevel: 100, status: 'Good' },
  { id: '2', item: 'Coffee', uom: 'Unit', stock: 85, minLevel: 50, status: 'Good' },
  { id: '3', item: 'Biscuit', uom: 'Pack', stock: 20, minLevel: 50, status: 'Low' },
  { id: '4', item: 'Bun', uom: 'Unit', stock: 120, minLevel: 40, status: 'Good' },
  { id: '5', item: 'Fruit Juice', uom: 'Unit', stock: 15, minLevel: 30, status: 'Low' },
];

export const MOCK_DEPT_BALANCES: Record<string, Record<string, number>> = {
  'Production': {
    '1': 50, // 50 Teas remaining (Stock-Keeping)
    '2': 30, // 30 Coffees remaining (Stock-Keeping)
    '3': 20, // 20 Biscuits remaining (Stock-Keeping)
    '4': 25, // 25 Packaged Buns remaining (Stock-Keeping)
    '5': 15, // 15 Fruit Juices remaining (Stock-Keeping)
  },
  'IT': {
    '1': 20,
    '2': 15,
    '3': 10,
    '4': 10,
    '5': 8,
  },
  'HR': {
    '1': 25,
    '2': 20,
    '3': 15,
    '4': 15,
    '5': 10,
  },
  'Finance': {
    '1': 20,
    '2': 15,
    '3': 15,
    '4': 12,
    '5': 10,
  },
  'Logistics': {
    '1': 35,
    '2': 20,
    '3': 20,
    '4': 20,
    '5': 15,
  },
  'Sales': {
    '1': 25,
    '2': 15,
    '3': 15,
    '4': 15,
    '5': 10,
  }
};

export const MOCK_USERS = [
  { id: 'EMP001', name: 'John Doe', dept: 'Production' },
  { id: 'EMP002', name: 'Jane Smith', dept: 'IT' },
  { id: 'EMP003', name: 'Robert Brown', dept: 'HR' },
  { id: 'EMP004', name: 'Alice Wilson', dept: 'Finance' },
];

export const MOCK_TERMINAL_TRANSACTIONS: any[] = [];
