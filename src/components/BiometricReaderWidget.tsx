/**
 * ============================================================================
 * BiometricReaderWidget.tsx
 * ============================================================================
 * Reusable UI component that interfaces directly with the ZKTeco MB360 reader.
 * 
 * Features:
 * - Real-time SSE listener capturing live fingerprint punches.
 * - Hardware status indicator (Online / Port 4370 / IP).
 * - Quick simulation trigger for testing without physical terminal.
 * - Device configuration modal to customize device IP and network parameters.
 * - Callback `onEmployeeIdentified` to immediately auto-fill employee numbers.
 */

import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  Wifi, 
  Settings2, 
  CheckCircle2, 
  Sparkles, 
  AlertCircle,
  Radio,
  X,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface BiometricReaderWidgetProps {
  onEmployeeIdentified: (employee: { id: string; name: string; dept: string }) => void;
  className?: string;
  compact?: boolean;
}

export const BiometricReaderWidget: React.FC<BiometricReaderWidgetProps> = ({
  onEmployeeIdentified,
  className,
  compact = false,
}) => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [isListening, setIsListening] = useState(true);
  const [lastScanned, setLastScanned] = useState<any | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    ip: '192.168.1.201',
    port: 4370,
    deviceName: 'ZKTeco MB360 Canteen Scanner #1',
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // 1. Fetch initial status & employee list for testing
  useEffect(() => {
    api.zkteco.getStatus()
      .then(res => {
        if (res.success) {
          setDeviceStatus(res.data);
          if (res.data.config) {
            setConfigForm({
              ip: res.data.config.ip || '192.168.1.201',
              port: res.data.config.port || 4370,
              deviceName: res.data.config.deviceName || 'ZKTeco MB360',
            });
          }
        }
      })
      .catch(err => console.error('Failed to get ZKTeco status:', err));

    api.reports.getUsers()
      .then(res => {
        if (res.success) setAvailableUsers(res.data);
      })
      .catch(err => console.error('Failed to fetch users:', err));
  }, []);

  // 2. Subscribe to real-time biometric scan events via SSE
  useEffect(() => {
    const unsubscribe = api.zkteco.subscribeEvents((event) => {
      if (event.user) {
        setLastScanned({
          user: event.user,
          log: event.log,
          time: new Date().toLocaleTimeString(),
        });

        // Trigger callback to parent (e.g. CanteenInterface)
        onEmployeeIdentified({
          id: event.user.id,
          name: event.user.name,
          dept: event.user.dept,
        });

        // Reset highlight after 4 seconds
        setTimeout(() => setLastScanned(null), 4000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onEmployeeIdentified]);

  // Handle simulation scan
  const handleSimulate = async (employeeId?: string) => {
    setIsSimulating(true);
    try {
      const res = await api.zkteco.simulateScan(employeeId);
      if (res.data?.user) {
        setLastScanned({
          user: res.data.user,
          log: res.data.log,
          time: new Date().toLocaleTimeString(),
        });
        onEmployeeIdentified({
          id: res.data.user.id,
          name: res.data.user.name,
          dept: res.data.user.dept,
        });
        setTimeout(() => setLastScanned(null), 4000);
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Save device configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.zkteco.updateConfig(configForm);
      if (res.success) {
        setDeviceStatus((prev: any) => ({
          ...prev,
          config: { ...prev?.config, ...configForm },
        }));
        setShowConfigModal(false);
      }
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Main Widget Banner */}
      <div className={cn(
        "rounded-2xl border transition-all duration-300",
        lastScanned 
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 shadow-md shadow-emerald-500/5" 
          : "bg-slate-900 border-slate-800 text-white shadow-lg shadow-slate-950/20",
        compact ? "p-3" : "p-4 md:p-5"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status info */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center relative transition-transform",
              lastScanned 
                ? "bg-emerald-500 text-white scale-110" 
                : "bg-amber-400 text-slate-900"
            )}>
              <Fingerprint size={24} className={lastScanned ? "animate-pulse" : ""} />
              {isListening && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className={cn("font-bold text-sm tracking-tight", lastScanned ? "text-emerald-900" : "text-white")}>
                  ZKTeco MB360 Biometric Reader
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Radio size={10} className="animate-pulse" /> Live
                </span>
              </div>
              <p className={cn("text-xs font-mono mt-0.5", lastScanned ? "text-emerald-700" : "text-slate-400")}>
                IP: <strong className="text-amber-400 font-semibold">{deviceStatus?.config?.ip || '192.168.1.201'}</strong>:4370 • Standalone TCP/IP
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Quick Simulation Trigger */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => handleSimulate()}
                disabled={isSimulating}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                title="Simulate fingerprint touch on the MB360 reader"
              >
                <Fingerprint size={14} />
                <span>{isSimulating ? 'Scanning...' : 'Test Finger Scan'}</span>
              </button>

              {/* Quick user selector for testing specific employee */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleSimulate(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="bg-slate-900 text-slate-300 text-xs font-medium px-2 py-1.5 rounded-lg border border-slate-700 outline-none cursor-pointer hover:bg-slate-950"
                title="Select specific enrolled employee to simulate"
              >
                <option value="" disabled>Pick Employee...</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.id} - {u.name} ({u.dept})
                  </option>
                ))}
              </select>
            </div>

            {/* Hardware settings button */}
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800"
              title="Configure ZKTeco MB360 IP & Port"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>

        {/* Live Identification Banner when a scan occurs */}
        <AnimatePresence>
          {lastScanned && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="pt-3 border-t border-emerald-500/20 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>
                  Captured from MB360: <strong className="text-emerald-950 font-black">{lastScanned.user.name}</strong> ({lastScanned.user.id}) — {lastScanned.user.dept}
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 font-bold">
                {lastScanned.time}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hardware Settings Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfigModal(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-400/20 text-amber-700 rounded-xl flex items-center justify-center">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">ZKTeco MB360 Terminal Setup</h3>
                    <p className="text-xs text-slate-500">Configure local network communication parameters</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Device Name</label>
                  <input
                    type="text"
                    value={configForm.deviceName}
                    onChange={(e) => setConfigForm({ ...configForm, deviceName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Terminal IP Address</label>
                    <input
                      type="text"
                      value={configForm.ip}
                      onChange={(e) => setConfigForm({ ...configForm, ip: e.target.value })}
                      placeholder="192.168.1.201"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">TCP Port (Default: 4370)</label>
                    <input
                      type="number"
                      value={configForm.port}
                      onChange={(e) => setConfigForm({ ...configForm, port: parseInt(e.target.value) || 4370 })}
                      placeholder="4370"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2 text-slate-600 leading-relaxed">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Wifi size={14} className="text-amber-500" />
                    How to connect your physical MB360 device:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-500">
                    <li>Connect the ZKTeco MB360 to your local network switch or router via Ethernet cable.</li>
                    <li>On the device menu: <strong>Comm. &gt; Ethernet</strong> &gt; Assign static IP (e.g., <code className="text-slate-800 font-mono">192.168.1.201</code>).</li>
                    <li>Ensure Port is set to <code className="text-slate-800 font-mono">4370</code> and Comm Key is <code className="text-slate-800 font-mono">0</code>.</li>
                    <li>The backend service communicates automatically with the device and streams punch events to this browser screen.</li>
                  </ol>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg text-sm"
                  >
                    Save & Apply
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

export default BiometricReaderWidget;
