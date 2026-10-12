/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LiveTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timestamp: number;
  dept: string;
  item: string;
  qty: number;
  cost: number;
  type: 'meal' | 'snack';
  user: string;
  category?: 'ready-made' | 'stock-keeping';
  isLive?: boolean;
}


const STORAGE_KEY = 'pcw_canteen_live_transactions_v1';
const EVENT_NAME = 'pcw_canteen_transaction_event';

// Initial seed transactions
const INITIAL_TRANSACTIONS: LiveTransaction[] = [
  // Current Month (April / Live active month)
  { id: 'tx-1', date: '2024-04-12', time: '12:30:15', timestamp: Date.now() - 3600000 * 2, dept: 'Production', item: 'Lunch', qty: 45, cost: 11250, type: 'meal', user: 'EMP-0142' },
  { id: 'tx-2', date: '2024-04-12', time: '10:15:00', timestamp: Date.now() - 3600000 * 4, dept: 'IT', item: 'Tea', qty: 12, cost: 300, type: 'snack', user: 'EMP-0033' },
  { id: 'tx-3', date: '2024-04-12', time: '10:20:00', timestamp: Date.now() - 3600000 * 4, dept: 'HR', item: 'Coffee', qty: 5, cost: 175, type: 'snack', user: 'EMP-0089' },
  { id: 'tx-4', date: '2024-04-11', time: '19:40:00', timestamp: Date.now() - 86400000, dept: 'Production', item: 'Dinner', qty: 38, cost: 7600, type: 'meal', user: 'EMP-0112' },
  { id: 'tx-5', date: '2024-04-11', time: '12:45:00', timestamp: Date.now() - 86400000, dept: 'Logistics', item: 'Lunch', qty: 22, cost: 5500, type: 'meal', user: 'EMP-0205' },
  { id: 'tx-6', date: '2024-04-11', time: '15:10:00', timestamp: Date.now() - 86400000, dept: 'Sales', item: 'Bun', qty: 15, cost: 600, type: 'snack', user: 'EMP-0301' },
  { id: 'tx-7', date: '2024-04-10', time: '13:00:00', timestamp: Date.now() - 86400000 * 2, dept: 'IT', item: 'Lunch', qty: 10, cost: 2500, type: 'meal', user: 'EMP-0045' },
  { id: 'tx-8', date: '2024-04-10', time: '15:30:00', timestamp: Date.now() - 86400000 * 2, dept: 'Finance', item: 'Tea', qty: 8, cost: 200, type: 'snack', user: 'EMP-0012' },
  
  // Last Month (March)
  { id: 'tx-9', date: '2024-03-28', time: '12:30:00', timestamp: Date.now() - 86400000 * 15, dept: 'Production', item: 'Lunch', qty: 40, cost: 10000, type: 'meal', user: 'EMP-0142' },
  { id: 'tx-10', date: '2024-03-27', time: '19:30:00', timestamp: Date.now() - 86400000 * 16, dept: 'Logistics', item: 'Dinner', qty: 20, cost: 4000, type: 'meal', user: 'EMP-0205' },
  { id: 'tx-11', date: '2024-03-25', time: '10:00:00', timestamp: Date.now() - 86400000 * 18, dept: 'IT', item: 'Coffee', qty: 15, cost: 525, type: 'snack', user: 'EMP-0033' },
  { id: 'tx-12', date: '2024-03-24', time: '15:30:00', timestamp: Date.now() - 86400000 * 19, dept: 'HR', item: 'Fish Bun', qty: 10, cost: 800, type: 'snack', user: 'EMP-0089' },
  { id: 'tx-13', date: '2024-03-20', time: '12:45:00', timestamp: Date.now() - 86400000 * 23, dept: 'Finance', item: 'Lunch', qty: 12, cost: 3000, type: 'meal', user: 'EMP-0012' },
  { id: 'tx-14', date: '2024-03-18', time: '15:00:00', timestamp: Date.now() - 86400000 * 25, dept: 'Sales', item: 'Tea', qty: 14, cost: 350, type: 'snack', user: 'EMP-0301' },

  // February
  { id: 'tx-15', date: '2024-02-22', time: '12:30:00', timestamp: Date.now() - 86400000 * 50, dept: 'Production', item: 'Lunch', qty: 44, cost: 11000, type: 'meal', user: 'EMP-0142' },
  { id: 'tx-16', date: '2024-02-20', time: '12:30:00', timestamp: Date.now() - 86400000 * 52, dept: 'Logistics', item: 'Lunch', qty: 25, cost: 6250, type: 'meal', user: 'EMP-0205' },
  { id: 'tx-17', date: '2024-02-18', time: '10:15:00', timestamp: Date.now() - 86400000 * 54, dept: 'IT', item: 'Tea', qty: 18, cost: 450, type: 'snack', user: 'EMP-0033' },
  { id: 'tx-18', date: '2024-02-15', time: '15:15:00', timestamp: Date.now() - 86400000 * 57, dept: 'Finance', item: 'Biscuits', qty: 12, cost: 480, type: 'snack', user: 'EMP-0012' },
];

