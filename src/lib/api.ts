/**
 * ============================================================================
 * PCW Eats Frontend API Client (src/lib/api.ts)
 * ============================================================================
 * Strongly typed client for communicating with the Express backend (/api).
 * Modular and reusable across all components.
 */

import { Item, Meal, DailyReadyMadeBatch } from '../types';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Items
  items: {
    getAll: (category?: 'stock-keeping' | 'ready-made') => 
      fetchJson<{ success: boolean; data: Item[] }>(`/items${category ? `?category=${category}` : ''}`),
    create: (item: Partial<Item>) => 
      fetchJson<{ success: boolean; data: Item; message: string }>('/items', {
        method: 'POST',
        body: JSON.stringify(item),
      }),
    update: (id: string, item: Partial<Item>) => 
      fetchJson<{ success: boolean; data: Item; message: string }>(`/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      }),
    delete: (id: string) => 
      fetchJson<{ success: boolean; message: string }>(`/items/${id}`, {
        method: 'DELETE',
      }),
  },

  // Daily Ready-Made Batches (Zero Rollover)
  batches: {
    getAll: () => 
      fetchJson<{ 
        success: boolean; 
        data: DailyReadyMadeBatch[]; 
        metrics: { totalReceived: number; totalIssued: number; totalRemaining: number; isAllCleared: boolean } 
      }>('/batches'),
    create: (data: { itemId: string; receivedQty: number; deliveryTime?: string }) => 
      fetchJson<{ success: boolean; data: DailyReadyMadeBatch; message: string }>('/batches', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    clearance: () => 
      fetchJson<{ success: boolean; clearedAt: string; totalClearedUnits: number; message: string }>('/batches/clearance', {
        method: 'POST',
      }),
    reset: () => 
      fetchJson<{ success: boolean; data: DailyReadyMadeBatch[]; message: string }>('/batches/reset', {
        method: 'POST',
      }),
  },

  // Meals & Eligible Windows
  meals: {
    getAll: () => fetchJson<{ success: boolean; data: Meal[] }>('/meals'),
    getActive: () => fetchJson<{ success: boolean; currentTime: string; data: Meal[] }>('/meals/active'),
    create: (meal: Partial<Meal>) => 
      fetchJson<{ success: boolean; data: Meal; message: string }>('/meals', {
        method: 'POST',
        body: JSON.stringify(meal),
      }),
  },

  // Department Quotas
  quotas: {
    getAll: () => fetchJson<{ success: boolean; data: any[]; mappings: any[]; balances: Record<string, Record<string, number>> }>('/quotas'),
    getByDept: (dept: string) => 
      fetchJson<{ success: boolean; department: string; mapping: any; quota: any; balances: Record<string, number> }>(`/quotas/department/${encodeURIComponent(dept)}`),
  },

  // Perpetual Inventory
  inventory: {
    getAll: () => fetchJson<{ success: boolean; data: any[] }>('/inventory'),
    adjust: (data: { itemId: string; adjustmentQty?: number; minLevel?: number }) => 
      fetchJson<{ success: boolean; data: any; message: string }>('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Transactions & Issuing
  transactions: {
    getAll: (params?: { type?: string; dept?: string; limit?: number }) => {
      const search = new URLSearchParams();
      if (params?.type) search.append('type', params.type);
      if (params?.dept) search.append('dept', params.dept);
      if (params?.limit) search.append('limit', params.limit.toString());
      return fetchJson<{ success: boolean; data: any[]; total: number }>(`/transactions?${search.toString()}`);
    },
    issueMeal: (data: { employeeId: string; mealId: string; canteenId?: string }) => 
      fetchJson<{ success: boolean; data: any; message: string }>('/transactions/issue-meal', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    issueSnack: (data: { department: string; userId?: string; selections: Record<string, number>; canteenId?: string }) => 
      fetchJson<{ success: boolean; data: any[]; message: string }>('/transactions/issue-snack', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // ZKTeco MB360 Biometric Hardware
  zkteco: {
    getStatus: () => fetchJson<{ success: boolean; data: any }>('/zkteco/status'),
    updateConfig: (config: any) => 
      fetchJson<{ success: boolean; data: any; message: string }>('/zkteco/config', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
    simulateScan: (employeeId?: string) => 
      fetchJson<{ success: boolean; data: any }>('/zkteco/simulate-scan', {
        method: 'POST',
        body: JSON.stringify({ employeeId }),
      }),
    getLogs: () => fetchJson<{ success: boolean; data: any[]; total: number }>('/zkteco/logs'),
    
    /**
     * Connects to Server-Sent Events (SSE) stream for instant real-time punch capture.
     * Returns an unsubscribe function.
     */
    subscribeEvents: (onScan: (event: any) => void) => {
      const eventSource = new EventSource('/api/zkteco/events');
      
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'biometric_scan') {
            onScan(payload);
          }
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('SSE connection interrupted, browser will auto-reconnect:', err);
      };

      return () => {
        eventSource.close();
      };
    },
  },

  // Reports & Analytics
  reports: {
    getDashboard: (month: string = 'current') => 
      fetchJson<{ success: boolean; data: any }>(`/reports/dashboard?month=${month}`),
    getUsers: () => fetchJson<{ success: boolean; data: any[]; total: number }>('/reports/users'),
  },
};
