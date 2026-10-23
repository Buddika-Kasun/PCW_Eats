/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  LayoutDashboard,
  Package,
  Utensils,
  ClipboardList,
  Building2,
  BarChart3,
  User,
  Tablet,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/utils";
import { View } from "../types";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const menuItems = [
    {
      id: "admin-dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      group: "Admin",
    },
    { id: "item-management", label: "Items", icon: Package, group: "Admin" },
    { id: "meal-management", label: "Meals", icon: Utensils, group: "Admin" },
    {
      id: "quota-management",
      label: "Quotas",
      icon: ClipboardList,
      group: "Admin",
    },
    {
      id: "canteen-management",
      label: "Canteens",
      icon: Building2,
      group: "Admin",
    },
    { id: "reports", label: "Reports", icon: BarChart3, group: "Admin" },
    { id: "user-dashboard", label: "User Portal", icon: User, group: "User" },
    {
      id: "canteen-interface",
      label: "Canteen App",
      icon: Tablet,
      group: "Canteen",
    },
  ];

  const groups = ["Admin", "User", "Canteen"];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-400 rounded-lg flex items-center justify-center">
          <Utensils className="text-slate-900" size={24} />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight">PCW Eats</h1>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            Canteen ERP
          </p>
        </div>
      </div>

      {/* <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto"> */}
      <nav
        className="flex-1 px-4 py-4 mr-0.5 space-y-8 overflow-y-auto 
  [&::-webkit-scrollbar]:w-1.5 
  [&::-webkit-scrollbar-track]:bg-transparent 
  [&::-webkit-scrollbar-thumb]:bg-slate-600 
  [&::-webkit-scrollbar-thumb]:rounded-full 
  hover:[&::-webkit-scrollbar-thumb]:bg-slate-500"
      >
        {groups.map((group) => (
          <div key={group} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">
              {group}
            </h3>
            {menuItems
              .filter((item) => item.group === group)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as View)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group cursor-pointer",
                    currentView === item.id
                      ? "bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white",
                  )}
                >
                  <item.icon
                    size={18}
                    className={cn(
                      "transition-colors",
                      currentView === item.id
                        ? "text-slate-900"
                        : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {currentView === item.id && <ChevronRight size={14} />}
                </button>
              ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-800/50">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
            LF
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Lakshitha F.</p>
            <p className="text-[10px] text-slate-500 truncate">System Admin</p>
          </div>
        </div>
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
