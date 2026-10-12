/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Utensils, 
  Coffee, 
  Calendar, 
  Clock, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  History,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const UserDashboard: React.FC = () => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Welcome back, Lakshitha!</h2>
          <div className="flex items-center gap-2 text-slate-500 mt-2 font-medium">
            <Calendar size={18} className="text-amber-500" />
            <span>{today}</span>
          </div>
        </div>
        <button className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">
          <Download size={20} />
          <span>Download Department Pass</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Eligibility Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Today's Meal Eligibility</h3>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider">
                Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { name: 'Breakfast', time: '07:00 - 09:30', status: 'issued', icon: Coffee },
                { name: 'Lunch', time: '12:00 - 14:30', status: 'eligible', icon: Utensils },
              ].map((meal) => (
                <div 
                  key={meal.name}
                  className={cn(
                    "p-6 rounded-3xl border-2 transition-all",
                    meal.status === 'issued' ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-amber-100 shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      meal.status === 'issued' ? "bg-slate-200 text-slate-500" : "bg-amber-100 text-amber-600"
                    )}>
                      <meal.icon size={24} />
                    </div>
                    {meal.status === 'issued' ? (
                      <CheckCircle2 size={24} className="text-emerald-500" />
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase tracking-widest">
                        <Clock size={12} /> Eligible
                      </div>
                    )}
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">{meal.name}</h4>
                  <p className="text-sm text-slate-500 font-medium mt-1">{meal.time}</p>
                  {meal.status === 'issued' && (
                    <p className="text-xs font-bold text-emerald-600 mt-4 flex items-center gap-1">
                      Issued at 08:15 AM
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="p-6 bg-blue-50 rounded-3xl flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Dinner Eligibility</p>
                <p className="text-xs text-blue-700 font-medium">Eligible from 19:00 PM today.</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <History size={20} className="text-slate-400" />
                Recent Activity
              </h3>
              <button className="text-sm font-bold text-blue-600 hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {[
                { title: 'Breakfast Issued', time: 'Today, 08:15 AM', location: 'Main Canteen' },
                { title: 'Tea & Biscuit Issued', time: 'Yesterday, 03:45 PM', location: 'Snack Bar' },
                { title: 'Lunch Issued', time: 'Yesterday, 12:30 PM', location: 'Main Canteen' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-amber-400 transition-colors" />
                    <div>
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 font-medium">{item.time} • {item.location}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quota Sidebar */}
        <div className="space-y-8">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-900/20 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="relative">
              <h3 className="text-xl font-bold mb-6">Remaining Quota</h3>
              <div className="space-y-6">
                {[
                  { name: 'Tea / Coffee', used: 1, total: 2, color: 'amber' },
                  { name: 'Biscuits / Buns', used: 0, total: 1, color: 'blue' },
                ].map((q) => (
                  <div key={q.name} className="space-y-3">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-slate-400">{q.name}</span>
                      <span>{q.used} / {q.total}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(q.used / q.total) * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          q.color === 'amber' ? "bg-amber-400" : "bg-blue-400"
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-800 relative">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Quotas reset daily at 00:00 AM. Unused quotas do not carry forward.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 space-y-4">
            <h4 className="font-bold text-amber-900">Need Help?</h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              If you have issues with your department pass or meal eligibility, please contact the HR department.
            </p>
            <button className="w-full py-3 bg-amber-400 text-slate-900 rounded-xl font-bold text-sm hover:bg-amber-500 transition-colors">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
