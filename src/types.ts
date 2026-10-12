/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UOM = 'Unit' | 'Kg' | 'Litre' | 'Pack' | 'Plate';

export type ItemCategory = 'stock-keeping' | 'ready-made';

export interface Item {
  id: string;
  code: string;
  name: string;
  uom: UOM;
  price: number;
  category?: ItemCategory; // 'stock-keeping' (tea, coffee, biscuits) or 'ready-made' (fish bun, fish roll)
  shelfLife?: 'perpetual' | 'daily'; // 'daily' perishes at end of day, cannot keep for next day
}

export interface DailyReadyMadeBatch {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  deliveryTime?: string;
  receivedQty: number;
  issuedQty: number;
  remainingQty: number;
  unitPrice: number;
  status: 'available' | 'low' | 'sold-out' | 'cleared';
  clearedAt?: string;
  wasteQty?: number;
}

export interface Meal {
  id: string;
  code: string;
  name: string;
  cost: number;
  eligibleFrom: string; // HH:mm
  eligibleTo: string;   // HH:mm
}

export interface QuotaItem {
  itemId: string;
  eligibleQty: number;
}

export interface Quota {
  id: string;
  code: string;
  items: QuotaItem[];
}

export interface DepartmentQuotaMap {
  id: string;
  department: string;
  effectiveFrom: string; // YYYY-MM-DD
  quotaId: string;
}

export interface Canteen {
  id: string;
  code: string;
  name: string;
  type: 'Main' | 'Snack Bar' | 'Executive';
}

export interface InventoryItem {
  itemId: string;
  availableQty: number;
  totalCost: number;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  department: string;
  type: 'Meal' | 'Snack';
  itemId?: string; // For snacks
  mealId?: string; // For meals
  qty: number;
  cost: number;
  timestamp: string;
  canteenId: string;
}

export type View = 
  | 'admin-dashboard' 
  | 'item-management' 
  | 'meal-management' 
  | 'quota-management' 
  | 'canteen-management' 
  | 'reports'
  | 'user-dashboard'
  | 'canteen-interface';
