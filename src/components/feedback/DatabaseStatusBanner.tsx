import React, { useState } from 'react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { Database, ShieldCheck, ChevronRight, X, CheckCircle2, HardDrive } from 'lucide-react';

export const DatabaseStatusBanner: React.FC = () => {
  const { systemStatus, refreshSystemStatus } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const isDatabaseLive = systemStatus?.database.connected ?? false;
  const databaseState = systemStatus?.database.connected === undefined
    ? 'Checking database connection'
    : systemStatus.database.connected
      ? 'MySQL connected via Drizzle'
      : 'MySQL unavailable';

  return (
    <>
      {/* Top Architecture & Database Persistence Banner */}
      <div className="bg-slate-900 text-slate-300 border-b border-slate-800 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDatabaseLive ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isDatabaseLive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>

            <span className="font-medium text-white">SKILLBRIDGE platform status</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className={isDatabaseLive ? 'text-emerald-400' : 'text-amber-300'}>{databaseState}</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database Diagnostics & Schema</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal Drawer: Deep Architecture & Integrity Verification */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-950 text-sky-400 rounded-lg">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base font-heading">Database connection status</h3>
                  <p className="text-xs text-slate-400">Live status from the application server</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 font-semibold text-xs uppercase tracking-wide">
                    <Database className="w-4 h-4 text-emerald-600" />
                    Database
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">MySQL</div>
                  <div className={`text-xs font-medium mt-1 ${isDatabaseLive ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {databaseState}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 font-semibold text-xs uppercase tracking-wide">
                    <HardDrive className="w-4 h-4 text-sky-600" />
                    Access Layer
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">Drizzle ORM</div>
                  <div className="text-xs text-slate-500 mt-1">Configured MySQL connection</div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 font-semibold text-xs uppercase tracking-wide">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    Auth & Security
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">Bcrypt + JWT</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Server-enforced RBAC
                  </div>
                </div>
              </div>

              {/* Table Row Counts */}
              {systemStatus?.database.tableCounts && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
                    MySQL Tables & Live Row Counts
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                    {Object.entries(systemStatus.database.tableCounts).map(([table, count]) => (
                      <div key={table} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-slate-500 text-[11px] truncate">{table}</div>
                        <div className="font-bold text-slate-900 mt-0.5">{count < 0 ? 'Unavailable' : `${count} rows`}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Truthful Persistence Disclosure */}
              <div className="p-4 bg-emerald-50/70 rounded-lg border border-emerald-200 text-emerald-950">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-emerald-950">Relational Database Verification</h4>
                    <p className="text-xs leading-relaxed text-emerald-900">
                      {isDatabaseLive
                        ? <>The application has verified its configured MySQL connection. Related account and job writes use database transactions. The application does not apply migrations or seed records at startup.</>
                        : <>The application has not verified a MySQL connection. Data operations are unavailable until the configured database is reachable.</>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Refresh / Check Connection */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500 font-mono">
                  Adapter: Drizzle ORM · MySQL
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => refreshSystemStatus()}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Refresh Status
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
