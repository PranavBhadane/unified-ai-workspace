import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  Layers,
  MessageSquare,
  Users,
  FileText,
  HardDrive,
  Mail,
  Send,
  ExternalLink,
  Eye,
  ArrowRight,
  TrendingUp,
  BarChart2,
  PieChart as PieIcon
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../services/api';

const SAMPLE_PROMPTS = [
  "Show 7-day communication velocity between WhatsApp and Gmail",
  "Create an activity dashboard for all active client interactions",
  "Financial overview of expenses, rental agreements, and documents",
  "Compare interaction volume for my most frequent contacts"
];

export default function DashboardsPage() {
  const [dashboardsList, setDashboardsList] = useState([]);
  const [activeDashId, setActiveDashId] = useState('default');
  const [currentDashboard, setCurrentDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  // AI Prompt Generation State
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    loadDashboardsList();
  }, []);

  useEffect(() => {
    loadDashboard(activeDashId);
  }, [activeDashId]);

  const loadDashboardsList = async () => {
    try {
      const res = await api.getDashboards();
      if (res.success && res.dashboards) {
        setDashboardsList(res.dashboards);
      }
    } catch (e) {
      console.warn('Failed to load dashboards list:', e);
    }
  };

  const loadDashboard = async (id) => {
    setLoading(true);
    try {
      const res = await api.getDashboard(id);
      if (res.success && res.dashboard) {
        setCurrentDashboard(res.dashboard);
      }
    } catch (e) {
      console.warn('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAiDashboard = async (promptToUse) => {
    const p = (promptToUse || aiPrompt).trim();
    if (!p) return;

    setGeneratingAi(true);
    try {
      const res = await api.generateAiDashboard({ prompt: p });
      if (res.success && res.dashboard) {
        setAiPrompt('');
        await loadDashboardsList();
        setActiveDashId(res.dashboard.id);
        setCurrentDashboard(res.dashboard);
      } else {
        alert(res.error || 'Failed to generate dashboard');
      }
    } catch (err) {
      alert(err.message || 'Error generating dashboard');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleDeleteDashboard = async (id) => {
    if (id === 'default' || !window.confirm('Are you sure you want to delete this custom dashboard?')) return;
    try {
      const res = await api.deleteDashboard(id);
      if (res.success) {
        setDashboardsList(dashboardsList.filter(d => d.id !== id));
        setActiveDashId('default');
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const renderWidget = (w) => {
    switch (w.widgetType) {
      case 'kpi_messages':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">{w.title}</span>
                <MessageSquare className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
                {w.data?.total || 0}
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                WA: {w.data?.whatsapp || 0}
              </span>
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                Gmail: {w.data?.gmail || 0}
              </span>
            </div>
          </div>
        );

      case 'kpi_contacts':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">{w.title}</span>
                <Users className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
                {w.data?.total || 0}
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Active Chats: <strong className="text-slate-800 dark:text-slate-200">{w.data?.activeChats || 0}</strong>
              </span>
              <span className="text-indigo-600 font-semibold">
                Entities: {w.data?.entities || 0}
              </span>
            </div>
          </div>
        );

      case 'kpi_documents':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">{w.title}</span>
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
                {w.data?.total || 0}
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Drive: <strong className="text-slate-800 dark:text-slate-200">{w.data?.driveFiles || 0}</strong>
              </span>
              <span className="text-indigo-600 font-mono text-[11px] font-semibold">
                {formatSize(w.data?.totalBytes)}
              </span>
            </div>
          </div>
        );

      case 'chart_activity_trend':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs col-span-1 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  {w.title}
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">Daily Message Velocity</span>
            </div>
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={Array.isArray(w.data) ? w.data : []}>
                  <defs>
                    <linearGradient id="colorWa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEmail" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea4335" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ea4335" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      color: '#fff'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="whatsapp" name="WhatsApp" stroke="#22c55e" fillOpacity={1} fill="url(#colorWa)" />
                  <Area type="monotone" dataKey="gmail" name="Gmail" stroke="#ea4335" fillOpacity={1} fill="url(#colorEmail)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'chart_distribution':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-purple-500" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  {w.title}
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">By Channel</span>
            </div>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Array.isArray(w.data) ? w.data : []}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(Array.isArray(w.data) ? w.data : []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      color: '#fff'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'chart_top_contacts':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-indigo-500" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  {w.title}
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">Interaction Volume</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.isArray(w.data) ? w.data : []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="interactions" name="Interactions" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'table_recent_activity':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs col-span-1 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  {w.title}
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">Cross-Channel Messages</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="pb-2">Sender</th>
                    <th className="pb-2">Snippet</th>
                    <th className="pb-2">Platform</th>
                    <th className="pb-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.isArray(w.data) && w.data.length > 0 ? (
                    w.data.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                          {item.sender}
                        </td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                          {item.snippet}
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.platform === 'whatsapp'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}>
                            {item.platform}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-slate-400 text-[11px]">
                          {item.timestamp ? new Date(Number(item.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        No recent interaction records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'table_recent_documents':
        return (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs col-span-1 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  {w.title}
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">Drive Documents</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="pb-2">File Name</th>
                    <th className="pb-2">Size</th>
                    <th className="pb-2 text-right">Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.isArray(w.data) && w.data.length > 0 ? (
                    w.data.map((file, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 font-semibold text-slate-900 dark:text-white truncate max-w-sm">
                          {file.name}
                        </td>
                        <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                          {formatSize(file.size_bytes)}
                        </td>
                        <td className="py-2.5 text-right text-slate-400 text-[11px]">
                          {file.timestamp ? new Date(file.timestamp).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">
                        No drive document records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-xs text-slate-700">{w.title}</h4>
            <p className="text-xs text-slate-400 mt-2">Widget preview available.</p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-indigo-500" />
            Intelligent AI Dashboards & Metrics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time interactive intelligence dashboards synthesized from connected WhatsApp, Gmail, Drive, and CRM records.
          </p>
        </div>

        <button
          onClick={() => loadDashboard(activeDashId)}
          className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition shrink-0"
          title="Refresh dashboard metrics"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Natural Language Prompt to Dashboard Bar */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-300" />
          <h3 className="font-bold text-sm tracking-wide">Generate Custom Dashboard with AI</h3>
        </div>
        <p className="text-xs text-indigo-200 leading-relaxed max-w-2xl">
          Type what you want to visualize in natural language. The AI will synthesize a custom layout, query real workspace data, and build interactive charts for you.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); handleGenerateAiDashboard(); }}
          className="flex items-center gap-2 pt-1"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Create a communication velocity dashboard comparing WhatsApp vs Gmail for Imran Pathan..."
              disabled={generatingAi}
              className="w-full bg-white/10 border border-white/20 rounded-2xl pl-4 pr-10 py-3 text-xs text-white placeholder-indigo-200/60 focus:bg-white/15 focus:ring-2 focus:ring-indigo-400 outline-none backdrop-blur-md"
            />
            {generatingAi && (
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-300 absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          <button
            type="submit"
            disabled={generatingAi || !aiPrompt.trim()}
            className="px-5 py-3 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-lg transition shrink-0 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            {generatingAi ? 'Synthesizing...' : 'Build Dashboard'}
          </button>
        </form>

        {/* Prompt Suggestions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] font-semibold text-indigo-300/80 uppercase">Suggestions:</span>
          {SAMPLE_PROMPTS.map((sp, idx) => (
            <button
              key={idx}
              onClick={() => handleGenerateAiDashboard(sp)}
              disabled={generatingAi}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-indigo-100 transition truncate max-w-xs"
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          {/* Default Dashboard */}
          <button
            onClick={() => setActiveDashId('default')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeDashId === 'default'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-indigo-600'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Executive Workspace Overview
          </button>

          {/* Custom AI Dashboards */}
          {dashboardsList.map((d) => (
            <div key={d.id} className="flex items-center">
              <button
                onClick={() => setActiveDashId(d.id)}
                className={`px-3.5 py-2 rounded-l-xl text-xs font-semibold transition flex items-center gap-1.5 truncate max-w-[200px] ${
                  activeDashId === d.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-indigo-600'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                <span className="truncate">{d.title}</span>
              </button>
              <button
                onClick={() => handleDeleteDashboard(d.id)}
                className={`p-2 rounded-r-xl border-y border-r text-slate-400 hover:text-rose-500 transition ${
                  activeDashId === d.id
                    ? 'bg-indigo-700 text-white border-indigo-700'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
                title="Delete this dashboard"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard Content */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-xs font-semibold">Loading real workspace metrics...</p>
        </div>
      ) : currentDashboard ? (
        <div className="space-y-6">
          {/* Dashboard Title & Description */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {currentDashboard.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentDashboard.description}
            </p>
          </div>

          {/* Widgets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {currentDashboard.widgets?.map((w) => (
              <React.Fragment key={w.id}>
                {renderWidget(w)}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-slate-400">
          <p className="text-xs">Dashboard not found.</p>
        </div>
      )}
    </div>
  );
}