class CanteenStore {
  private transactions: LiveTransaction[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();

    // Listen for cross-window / cross-tab storage changes
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.loadFromStorage();
          this.notify();
        }
      });

      window.addEventListener(EVENT_NAME, () => {
        this.loadFromStorage();
        this.notify();
      });
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') {
      this.transactions = INITIAL_TRANSACTIONS;
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.transactions = JSON.parse(stored);
      } else {
        this.transactions = INITIAL_TRANSACTIONS;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
      }
    } catch {
      this.transactions = INITIAL_TRANSACTIONS;
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.transactions));
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
      } catch (err) {
        console.error('Failed to save canteen transactions:', err);
      }
    }
    this.notify();
  }

  public getTransactions(): LiveTransaction[] {
    return [...this.transactions];
  }

  public addTransaction(txData: Omit<LiveTransaction, 'id' | 'timestamp' | 'date' | 'time'> & Partial<Pick<LiveTransaction, 'id' | 'timestamp' | 'date' | 'time'>>): LiveTransaction {
    const now = new Date();
    const newTx: LiveTransaction = {
      id: txData.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: txData.date || now.toISOString().split('T')[0],
      time: txData.time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: txData.timestamp || now.getTime(),
      dept: txData.dept,
      item: txData.item,
      qty: txData.qty,
      cost: txData.cost,
      type: txData.type,
      user: txData.user,
      category: txData.category,
      isLive: txData.isLive !== undefined ? txData.isLive : true,
    };

    this.transactions.unshift(newTx);
    this.saveToStorage();
    return newTx;
  }

  public getLiveTransactions(): LiveTransaction[] {
    return this.transactions.filter(t => t.isLive === true);
  }

  public simulatePunch(deptChoice?: string, itemChoice?: string, costChoice?: number): LiveTransaction {
    const depts = ['Production', 'Logistics', 'IT', 'HR', 'Finance', 'Sales'];
    const dept = deptChoice || depts[Math.floor(Math.random() * depts.length)];
    const mealItems = [
      { name: 'Lunch Plate', cost: 250, type: 'meal' as const },
      { name: 'Dinner Plate', cost: 200, type: 'meal' as const },
      { name: 'Tea & Biscuit', cost: 40, type: 'snack' as const },
      { name: 'Fish Bun', cost: 80, type: 'snack' as const },
    ];
    const picked = mealItems[Math.floor(Math.random() * mealItems.length)];
    const item = itemChoice || picked.name;
    const cost = costChoice !== undefined ? costChoice : picked.cost;
    const randomEmpNum = Math.floor(100 + Math.random() * 900);

    return this.addTransaction({
      dept,
      item,
      qty: 1,
      cost,
      type: picked.type,
      user: `EMP-${dept.toUpperCase().slice(0, 3)}-${randomEmpNum}`,
      isLive: true
    });
  }

  public resetToDefault() {

    this.transactions = INITIAL_TRANSACTIONS;
    this.saveToStorage();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

export const canteenStore = new CanteenStore();
