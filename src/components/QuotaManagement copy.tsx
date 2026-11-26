/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Check, ClipboardList, Building2, Save, X } from 'lucide-react';
import { Quota, DepartmentQuotaMap, Item, QuotaItem } from '../types';
import { MOCK_QUOTAS, MOCK_DEPT_QUOTAS, MOCK_ITEMS, DEPARTMENTS } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const QuotaManagement: React.FC = () => {
  const [quotas, setQuotas] = useState<Quota[]>(MOCK_QUOTAS);
  const [deptMaps, setDeptMaps] = useState<DepartmentQuotaMap[]>(MOCK_DEPT_QUOTAS);
  
  // Header Selection State
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedQuotaId, setSelectedQuotaId] = useState('');
  const [isNewQuota, setIsNewQuota] = useState(false);
  const [newQuotaCode, setNewQuotaCode] = useState('');

  // New Quota Items State
  const [newQuotaItems, setNewQuotaItems] = useState<QuotaItem[]>([]);

  // Derived Data
  const selectedQuota = useMemo(() => 
    quotas.find(q => q.id === selectedQuotaId), 
    [quotas, selectedQuotaId]
  );

  // Ready-made items must NOT map to quotas; only stock-keeping items are quota-eligible
  const stockKeepingItems = useMemo(() => {
    return MOCK_ITEMS.filter(it => it.category !== 'ready-made');
  }, []);

  const currentItems = useMemo(() => {
    if (isNewQuota) return newQuotaItems;
    return selectedQuota?.items || [];
  }, [isNewQuota, newQuotaItems, selectedQuota]);

  const totalCost = useMemo(() => {
    return currentItems.reduce((sum, qi) => {
      const item = MOCK_ITEMS.find(it => it.id === qi.itemId);
      return sum + (item?.price || 0) * qi.eligibleQty;
    }, 0);
  }, [currentItems]);

  // Handlers
  const handleAddItem = () => {
    setNewQuotaItems([...newQuotaItems, { itemId: stockKeepingItems[0]?.id || '1', eligibleQty: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...newQuotaItems];
    updated.splice(index, 1);
    setNewQuotaItems(updated);
  };

  const handleUpdateItem = (index: number, field: keyof QuotaItem, value: any) => {
    const updated = [...newQuotaItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewQuotaItems(updated);
  };

  const handleSave = () => {
    if (isNewQuota) {
      if (!newQuotaCode || !newQuotaItems.length || !selectedDept) {
        alert('Please fill in all required fields (Quota Code, Items, and Department)');
        return;
      }
      
      const newQuotaObj: Quota = {
        id: Date.now().toString(),
        code: newQuotaCode,
        items: newQuotaItems
      };

      const newMap: DepartmentQuotaMap = {
        id: (Date.now() + 1).toString(),
        department: selectedDept,
        effectiveFrom: new Date().toISOString().split('T')[0],
        quotaId: newQuotaObj.id
      };

      setQuotas([...quotas, newQuotaObj]);
      setDeptMaps([...deptMaps, newMap]);
      
      // Reset
      setIsNewQuota(false);
      setNewQuotaCode('');
      setNewQuotaItems([]);
      setSelectedQuotaId(newQuotaObj.id);
    } else {
      if (!selectedDept || !selectedQuotaId) {
        alert('Please select a Department and Quota');
        return;
      }

      const newMap: DepartmentQuotaMap = {
        id: Date.now().toString(),
        department: selectedDept,
        effectiveFrom: new Date().toISOString().split('T')[0],
        quotaId: selectedQuotaId
      };

      setDeptMaps([...deptMaps, newMap]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Quota Management</h2>
          <p className="text-sm text-slate-500 mt-1">Define and assign daily snack quotas to departments.</p>
        </div>
      </div>

      {/* Quota Business Rule Notice */}
      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 shadow-sm">
        <div className="p-2 bg-blue-100 rounded-xl text-blue-800 shrink-0">
          <ClipboardList size={18} />
        </div>
        <div className="space-y-0.5">
          <p className="font-black text-blue-900">Department Quota Policy</p>
          <p className="text-blue-800">
            Quotas apply strictly to <strong>Stock-Keeping inventory</strong> (Tea, Coffee, Biscuits, Packaged Buns, Juice). 
            <span className="font-semibold text-blue-950"> Ready-made daily snacks (Fish Buns, Fish Rolls, Pastries, Roti) are fresh daily deliveries and are NOT mapped to quotas.</span>
          </p>
        </div>
      </div>

      {/* Header Selection Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
            <select 
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
            >
              <option value="">Select Department...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quota Code</label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={isNewQuota}
                  onChange={(e) => {
                    setIsNewQuota(e.target.checked);
                    if (e.target.checked) setSelectedQuotaId('');
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">New Quota</span>
              </label>
            </div>
            {isNewQuota ? (
              <input 
                type="text"
                placeholder="Enter New Quota Code"
                value={newQuotaCode}
                onChange={(e) => setNewQuotaCode(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
              />
            ) : (
              <select 
                value={selectedQuotaId}
                onChange={(e) => setSelectedQuotaId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
              >
                <option value="">Select Existing Quota...</option>
                {quotas.map(q => <option key={q.id} value={q.id}>{q.code}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => {
                setSelectedDept('');
                setSelectedQuotaId('');
                setIsNewQuota(false);
                setNewQuotaCode('');
                setNewQuotaItems([]);
              }}
              className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Clear
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
            >
              <Save size={18} />
              <span>{isNewQuota ? 'Save & Map' : 'Map Quota'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ClipboardList size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Quota Items & Details</h3>
          </div>
          {isNewQuota && (
            <button 
              onClick={handleAddItem}
              className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-slate-900 rounded-xl text-sm font-bold hover:bg-amber-500 transition-all"
            >
              <Plus size={16} />
              <span>Add Item</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Item Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">UOM</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Qty</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Unit Cost</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Total</th>
                {isNewQuota && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.map((qi, idx) => {
                const item = MOCK_ITEMS.find(it => it.id === qi.itemId);
                return (
                  <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4">
                      {isNewQuota ? (
                        <select 
                          value={qi.itemId}
                          onChange={(e) => handleUpdateItem(idx, 'itemId', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          {stockKeepingItems.map(it => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.code})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-700">{item?.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Stock-Keeping
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {item?.uom}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isNewQuota ? (
                        <input 
                          type="number" 
                          min="1"
                          value={qi.eligibleQty}
                          onChange={(e) => handleUpdateItem(idx, 'eligibleQty', parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      ) : (
                        <span className="text-sm font-bold text-slate-700">{qi.eligibleQty}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">
                      LKR {item?.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      LKR {((item?.price || 0) * qi.eligibleQty).toLocaleString()}
                    </td>
                    {isNewQuota && (
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan={isNewQuota ? 6 : 5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    {isNewQuota ? 'No items added yet. Click "Add Item" to start.' : 'Select a quota to view items.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Items</span>
              <span className="text-lg font-black text-slate-900">{currentItems.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Daily Cost</span>
              <span className="text-lg font-black text-amber-600">LKR {totalCost.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-400 italic">
            * Costs are calculated based on current item prices.
          </div>
        </div>
      </div>

      {/* Active Mappings List (Small version) */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 px-2">Recent Quota Mappings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {deptMaps.slice(-4).reverse().map((map) => {
            const quota = quotas.find(q => q.id === map.quotaId);
            return (
              <div key={map.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider">
                    {map.department}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {map.effectiveFrom}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{quota?.code || 'Unknown'}</h4>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuotaManagement;
