/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Package, Sparkles, Box } from 'lucide-react';
import { Item, UOM, ItemCategory } from '../types';
import { MOCK_ITEMS, UOMS } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const ItemManagement: React.FC = () => {
  const [items, setItems] = useState<Item[]>(MOCK_ITEMS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'all' | 'stock-keeping' | 'ready-made'>('all');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    uom: 'Unit' as UOM,
    price: 0,
    category: 'stock-keeping' as ItemCategory,
    shelfLife: 'perpetual' as 'perpetual' | 'daily'
  });

  const handleOpenModal = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        code: item.code,
        name: item.name,
        uom: item.uom,
        price: item.price,
        category: item.category || 'stock-keeping',
        shelfLife: item.shelfLife || (item.category === 'ready-made' ? 'daily' : 'perpetual')
      });
    } else {
      setEditingItem(null);
      setFormData({
        code: `ITM${String(items.length + 1).padStart(3, '0')}`,
        name: '',
        uom: 'Unit',
        price: 0,
        category: 'stock-keeping',
        shelfLife: 'perpetual'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedData = {
      ...formData,
      shelfLife: formData.category === 'ready-made' ? ('daily' as const) : ('perpetual' as const)
    };

    if (editingItem) {
      setItems(items.map(it => it.id === editingItem.id ? { ...it, ...updatedData } : it));
    } else {
      setItems([...items, { id: Date.now().toString(), ...updatedData }]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      setItems(items.filter(it => it.id !== id));
    }
  };

  const filteredItems = items.filter(it => {
    const matchesSearch = 
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      it.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = 
      selectedCategoryTab === 'all' || 
      (it.category || 'stock-keeping') === selectedCategoryTab;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Item Management</h2>
          <p className="text-sm text-slate-500 mt-1">Configure stock-keeping warehouse inventory and ready-made daily snacks.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-400 text-slate-900 rounded-xl font-bold hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20"
        >
          <Plus size={20} />
          <span>Add New Item</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setSelectedCategoryTab('all')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
            selectedCategoryTab === 'all' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          All Items ({items.length})
        </button>
        <button
          onClick={() => setSelectedCategoryTab('stock-keeping')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
            selectedCategoryTab === 'stock-keeping' 
              ? "bg-white text-blue-700 shadow-sm" 
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Box size={14} className="text-blue-500" />
          <span>Stock-Keeping Inventory ({items.filter(i => (i.category || 'stock-keeping') === 'stock-keeping').length})</span>
        </button>
        <button
          onClick={() => setSelectedCategoryTab('ready-made')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
            selectedCategoryTab === 'ready-made' 
              ? "bg-white text-amber-800 shadow-sm" 
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Sparkles size={14} className="text-amber-500" />
          <span>Ready-Made / Daily Snacks ({items.filter(i => i.category === 'ready-made').length})</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Item Code</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type / Policy</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">UOM</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item) => {
                const isReadyMade = item.category === 'ready-made';
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{item.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      {isReadyMade ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Sparkles size={12} />
                          Ready-Made (Daily Only)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Box size={12} />
                          Stock-Keeping Inventory
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{item.uom}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">LKR {item.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Package size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No items found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Category & Storage Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label 
                      onClick={() => setFormData({ ...formData, category: 'stock-keeping', shelfLife: 'perpetual' })}
                      className={cn(
                        "p-3 rounded-2xl border-2 cursor-pointer flex flex-col gap-1 transition-all",
                        formData.category === 'stock-keeping'
                          ? "border-blue-500 bg-blue-50/50 text-blue-950"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Box size={16} className="text-blue-500" />
                        <span>Stock-Keeping</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Tea, Coffee, Biscuits. Kept in store with reorder minimum levels.
                      </p>
                    </label>

                    <label 
                      onClick={() => setFormData({ ...formData, category: 'ready-made', shelfLife: 'daily' })}
                      className={cn(
                        "p-3 rounded-2xl border-2 cursor-pointer flex flex-col gap-1 transition-all",
                        formData.category === 'ready-made'
                          ? "border-amber-500 bg-amber-50/50 text-amber-950"
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Sparkles size={16} className="text-amber-500" />
                        <span>Ready-Made (Daily)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Fish Buns, Fish Rolls. Made/delivered for today only. No overnight carryover.
                      </p>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Code</label>
                    <input 
                      required
                      type="text" 
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">UOM</label>
                    <select 
                      value={formData.uom}
                      onChange={(e) => setFormData({ ...formData, uom: e.target.value as UOM })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    >
                      {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    placeholder="e.g. Fish Bun, Fish Roll, Ceylon Tea..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Price (LKR)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-3 bg-amber-400 text-slate-900 rounded-xl font-bold hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20"
                  >
                    Save Item
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ItemManagement;
