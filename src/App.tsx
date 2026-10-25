/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import AdminDashboard from './components/AdminDashboard';
import ItemManagement from './components/ItemManagement';
import MealManagement from './components/MealManagement';
import QuotaManagement from './components/QuotaManagement';
import CanteenManagement from './components/CanteenManagement';
import Reports from './components/Reports';
import UserDashboard from './components/UserDashboard';
import CanteenInterface from './components/CanteenInterface';
import { View } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Utensils } from 'lucide-react';
import { AuthUser, getCachedUser } from './lib/auth';
import { Welcome } from './components/Welcome';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());
  const [currentView, setCurrentView] = useState<View>("admin-dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Gate: until we have a user, show the Welcome (validate / not-authorized) screen.
  if (!user) {
    return <Welcome onAuthed={setUser} />;
  }

  const renderView = () => {
    switch (currentView) {
      case "admin-dashboard":
        return <AdminDashboard />;
      case "item-management":
        return <ItemManagement />;
      case "meal-management":
        return <MealManagement />;
      case "quota-management":
        return <QuotaManagement />;
      case "canteen-management":
        return <CanteenManagement />;
      case "reports":
        return <Reports />;
      case "user-dashboard":
        return <UserDashboard />;
      case "canteen-interface":
        return <CanteenInterface />;
      default:
        return <AdminDashboard />;
    }
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  // Canteen interface is full screen, others have sidebar
  if (currentView === "canteen-interface") {
    return (
      <div className="min-h-screen bg-slate-50 font-sans selection:bg-amber-200 selection:text-amber-900">
        <CanteenInterface
          onBackToDashboard={() => handleViewChange("admin-dashboard")}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-amber-200 selection:text-amber-900">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar currentView={currentView} onViewChange={handleViewChange} />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar
                currentView={currentView}
                onViewChange={handleViewChange}
              />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 -right-12.5 p-2 bg-slate-900 text-white rounded-full shadow-xl cursor-pointer"
              >
                <X size={24} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 h-screen overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
              <Utensils className="text-slate-900" size={18} />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900">
              PCW Eats
            </h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <Menu size={24} />
          </button>
        </header>

        <div className="p-4 md:p-8 lg:p-12 max-w-8xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
