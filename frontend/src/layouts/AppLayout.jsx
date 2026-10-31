import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  Link2,
  Users,
  FileText,
  RefreshCw,
  Settings,
  ScrollText,
  Search,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import socketService from '../services/socket';

export default function AppLayout() {
  const [darkMode, setDarkMode] = useState(false);
  const [connections, setConnections] = useState([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check dark mode preference
    if (localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    loadConnections();
    const socket = socketService.connect();

    const handleConnUpdate = () => loadConnections();
    const handleSystemLog = (log) => {
      const level = (log.log_level || log.level || 'info').toLowerCase();
      const badgeColor = level === 'error' ? '#ef4444' : level === 'warn' ? '#f59e0b' : '#6366f1';
      const dur = (log.duration_ms !== undefined && log.duration_ms !== null) ? ` (${log.duration_ms}ms)` : (log.durationMs ? ` (${log.durationMs}ms)` : '');
      const req = log.request_id || log.requestId ? ` [${(log.request_id || log.requestId).slice(-8)}]` : '';
      console.log(
        `%c ${level.toUpperCase()} %c[${log.module || 'sys'}:${log.action || 'act'}]%c ${log.message}${dur}${req}`,
        `background: ${badgeColor}; color: #ffffff; border-radius: 4px; font-weight: bold; padding: 1px 4px; font-size: 10px;`,
        'color: #818cf8; font-weight: bold;',
        'color: inherit;',
        log.details_json || log.details || ''
      );
    };

    socketService.on('whatsapp:status', handleConnUpdate);
    socketService.on('sync:status', handleConnUpdate);
    socketService.on('system:log', handleSystemLog);

    return () => {
      socketService.off('whatsapp:status', handleConnUpdate);
      socketService.off('sync:status', handleConnUpdate);
      socketService.off('system:log', handleSystemLog);
    };
  }, []);

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };

  const loadConnections = async () => {
    try {
      const data = await api.getConnections();
      if (data.success) {
        setConnections(data.connectors);
      }
    } catch (e) {
      console.warn('Failed to load connector status:', e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/ai?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ai', label: 'AI Assistant', icon: Sparkles },
    { to: '/clients', label: 'Clients & Entities', icon: Users },
    { to: '/documents', label: 'Documents', icon: FileText },
    { to: '/reports', label: 'Reports', icon: ScrollText },
    { to: '/dashboards', label: 'AI Dashboards', icon: LayoutDashboard },
    { to: '/connections', label: 'Connections', icon: Link2 },
    { to: '/sync', label: 'Synchronization', icon: RefreshCw },
    { to: '/logs', label: 'System Logs', icon: ScrollText },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Left Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">Unified AI</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Local-First Workspace</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}
                  `}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Connector Status Pills */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Connectors
          </div>
          <div className="space-y-1.5">
            {connections.map((c) => {
              const isConnected = c.status === 'connected';
              return (
                <div key={c.platform} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    isConnected 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' 
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    {isConnected ? 'Active' : 'Offline'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
              100% Local-First
            </span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">v1.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-8 z-10">
          {/* Global search */}
          <form onSubmit={handleSearchSubmit} className="relative w-96">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Ask anything or search records..."
              className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-full pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none transition-all"
            />
          </form>

          {/* Top Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>

            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                U
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Workspace User</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">admin@workspace.local</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Route View */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
