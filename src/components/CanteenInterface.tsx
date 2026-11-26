/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Tablet, 
  Package, 
  Utensils, 
  Coffee, 
  ChevronRight, 
  ChevronDown,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  QrCode,
  History,
  Save,
  LayoutDashboard,
  Sparkles,
  Clock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Box,
  X,
  ShieldAlert,
  Fingerprint
} from 'lucide-react';
import { 
  MOCK_CANTEENS, 
  MOCK_ITEMS, 
  MOCK_MEALS, 
  MOCK_DEPT_BALANCES, 
  MOCK_INVENTORY, 
  DEPARTMENTS, 
  MOCK_USERS,
  MOCK_DAILY_READY_MADE_BATCHES
} from '../constants';
import { Canteen, Item, Meal, DailyReadyMadeBatch } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';

interface CanteenInterfaceProps {
  onBackToDashboard?: () => void;
}

const CanteenInterface: React.FC<CanteenInterfaceProps> = ({ onBackToDashboard }) => {
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'inventory' | 'snacks' | 'meals'>('menu');
  
  // Stock-Keeping Inventory State
  const [inventory, setInventory] = useState(MOCK_INVENTORY);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any | null>(null);
  const [newItem, setNewItem] = useState({ itemId: '', stock: 0, minLevel: 10 });

  // Ready-Made Snacks (Daily Batches - Zero Overnight Carryover)
  const [dailyBatches, setDailyBatches] = useState<DailyReadyMadeBatch[]>(MOCK_DAILY_READY_MADE_BATCHES);
  const [inventoryTab, setInventoryTab] = useState<'stock-keeping' | 'ready-made'>('stock-keeping');
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [newBatchData, setNewBatchData] = useState({
    itemId: '6', // Default Fish Bun
    receivedQty: 50,
    deliveryTime: '07:30 AM'
  });

  // Issue Snacks State
  const [deptPassId, setDeptPassId] = useState('');
  const [issuingUserId, setIssuingUserId] = useState('');
  const [foundDept, setFoundDept] = useState<string | null>(null);
  const [deptBalances, setDeptBalances] = useState(MOCK_DEPT_BALANCES);
  const [snackSelections, setSnackSelections] = useState<Record<string, number>>({});
  const [issueStatus, setIssueStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [issueErrorMessage, setIssueErrorMessage] = useState<string>('');
  const [recentSnacks, setRecentSnacks] = useState<any[]>([
    {
      id: 'tx-1',
      time: '10:15 AM',
      dept: 'Production',
      user: 'EMP001',
      item: 'Vegetable Samosa',
      category: 'ready-made',
      qty: 12
    },
    {
      id: 'tx-2',
      time: '10:02 AM',
      dept: 'IT',
      user: 'EMP003',
      item: 'Ceylon Milk Tea',
      category: 'stock-keeping',
      qty: 8
    },
    {
      id: 'tx-3',
      time: '09:48 AM',
      dept: 'Quality',
      user: 'EMP005',
      item: 'Chicken Puff Pastry',
      category: 'ready-made',
      qty: 6
    },
    {
      id: 'tx-4',
      time: '09:30 AM',
      dept: 'Maintenance',
      user: 'EMP002',
      item: 'Fresh Coffee Pack',
      category: 'stock-keeping',
      qty: 10
    },
    {
      id: 'tx-5',
      time: '09:12 AM',
      dept: 'Stores',
      user: 'EMP004',
      item: 'Ulundu Vadai',
      category: 'ready-made',
      qty: 15
    }
  ]);
  const [snackFilterCategory, setSnackFilterCategory] = useState<'all' | 'ready-made' | 'stock-keeping'>('all');

  // Computed snack counts
  const totalSelectedItems = useMemo(() => {
    return Object.values(snackSelections).reduce((a, b) => (a as number) + (b as number), 0);
  }, [snackSelections]);

  const totalSelectedCost = useMemo(() => {
    return Object.entries(snackSelections).reduce((acc, [id, qty]) => {
      const item = MOCK_ITEMS.find(i => i.id === id);
      return (acc as number) + (item?.price || 0) * (qty as number);
    }, 0);
  }, [snackSelections]);

  const hasStockKeepingSelected = useMemo(() => {
    return Object.entries(snackSelections).some(([id, qty]) => {
      if ((qty as number) <= 0) return false;
      const it = MOCK_ITEMS.find(i => i.id === id);
      return (it?.category || 'stock-keeping') === 'stock-keeping';
    });
  }, [snackSelections]);

  const hasReadyMadeSelected = useMemo(() => {
    return Object.entries(snackSelections).some(([id, qty]) => {
      if ((qty as number) <= 0) return false;
      const it = MOCK_ITEMS.find(i => i.id === id);
      return it?.category === 'ready-made';
    });
  }, [snackSelections]);

  // Issue Meals State
  const [mealUserId, setMealUserId] = useState('');
  const [foundMealUser, setFoundMealUser] = useState<any | null>(null);
  const [recentMeals, setRecentMeals] = useState<any[]>([]);
  const [mealSearchError, setMealSearchError] = useState<string | null>(null);
  const [lastIssuedNotice, setLastIssuedNotice] = useState<{ user: string; meal: string; cost: number } | null>(null);
  const mealInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when entering meals screen
  useEffect(() => {
    if (currentScreen === 'meals') {
      setTimeout(() => {
        mealInputRef.current?.focus();
      }, 50);
    }
  }, [currentScreen]);

  // Ready-made items list from MOCK_ITEMS
  const readyMadeItems = useMemo(() => {
    return MOCK_ITEMS.filter(i => i.category === 'ready-made');
  }, []);

  // Stock-keeping items list from MOCK_ITEMS
  const stockKeepingItems = useMemo(() => {
    return MOCK_ITEMS.filter(i => (i.category || 'stock-keeping') === 'stock-keeping');
  }, []);

  const handleCanteenSelect = (id: string) => {
    const canteen = MOCK_CANTEENS.find(c => c.id === id);
    if (canteen) setSelectedCanteen(canteen);
  };

  const handleDeptScan = (explicitDept?: string) => {
    const deptToFind = explicitDept || deptPassId;
    const dept = deptToFind 
      ? (DEPARTMENTS.find(d => deptToFind.toUpperCase().includes(d.toUpperCase())) || explicitDept || 'Production')
      : 'Production';
    setFoundDept(dept);
    setDeptPassId(dept);
    const emp = MOCK_USERS.find(u => u.dept.toUpperCase() === dept.toUpperCase());
    if (emp) {
      setIssuingUserId(emp.id);
    } else {
      setIssuingUserId(`EMP-${dept.toUpperCase().slice(0, 4)}-01`);
    }
  };

  // Add / Log Today's Fresh Ready-Made Batch
  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const item = MOCK_ITEMS.find(i => i.id === newBatchData.itemId);
    if (!item) return;

    const existingIndex = dailyBatches.findIndex(b => b.itemId === newBatchData.itemId);
    if (existingIndex >= 0) {
      setDailyBatches(prev => prev.map((b, idx) => {
        if (idx === existingIndex) {
          const newReceived = b.receivedQty + Number(newBatchData.receivedQty);
          const newRemaining = b.remainingQty + Number(newBatchData.receivedQty);
          return {
            ...b,
            receivedQty: newReceived,
            remainingQty: newRemaining,
            deliveryTime: newBatchData.deliveryTime,
            status: 'available'
          };
        }
        return b;
      }));
    } else {
      const newBatch: DailyReadyMadeBatch = {
        id: `batch-${Date.now()}`,
        itemId: item.id,
        itemName: item.name,
        date: 'Today',
        deliveryTime: newBatchData.deliveryTime,
        receivedQty: Number(newBatchData.receivedQty),
        issuedQty: 0,
        remainingQty: Number(newBatchData.receivedQty),
        unitPrice: item.price,
        status: 'available'
      };
      setDailyBatches(prev => [...prev, newBatch]);
    }

    setShowAddBatchModal(false);
  };

  // Perform End-of-Day Clearance (Zero Rollover Enforcement)
  const handleEndOfDayClearance = () => {
    const clearanceTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDailyBatches(prev => prev.map(batch => {
      if (batch.status === 'cleared') return batch;
      return {
        ...batch,
        wasteQty: batch.remainingQty,
        remainingQty: 0,
        status: 'cleared',
        clearedAt: clearanceTime
      };
    }));
    setShowClearanceModal(false);
  };

  // Reset Demo Batches
  const handleResetBatches = () => {
    setDailyBatches(MOCK_DAILY_READY_MADE_BATCHES);
  };

  // Issue Snack Transaction
  const handleIssueSnack = () => {
    const selectedItems = Object.entries(snackSelections).filter(([_, qty]) => (qty as number) > 0);
    if (selectedItems.length === 0) {
      setIssueErrorMessage('Please select at least 1 snack item using the (+) buttons.');
      setIssueStatus('error');
      setTimeout(() => setIssueStatus('idle'), 3000);
      return;
    }

    const deptToUse = foundDept || 'Production';
    if (!foundDept) {
      setFoundDept(deptToUse);
      setDeptPassId(deptToUse);
    }
    const userIdToUse = issuingUserId.trim() || `EMP-${deptToUse.toUpperCase().slice(0, 4)}-REP`;

    // Check Stock-Keeping Quotas AND Ready-Made Daily Fresh Batch Availability
    const newBalances = { ...deptBalances };
    if (!newBalances[deptToUse]) {
      newBalances[deptToUse] = {};
    }

    for (const [itemId, qty] of selectedItems) {
      const numQty = qty as number;
      const item = MOCK_ITEMS.find(i => i.id === itemId);
      if (!item) continue;

      const isReadyMade = item.category === 'ready-made';

      // Ready-made items do NOT map to quotas - only stock-keeping items check department quota
      if (!isReadyMade) {
        const currentDeptBalance = newBalances[deptToUse]?.[itemId] ?? 25;
        if (currentDeptBalance < numQty) {
          setIssueErrorMessage(`Insufficient ${deptToUse} department quota for ${item.name} (${currentDeptBalance} remaining).`);
          setIssueStatus('error');
          setTimeout(() => setIssueStatus('idle'), 3000);
          return;
        }
      } else {
        // If it's a ready-made snack, verify today's fresh batch availability
        const batch = dailyBatches.find(b => b.itemId === itemId);
        if (!batch) {
          setIssueErrorMessage(`${item.name} has not been delivered today.`);
          setIssueStatus('error');
          setTimeout(() => setIssueStatus('idle'), 3000);
          return;
        }
        if (batch.status === 'cleared') {
          setIssueErrorMessage(`Today's batch of ${item.name} was cleared at end of day and cannot be issued.`);
          setIssueStatus('error');
          setTimeout(() => setIssueStatus('idle'), 3000);
          return;
        }
        if (batch.remainingQty < numQty) {
          setIssueErrorMessage(`Only ${batch.remainingQty} fresh ${item.name} available in today's batch.`);
          setIssueStatus('error');
          setTimeout(() => setIssueStatus('idle'), 3000);
          return;
        }
      }
    }

    // 1. Update Department Balances (ONLY for stock-keeping items; ready-made do not map to quotas)
    const newRecentEntries: any[] = [];

    selectedItems.forEach(([itemId, qty]) => {
      const item = MOCK_ITEMS.find(i => i.id === itemId);
      if (!item) return;

      const numQty = qty as number;
      const isReadyMade = item.category === 'ready-made';

      if (!isReadyMade) {
        newBalances[deptToUse] = {
          ...newBalances[deptToUse],
          [itemId]: Math.max(0, (newBalances[deptToUse]?.[itemId] ?? 25) - numQty)
        };
      }

      newRecentEntries.push({
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        dept: deptToUse,
        user: userIdToUse,
        item: item.name,
        category: item.category || 'stock-keeping',
        qty: numQty,
        cost: item.price * numQty
      });
    });

    setDeptBalances(newBalances);

    // 2. Deduct from Ready-Made Daily Batches
    setDailyBatches(prev => prev.map(batch => {
      const selectedQty = (snackSelections[batch.itemId] as number) || 0;
      if (selectedQty > 0) {
        const newRemaining = Math.max(0, batch.remainingQty - selectedQty);
        return {
          ...batch,
          issuedQty: batch.issuedQty + selectedQty,
          remainingQty: newRemaining,
          status: newRemaining === 0 ? 'sold-out' : (newRemaining < 10 ? 'low' : 'available')
        };
      }
      return batch;
    }));

    // 3. Deduct from Stock-Keeping inventory if applicable
    setInventory(prev => prev.map(inv => {
      const matchedItem = MOCK_ITEMS.find(i => i.name === inv.item);
      if (matchedItem && (snackSelections[matchedItem.id] as number) > 0) {
        const qtyToDeduct = snackSelections[matchedItem.id] as number;
        const newStock = Math.max(0, inv.stock - qtyToDeduct);
        return {
          ...inv,
          stock: newStock,
          status: newStock <= inv.minLevel ? 'Low' : 'Good'
        };
      }
      return inv;
    }));

    setRecentSnacks(prev => [...newRecentEntries, ...prev].slice(0, 5));
    setIssueStatus('success');

    setTimeout(() => {
      setIssueStatus('idle');
      setSnackSelections({});
    }, 2000);
  };

  const handleAddItem = () => {
    if (!newItem.itemId) return;
    const baseItem = MOCK_ITEMS.find(i => i.id === newItem.itemId);
    if (!baseItem) return;

    const itemToAdd = {
      id: Math.random().toString(36).substr(2, 9),
      item: baseItem.name,
      uom: baseItem.uom,
      stock: newItem.stock,
      minLevel: newItem.minLevel,
      status: newItem.stock > newItem.minLevel ? 'Good' : 'Low'
    };
    setInventory(prev => [...prev, itemToAdd as any]);
    setShowAddItem(false);
    setNewItem({ itemId: '', stock: 0, minLevel: 10 });
  };

  const handleMealUserSearch = (searchQuery?: string) => {
    const targetId = (searchQuery !== undefined ? searchQuery : mealUserId).trim();
    if (!targetId) {
      setMealSearchError('Please scan or enter an Employee ID.');
      setFoundMealUser(null);
      return;
    }
    const user = MOCK_USERS.find(u => u.id.toLowerCase() === targetId.toLowerCase());
    if (user) {
      setMealUserId(user.id);
      setMealSearchError(null);
      setFoundMealUser({
        ...user,
        eligibleMeals: [MOCK_MEALS[1]]
      });
    } else {
      setMealSearchError(`Employee ID "${targetId}" not found in system.`);
      setFoundMealUser(null);
    }
  };

  const handleIssueMeal = async (meal: Meal) => {
    if (!foundMealUser) return;
    
    // Sync with backend API
    try {
      await api.transactions.issueMeal({
        employeeId: foundMealUser.id,
        mealId: meal.id,
        canteenId: selectedCanteen?.id || '1',
      });
    } catch (err) {
      console.warn('Backend sync warning:', err);
    }

    const issuedRecord = {
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user: foundMealUser.name,
      dept: foundMealUser.dept,
      meal: meal.name,
      cost: meal.cost
    };

    setRecentMeals(prev => [issuedRecord, ...prev].slice(0, 5));
    setLastIssuedNotice({
      user: foundMealUser.name,
      meal: meal.name,
      cost: meal.cost
    });

    setFoundMealUser(null);
    setMealUserId('');
    setMealSearchError(null);

    // Auto-focus input for next employee scan
    setTimeout(() => {
      mealInputRef.current?.focus();
    }, 50);

    setTimeout(() => {
      setLastIssuedNotice(null);
    }, 4000);
  };

  // Ready-Made Batches Summary Metrics
  const totalReceivedToday = useMemo(() => dailyBatches.reduce((acc, b) => acc + b.receivedQty, 0), [dailyBatches]);
  const totalIssuedToday = useMemo(() => dailyBatches.reduce((acc, b) => acc + b.issuedQty, 0), [dailyBatches]);
  const totalRemainingToday = useMemo(() => dailyBatches.reduce((acc, b) => acc + b.remainingQty, 0), [dailyBatches]);
  const isAllCleared = useMemo(() => dailyBatches.length > 0 && dailyBatches.every(b => b.status === 'cleared'), [dailyBatches]);

  // If no canteen location selected, show terminal selection screen
  if (!selectedCanteen) {
    return (
      <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl text-center"
        >
          <div className="w-20 h-20 bg-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-400/20">
            <Tablet className="text-slate-900" size={40} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Canteen Terminal</h2>
          <p className="text-slate-500 mb-8">Select your operating counter to open the point-of-issuance interface.</p>
          
          <div className="space-y-4">
            {MOCK_CANTEENS.map(c => (
              <button
                key={c.id}
                onClick={() => handleCanteenSelect(c.id)}
                className="w-full p-6 bg-slate-50 hover:bg-amber-50 border-2 border-transparent hover:border-amber-400 rounded-2xl flex items-center justify-between transition-all group"
              >
                <div className="text-left">
                  <p className="font-bold text-slate-900 text-lg">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.type} Point</p>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-amber-500 transition-colors" size={24} />
              </button>
            ))}
          </div>

          {onBackToDashboard && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={onBackToDashboard}
                className="w-full py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3 transition-colors text-sm"
              >
                <LayoutDashboard size={20} className="text-slate-500" />
                <span>Return to Main Admin Dashboard</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          {currentScreen !== 'menu' && (
            <button 
              onClick={() => setCurrentScreen('menu')}
              className="p-2 md:p-3 bg-slate-100 rounded-xl md:rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors"
              title="Return to terminal menu"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {currentScreen === 'menu' ? selectedCanteen.name : 
               currentScreen === 'inventory' ? 'Inventory & Daily Snacks' :
               currentScreen === 'snacks' ? 'Issue Snacks (Dept Pass)' : 'Issue Meals'}
            </h2>
            <p className="text-[10px] md:text-sm font-bold text-amber-600 uppercase tracking-widest">
              {selectedCanteen.type} Terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {onBackToDashboard && (
            <button 
              onClick={onBackToDashboard}
              className="px-3 md:px-5 py-2 md:py-2.5 bg-amber-400 text-slate-900 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm hover:bg-amber-500 transition-colors flex items-center gap-2 shadow-sm"
              title="Return to Main Dashboard"
            >
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">Main Dashboard</span>
            </button>
          )}
          <button 
            onClick={() => setSelectedCanteen(null)}
            className="px-3 md:px-5 py-2 md:py-2.5 bg-slate-900 text-white rounded-xl md:rounded-2xl font-bold text-xs md:text-sm hover:bg-slate-800 transition-colors"
            title="Switch Location"
          >
            Switch Terminal
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* Main Menu Screen */}
          {currentScreen === 'menu' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Daily Fresh Snacks Quick Banner */}
              <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white p-6 md:p-8 rounded-[2rem] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <Sparkles size={28} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black">Today's Ready-Made Snacks Status</h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">
                        Zero Rollover
                      </span>
                    </div>
                    <p className="text-amber-100 text-sm mt-1">
                      {isAllCleared ? (
                        'All ready-made snack batches cleared at closing for today.'
                      ) : (
                        `Active fresh batches today: ${totalRemainingToday} items remaining (${totalIssuedToday} issued to staff)`
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCurrentScreen('inventory');
                    setInventoryTab('ready-made');
                  }}
                  className="px-5 py-2.5 bg-white text-slate-900 rounded-xl font-black text-xs hover:bg-amber-50 transition-colors whitespace-nowrap shadow-md"
                >
                  Manage Ready-Made Batches →
                </button>
              </div>

              {/* Action Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {[
                  { id: 'inventory', label: 'Inventory & Snacks', icon: Package, color: 'blue', desc: 'Stock & Ready-Made Batches' },
                  { id: 'snacks', label: 'Issue Snacks', icon: Coffee, color: 'amber', desc: 'Dept Pass Issuance' },
                  { id: 'meals', label: 'Issue Meals', icon: Utensils, color: 'emerald', desc: 'Daily Meal Window' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentScreen(item.id as any)}
                    className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border-2 border-transparent hover:border-amber-400 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center transition-all group"
                  >
                    <div className={cn(
                      "w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl flex items-center justify-center mb-4 md:mb-8 transition-transform group-hover:scale-110",
                      item.color === 'blue' ? "bg-blue-50 text-blue-600" :
                      item.color === 'amber' ? "bg-amber-50 text-amber-600" :
                      "bg-emerald-50 text-emerald-600"
                    )}>
                      <item.icon size={32} className="md:hidden" />
                      <item.icon size={48} className="hidden md:block" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-1 md:mb-2">{item.label}</h3>
                    <p className="text-sm text-slate-500 font-medium">{item.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Issue Snacks Screen */}
          {currentScreen === 'snacks' && (
            <motion.div 
              key="snacks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* QR Scan Section */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-black text-slate-900 uppercase tracking-wider">Scan Department Pass</label>
                      <QrCode className="text-amber-500" size={20} />
                    </div>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                        <input 
                          type="text" 
                          value={deptPassId}
                          onChange={(e) => setDeptPassId(e.target.value)}
                          placeholder="Scan QR or enter Dept..."
                          className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-xl font-bold focus:border-amber-400 outline-none transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => handleDeptScan()}
                        className="px-8 bg-amber-400 text-slate-900 rounded-3xl font-black hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20"
                      >
                        Scan
                      </button>
                    </div>
                  </div>

                  {/* Quick Department Pass Dropdown */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="quick-pass-dropdown" className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                        Quick Pass Selection:
                      </label>
                      <span className="text-[11px] font-bold text-slate-400">Department Dropdown</span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <QrCode size={18} className={foundDept ? "text-amber-500" : "text-slate-400"} />
                      </div>
                      <select
                        id="quick-pass-dropdown"
                        value={foundDept || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleDeptScan(val);
                          } else {
                            setFoundDept(null);
                            setDeptPassId('');
                            setIssuingUserId('');
                          }
                        }}
                        className="w-full pl-11 pr-11 py-3.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 focus:border-amber-400 focus:bg-white rounded-2xl text-sm font-black text-slate-900 appearance-none outline-none cursor-pointer transition-all shadow-sm"
                      >
                        <option value="">-- Select Department Pass --</option>
                        {DEPARTMENTS.map(dept => (
                          <option key={dept} value={dept}>
                            {dept} Department Pass
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>

                  {foundDept ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-8 bg-slate-900 text-white rounded-[2rem] space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-amber-400 text-slate-900 rounded-2xl flex items-center justify-center text-2xl font-black">
                            <QrCode size={32} />
                          </div>
                          <div>
                            <h4 className="text-2xl font-black">{foundDept} Dept Pass</h4>
                            <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs flex items-center gap-1">
                              <CheckCircle2 size={12} /> Active Quota Verified
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFoundDept(null);
                            setDeptPassId('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Issuing For Employee</label>
                        <input 
                          type="text"
                          value={issuingUserId}
                          onChange={(e) => setIssuingUserId(e.target.value)}
                          placeholder="Enter Employee ID (e.g. EMP001)..."
                          className="w-full px-6 py-4 bg-slate-800 border-2 border-slate-700 rounded-2xl text-lg font-bold text-white focus:border-amber-400 outline-none transition-all"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {MOCK_USERS.filter(u => u.dept.toUpperCase() === (foundDept || '').toUpperCase()).map(emp => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => setIssuingUserId(emp.id)}
                              className={cn(
                                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                                issuingUserId === emp.id 
                                  ? "bg-amber-400 text-slate-900" 
                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                              )}
                            >
                              {emp.name} ({emp.id})
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="p-6 bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-[2rem] space-y-2 text-center">
                      <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto mb-1">
                        <QrCode size={24} />
                      </div>
                      <h4 className="font-black text-slate-900 text-base">No Department Pass Selected</h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Select a department pass from the dropdown above (or scan a pass) to link issuance to department quota.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDeptScan('Production')}
                        className="mt-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl text-xs font-black transition-all shadow-sm inline-flex items-center gap-2"
                      >
                        <QrCode size={14} />
                        <span>Select Production Pass</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Item Selection Section */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-black text-slate-900 uppercase tracking-wider block">Select Snacks & Quantities</label>
                        <span className="text-xs text-slate-400">Use (+) and (-) to set snack amounts</span>
                      </div>
                      {totalSelectedItems > 0 && (
                        <button 
                          onClick={() => setSnackSelections({})}
                          className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1 bg-rose-50 rounded-lg"
                        >
                          Clear All ({totalSelectedItems})
                        </button>
                      )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                      <button
                        onClick={() => setSnackFilterCategory('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          snackFilterCategory === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        All Snacks
                      </button>
                      <button
                        onClick={() => setSnackFilterCategory('ready-made')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                          snackFilterCategory === 'ready-made' ? "bg-white text-amber-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        <Sparkles size={12} className="text-amber-500" />
                        <span>Ready-Made</span>
                      </button>
                      <button
                        onClick={() => setSnackFilterCategory('stock-keeping')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                          snackFilterCategory === 'stock-keeping' ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        <Box size={12} className="text-blue-500" />
                        <span>Stock-Keeping</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-[380px] overflow-y-auto pr-1">
                      {MOCK_ITEMS
                        .filter(item => {
                          if (snackFilterCategory === 'ready-made') return item.category === 'ready-made';
                          if (snackFilterCategory === 'stock-keeping') return (item.category || 'stock-keeping') === 'stock-keeping';
                          return true;
                        })
                        .map(item => {
                          const isReadyMade = item.category === 'ready-made';
                          const deptRemainingQuota = foundDept ? (deptBalances[foundDept]?.[item.id] ?? 25) : 50;
                          const selectedQty = snackSelections[item.id] || 0;

                          // Check daily batch availability for ready-made snacks
                          const batch = isReadyMade ? dailyBatches.find(b => b.itemId === item.id) : null;
                          const freshRemaining = batch ? batch.remainingQty : 0;
                          const isCleared = batch?.status === 'cleared';
                          const isPreparedToday = !!batch;

                          // Max quantity that can be issued
                          // Ready-made items do NOT map to quotas: max issuance is purely the remaining fresh daily batch!
                          const maxIssuable = isReadyMade 
                            ? (isPreparedToday && !isCleared ? freshRemaining : 0)
                            : (foundDept ? deptRemainingQuota : 50);

                          const isDisabled = isReadyMade && (!isPreparedToday || isCleared || freshRemaining === 0);

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "p-4 rounded-2xl border-2 flex items-center justify-between transition-all",
                                selectedQty > 0 
                                  ? "bg-amber-50/70 border-amber-400" 
                                  : isDisabled
                                  ? "bg-slate-50/60 border-slate-100 opacity-50"
                                  : "bg-slate-50/60 border-slate-100 hover:border-slate-200"
                              )}
                            >
                              <div className="flex-1 pr-3">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-base text-slate-900">{item.name}</p>
                                  {isReadyMade && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                      <Sparkles size={10} />
                                      Fresh Today
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-slate-500 font-mono">LKR {item.price}</span>
                                  
                                  {!isReadyMade && foundDept && (
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                      deptRemainingQuota < 10 ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-800"
                                    )}>
                                      Quota: {deptRemainingQuota} left
                                    </span>
                                  )}

                                  {isReadyMade && (
                                    <>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                                        Ready-Made
                                      </span>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                        isCleared 
                                          ? "bg-rose-100 text-rose-700" 
                                          : !isPreparedToday 
                                          ? "bg-slate-200 text-slate-500" 
                                          : freshRemaining < 10 
                                          ? "bg-orange-100 text-orange-700" 
                                          : "bg-emerald-100 text-emerald-700"
                                      )}>
                                        {isCleared ? 'Cleared - End of Day' : !isPreparedToday ? 'Not Delivered Today' : `${freshRemaining} Fresh Left`}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <button 
                                  disabled={selectedQty === 0}
                                  onClick={() => setSnackSelections(prev => ({
                                    ...prev,
                                    [item.id]: Math.max(0, selectedQty - 1)
                                  }))}
                                  className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-100 disabled:opacity-30 transition-colors"
                                >
                                  <Minus size={16} />
                                </button>
                                <span className="text-lg font-black text-slate-900 w-6 text-center">{selectedQty}</span>
                                <button 
                                  disabled={isDisabled || selectedQty >= maxIssuable}
                                  onClick={() => setSnackSelections(prev => ({
                                    ...prev,
                                    [item.id]: selectedQty + 1
                                  }))}
                                  className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-100 disabled:opacity-30 transition-colors"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Checkout & Issue Action Section - ALWAYS VISIBLE */}
                  <div className="pt-5 border-t-2 border-slate-100 space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Total Items Selected</span>
                        <span className="text-2xl font-black text-slate-900">
                          {totalSelectedItems} {totalSelectedItems === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Billing Mode</span>
                        <span className={cn(
                          "text-xs font-bold px-3 py-1.5 rounded-xl inline-block mt-0.5 border",
                          !hasStockKeepingSelected && hasReadyMadeSelected
                            ? "bg-amber-50 text-amber-900 border-amber-200"
                            : hasStockKeepingSelected && !hasReadyMadeSelected
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : hasStockKeepingSelected && hasReadyMadeSelected
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        )}>
                          {!hasStockKeepingSelected && hasReadyMadeSelected
                            ? "Ready-Made"
                            : hasStockKeepingSelected && !hasReadyMadeSelected
                            ? "Department Quota"
                            : hasStockKeepingSelected && hasReadyMadeSelected
                            ? "Quota + Ready-Made"
                            : "Department Quota"}
                        </span>
                      </div>
                    </div>

                    {issueStatus === 'error' && issueErrorMessage && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                        <AlertCircle size={18} className="shrink-0 text-rose-500" />
                        <span>{issueErrorMessage}</span>
                      </div>
                    )}

                    {issueStatus === 'success' ? (
                      <div className="w-full py-4 md:py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 bg-emerald-500 text-white shadow-xl shadow-emerald-500/25">
                        <CheckCircle2 size={24} />
                        <span>Snacks Issued Successfully!</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button 
                          onClick={handleIssueSnack}
                          disabled={issueStatus !== 'idle'}
                          className={cn(
                            "w-full py-4 md:py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl cursor-pointer",
                            totalSelectedItems > 0 && foundDept
                              ? "bg-amber-400 text-slate-900 hover:bg-amber-500 shadow-amber-400/30 scale-[1.01]"
                              : totalSelectedItems > 0 && !foundDept
                              ? "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20"
                              : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          )}
                        >
                          <Coffee size={22} className={totalSelectedItems > 0 ? (foundDept ? "text-slate-900" : "text-amber-400") : "text-slate-400"} />
                          <span>
                            {totalSelectedItems === 0
                              ? 'Select Snacks Above Using (+)'
                              : !foundDept
                              ? `Issue ${totalSelectedItems} Snacks (Use Production Pass)`
                              : `Confirm & Issue ${totalSelectedItems} ${totalSelectedItems === 1 ? 'Snack' : 'Snacks'}`}
                          </span>
                        </button>

                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-2">
                          <span>Department: <strong className="text-slate-700">{foundDept || 'None Selected'}</strong></span>
                          <span>Bearer: <strong className="text-slate-700">{issuingUserId || (foundDept ? `EMP-${foundDept.slice(0,3).toUpperCase()}-REP` : 'N/A')}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Transactions - Recent 5 Depts */}
              {recentSnacks.length > 0 && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                        <History size={22} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">
                          Recent 5 Departments
                        </h3>
                        <p className="text-xs text-slate-400 font-bold">
                          Latest departmental pass issuances (Stock Quotas & Fresh Daily Batches)
                        </p>
                      </div>
                    </div>
                    <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
                      Recent 5 Depts
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Time</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Department</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Bearer / Rep</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Items Issued</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {recentSnacks.slice(0, 5).map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 text-sm font-bold text-slate-500 whitespace-nowrap">{tx.time}</td>
                            <td className="py-4 text-sm font-black text-slate-900 whitespace-nowrap">
                              <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-xl text-xs font-black inline-block">
                                {tx.dept}
                              </span>
                            </td>
                            <td className="py-4 text-sm text-slate-600 font-mono whitespace-nowrap">{tx.user}</td>
                            <td className="py-4 text-sm font-bold text-slate-800">
                              <div className="flex items-center gap-2">
                                <span>{tx.qty}x {tx.item}</span>
                                {tx.category === 'ready-made' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Fresh Snack
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-sm text-right whitespace-nowrap">
                              {tx.category === 'ready-made' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  <Sparkles size={13} className="text-amber-600" />
                                  Ready-Made
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={13} className="text-emerald-600" />
                                  Quota Deducted
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Inventory & Ready-Made Batches Screen */}
          {currentScreen === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Header & Tabs */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900">Inventory & Daily Snacks</h3>
                  <p className="text-sm text-slate-500 mt-1">Manage perpetual stock-keeping warehouse items and fresh daily bakery batches.</p>
                </div>

                {/* Sub-Screen Tabs */}
                <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl w-fit">
                  <button
                    onClick={() => setInventoryTab('stock-keeping')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all",
                      inventoryTab === 'stock-keeping' 
                        ? "bg-white text-blue-900 shadow-sm" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Box size={16} className="text-blue-600" />
                    <span>Stock-Keeping Items</span>
                  </button>
                  <button
                    onClick={() => setInventoryTab('ready-made')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all",
                      inventoryTab === 'ready-made' 
                        ? "bg-white text-amber-900 shadow-sm" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Sparkles size={16} className="text-amber-600" />
                    <span>Today's Ready-Made Snacks</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Stock-Keeping Inventory */}
              {inventoryTab === 'stock-keeping' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">Perpetual Stock Inventory</h4>
                      <p className="text-xs text-slate-500">Items with long shelf life (Tea, Coffee, Packaged Biscuits, Sugar) kept in stores.</p>
                    </div>
                    <button 
                      onClick={() => setShowAddItem(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-slate-900 rounded-xl font-black hover:bg-amber-500 transition-all shadow-md shadow-amber-400/20 text-xs"
                    >
                      <Plus size={18} />
                      <span>Add Stock Item</span>
                    </button>
                  </div>

                  {showAddItem && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-white p-8 rounded-[2.5rem] border-2 border-amber-400 shadow-xl space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-black text-slate-900">Add Stock-Keeping Item to Inventory</h4>
                        <button onClick={() => setShowAddItem(false)} className="text-slate-400 hover:text-slate-600">
                          <Minus size={24} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Item</label>
                          <select 
                            value={newItem.itemId}
                            onChange={(e) => setNewItem({...newItem, itemId: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-amber-400"
                          >
                            <option value="">Choose a stock-keeping item...</option>
                            {stockKeepingItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Initial Stock</label>
                          <input 
                            type="number"
                            value={newItem.stock}
                            onChange={(e) => setNewItem({...newItem, stock: parseInt(e.target.value) || 0})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-amber-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Min Reorder Level</label>
                          <input 
                            type="number"
                            value={newItem.minLevel}
                            onChange={(e) => setNewItem({...newItem, minLevel: parseInt(e.target.value) || 0})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button 
                          onClick={handleAddItem}
                          className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-all text-sm"
                        >
                          <Save size={18} />
                          <span>Save Stock Record</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Item Name</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">UOM</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Stock Level</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Min Level</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {inventory.map(item => (
                            <tr 
                              key={item.id} 
                              onClick={() => setSelectedInventoryItem(item)}
                              className={cn(
                                "hover:bg-slate-50 cursor-pointer transition-colors group",
                                selectedInventoryItem?.id === item.id ? "bg-amber-50/50" : ""
                              )}
                            >
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    <Box size={20} />
                                  </div>
                                  <span className="font-black text-slate-900">{item.item}</span>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-sm font-bold text-slate-500">{item.uom}</td>
                              <td className="px-8 py-5">
                                <span className="text-xl font-black text-slate-900 font-mono">{item.stock}</span>
                              </td>
                              <td className="px-8 py-5 text-sm font-bold text-slate-500 font-mono">{item.minLevel}</td>
                              <td className="px-8 py-5 text-right">
                                <span className={cn(
                                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                  item.status === 'Low' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                )}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedInventoryItem && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900 text-white p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-amber-400">
                          <Package size={28} />
                        </div>
                        <div>
                          <h4 className="text-xl font-black">{selectedInventoryItem.item}</h4>
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                            Current Stock: {selectedInventoryItem.stock} {selectedInventoryItem.uom}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            setInventory(prev => prev.map(it => it.id === selectedInventoryItem.id ? { ...it, stock: it.stock + 50 } : it));
                            setSelectedInventoryItem((prev: any) => ({ ...prev, stock: prev.stock + 50 }));
                          }}
                          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-xs transition-all"
                        >
                          +50 Quick Restock
                        </button>
                        <button 
                          onClick={() => setSelectedInventoryItem(null)}
                          className="px-5 py-2.5 bg-amber-400 text-slate-900 hover:bg-amber-500 rounded-xl font-bold text-xs transition-all"
                        >
                          Done
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Tab 2: Today's Ready-Made Snacks (Daily Batches) */}
              {inventoryTab === 'ready-made' && (
                <div className="space-y-6">
                  {/* Ready-Made Policy & Explanatory Banner */}
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-amber-400 text-slate-900 rounded-2xl flex items-center justify-center shrink-0 shadow-md">
                        <ShieldAlert size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-lg font-black text-slate-900">
                          Zero-Overnight Carryover Policy
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                          Ready-made snacks (Fish Buns, Fish Rolls, Vegetable Pastries) are prepared fresh for <strong>today only</strong> and <strong>CANNOT</strong> be rolled over to the next day. Log batches when received each morning, and run the <strong>End-of-Day Clearance</strong> before closing.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <button
                        onClick={() => setShowAddBatchModal(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-amber-400 text-slate-900 rounded-xl font-black hover:bg-amber-500 transition-all shadow-md shadow-amber-400/20 text-xs"
                      >
                        <Plus size={18} />
                        <span>Log Today's Fresh Delivery</span>
                      </button>

                      <button
                        onClick={() => setShowClearanceModal(true)}
                        disabled={isAllCleared || totalRemainingToday === 0}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 disabled:opacity-40 transition-all shadow-md text-xs"
                        title="Clear all unsold ready-made snacks with zero rollover"
                      >
                        <AlertTriangle size={18} />
                        <span>End-of-Day Clearance</span>
                      </button>

                      <button
                        onClick={handleResetBatches}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        title="Reset Demo Batches"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Daily Metrics Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Received Today</span>
                        <Calendar size={16} className="text-blue-500" />
                      </div>
                      <p className="text-2xl md:text-3xl font-black text-slate-900 font-mono">{totalReceivedToday}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Total prepared / delivered</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Issued to Staff</span>
                        <Coffee size={16} className="text-amber-500" />
                      </div>
                      <p className="text-2xl md:text-3xl font-black text-slate-900 font-mono">{totalIssuedToday}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Deducted from dept quotas</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Fresh Remaining</span>
                        <Sparkles size={16} className="text-emerald-500" />
                      </div>
                      <p className="text-2xl md:text-3xl font-black text-emerald-600 font-mono">{totalRemainingToday}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Available for issue today</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Clearance Status</span>
                        <Clock size={16} className="text-purple-500" />
                      </div>
                      <div className="mt-1">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-block",
                          isAllCleared 
                            ? "bg-rose-100 text-rose-700" 
                            : "bg-emerald-100 text-emerald-700"
                        )}>
                          {isAllCleared ? 'Cleared at Closing' : 'Active Issuing'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isAllCleared ? 'Zero units carried over' : 'Open for staff issuance'}
                      </p>
                    </div>
                  </div>

                  {/* Ready-Made Daily Batches Grid */}
                  <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Snack Item</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Delivery / Prep</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Received</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Issued</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Remaining Fresh</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Unit Cost</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Batch Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dailyBatches.map(batch => (
                            <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                    <Sparkles size={18} />
                                  </div>
                                  <div>
                                    <span className="font-black text-slate-900 block">{batch.itemName}</span>
                                    <span className="text-[11px] text-slate-400 font-bold uppercase">Ready-Made (Daily)</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-slate-600 font-mono">
                                <div className="flex items-center gap-1.5">
                                  <Clock size={14} className="text-slate-400" />
                                  <span>{batch.deliveryTime}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-slate-800">
                                {batch.receivedQty}
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-amber-600">
                                {batch.issuedQty}
                              </td>
                              <td className="px-6 py-4 font-mono font-black text-slate-900 text-lg">
                                {batch.remainingQty}
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-slate-700">
                                LKR {batch.unitPrice.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1",
                                  batch.status === 'cleared' ? "bg-rose-100 text-rose-700 border border-rose-200" :
                                  batch.status === 'sold-out' ? "bg-slate-200 text-slate-700" :
                                  batch.status === 'low' ? "bg-orange-100 text-orange-700" :
                                  "bg-emerald-100 text-emerald-800"
                                )}>
                                  {batch.status === 'cleared' ? 'Cleared (0 Rollover)' :
                                   batch.status === 'sold-out' ? 'Sold Out' :
                                   batch.status === 'low' ? 'Low Stock' : 'Fresh & Available'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal: Log Today's Fresh Delivery Batch */}
              <AnimatePresence>
                {showAddBatchModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowAddBatchModal(false)}
                      className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
                    >
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center text-slate-900">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-slate-900">Log Today's Fresh Delivery</h3>
                            <p className="text-xs text-slate-500">Record fresh bakery snacks delivered for today only</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowAddBatchModal(false)}
                          className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <form onSubmit={handleAddBatch} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ready-Made Item</label>
                          <select 
                            value={newBatchData.itemId}
                            onChange={(e) => setNewBatchData({ ...newBatchData, itemId: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            {readyMadeItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.code}) — LKR {item.price}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity Delivered</label>
                            <input 
                              type="number"
                              min="1"
                              value={newBatchData.receivedQty}
                              onChange={(e) => setNewBatchData({ ...newBatchData, receivedQty: parseInt(e.target.value) || 0 })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Time</label>
                            <input 
                              type="text"
                              value={newBatchData.deliveryTime}
                              onChange={(e) => setNewBatchData({ ...newBatchData, deliveryTime: e.target.value })}
                              placeholder="e.g. 07:30 AM"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
                              required
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-tight">
                          ℹ️ Items added here are tracked as today's fresh batch. At closing time, running End-of-Day Clearance ensures unsold snacks are not rolled over into tomorrow.
                        </div>

                        <div className="pt-3 flex gap-3">
                          <button 
                            type="button"
                            onClick={() => setShowAddBatchModal(false)}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            className="flex-1 px-4 py-3 bg-amber-400 text-slate-900 rounded-xl font-black hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20 text-sm"
                          >
                            Record Fresh Batch
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Modal: End-of-Day Clearance Confirmation */}
              <AnimatePresence>
                {showClearanceModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowClearanceModal(false)}
                      className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 text-center"
                    >
                      <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                        <AlertTriangle size={32} />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-2xl font-black text-slate-900">Run End-of-Day Clearance?</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          This will zero out all remaining unsold ready-made snacks ({totalRemainingToday} units) and mark today's batches as cleared.
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl text-xs text-left space-y-2 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Unsold Ready-Made Units:</span>
                          <span className="font-bold text-rose-600">{totalRemainingToday} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Overnight Rollover Policy:</span>
                          <span className="font-bold text-slate-900">Zero (Cannot be kept for tomorrow)</span>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          type="button"
                          onClick={() => setShowClearanceModal(false)}
                          className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
                        >
                          Cancel
                        </button>
                        <button 
                          type="button"
                          onClick={handleEndOfDayClearance}
                          className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 transition-all shadow-lg text-sm"
                        >
                          Confirm Clearance
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Issue Meals Screen */}
          {currentScreen === 'meals' && (
            <motion.div 
              key="meals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-8">
                {/* Header */}
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <div className="inline-flex p-3 bg-amber-100 text-amber-900 rounded-2xl mb-1">
                    <Utensils size={28} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Meal Issuing Terminal</h2>
                  <p className="text-sm font-medium text-slate-500">
                    Capture Employee ID directly via fingerprint reader, barcode scan, or manual entry.
                  </p>
                </div>

                {/* Successful Issue Notification Banner */}
                <AnimatePresence>
                  {lastIssuedNotice && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="max-w-xl mx-auto p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black">
                          ✓
                        </div>
                        <div className="text-left">
                          <p className="font-black text-sm">Meal Issued Successfully</p>
                          <p className="text-xs text-emerald-800">
                            {lastIssuedNotice.user} · {lastIssuedNotice.meal} (LKR {lastIssuedNotice.cost})
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">
                        Ready for next person
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Single Capture Field */}
                <div className="max-w-xl mx-auto space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-wider text-left">
                        Employee / User ID
                      </label>
                      <span className="text-[11px] text-slate-400">Press Enter or click Search</span>
                    </div>
                    <div className="relative flex items-center">
                      <div className="absolute left-5 text-slate-400 pointer-events-none">
                        <Fingerprint size={24} />
                      </div>
                      <input 
                        ref={mealInputRef}
                        type="text" 
                        value={mealUserId}
                        onChange={(e) => {
                          setMealUserId(e.target.value);
                          if (mealSearchError) setMealSearchError(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleMealUserSearch()}
                        placeholder="Scan fingerprint or enter Employee ID (e.g. EMP001)..."
                        autoFocus
                        className="w-full pl-14 pr-32 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-bold focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 outline-none transition-all"
                      />
                      <button 
                        type="button"
                        onClick={() => handleMealUserSearch()}
                        className="absolute right-3 px-5 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl font-black text-sm transition-all shadow-md shadow-amber-400/20"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Error banner if not found */}
                  {mealSearchError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 text-left">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{mealSearchError}</span>
                    </div>
                  )}

                  {/* Quick test buttons while fingerprint hardware is not yet configured */}
                  <div className="pt-2 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Quick Test IDs (For Testing)
                      </span>
                      <span className="text-[11px] text-slate-400">Click to simulate ID scan</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MOCK_USERS.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setMealUserId(u.id);
                            handleMealUserSearch(u.id);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all border border-slate-200/60"
                        >
                          <span className="font-bold text-slate-900">{u.id}</span> ({u.name} · {u.dept})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Found User and Eligible Meal Card */}
                {foundMealUser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-xl mx-auto p-6 bg-slate-50 border-2 border-slate-200 rounded-3xl space-y-6 text-left"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-xl font-black">
                          {foundMealUser.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xl font-black text-slate-900">{foundMealUser.name}</h4>
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-mono font-bold">
                              {foundMealUser.id}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{foundMealUser.dept} Department</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFoundMealUser(null);
                          setMealUserId('');
                          mealInputRef.current?.focus();
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Eligible Meal for Current Window</p>
                      {foundMealUser.eligibleMeals.map((meal: Meal) => (
                        <div key={meal.id} className="p-5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-400 text-slate-900 rounded-xl flex items-center justify-center font-bold">
                              <Utensils size={24} />
                            </div>
                            <div>
                              <h5 className="text-lg font-black text-slate-900">{meal.name}</h5>
                              <p className="text-xs text-slate-500 font-medium">Window: {meal.eligibleFrom} - {meal.eligibleTo} · Cost: LKR {meal.cost}</p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleIssueMeal(meal)}
                            className="px-6 py-3 bg-slate-900 text-white hover:bg-emerald-600 rounded-xl font-black text-sm transition-all shadow-md"
                          >
                            Confirm & Issue
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Recent Meals */}
              {recentMeals.length > 0 && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
                  <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                    <History size={20} className="text-slate-400" />
                    Recent Meal Issues
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Time</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">User</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Dept</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Meal</th>
                          <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {recentMeals.map(tx => (
                          <tr key={tx.id}>
                            <td className="py-4 text-sm font-bold text-slate-500">{tx.time}</td>
                            <td className="py-4 text-sm font-black text-slate-900">{tx.user}</td>
                            <td className="py-4 text-sm text-slate-600">{tx.dept}</td>
                            <td className="py-4 text-sm font-bold text-slate-700">{tx.meal}</td>
                            <td className="py-4 text-sm font-black text-slate-900 text-right">LKR {tx.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default CanteenInterface;
