import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Mail,
  HardDrive,
  Layers,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Database,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import socketService from '../services/socket';

export default function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [activity, setActivity] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();

    const handleSyncUpdate = () => loadDashboardData();
    socketService.on('sync:status', handleSyncUpdate);

    return () => {
      socketService.off('sync:status', handleSyncUpdate);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const [kpiRes, actRes, connRes] = await Promise.all([
        api.getKPIs(),
        api.getRecentActivity(),
        api.getConnections()
      ]);

      if (kpiRes.success) setKpis(kpiRes.kpis);
      if (actRes.success) setActivity(actRes);
      if (connRes.success) setConnections(connRes.connectors);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSync = async (platform) => {
    try {
      await api.startSync(platform);
      navigate('/sync');
    } catch (e) {
      alert(`Sync failed: ${e.message}`);
    }
  };

  const statsCards = [
    {
      label: 'WhatsApp Messages',
      value: kpis?.whatsappMessages || 0,
      icon: MessageSquare,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40'
    },
    {
      label: 'Gmail Correspondence',
      value: kpis?.gmailEmails || 0,
      icon: Mail,
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40'
    },
    {
      label: 'Google Drive Files',
      value: kpis?.driveFiles || 0,
      icon: HardDrive,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40'
    },
    {
      label: 'Indexed Doc Chunks',
      value: kpis?.indexedChunks || 0,
      icon: Layers,
      color: 'from-purple-500 to-pink-600',
      textColor: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/40'
    },
    {
      label: 'Known Client Entities',
      value: kpis?.entitiesCount || 0,
      icon: Sparkles,
      color: 'from-indigo-500 to-violet-600',
      textColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40'
    },
    {
      label: 'Local Storage Used',
      value: kpis?.storageFormatted || '0.00 MB',
      icon: Database,
      color: 'from-slate-600 to-slate-800',
      textColor: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome & Prompt Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            AI-Powered Intelligence Active
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Unified Personal Workspace
          </h2>
          <p className="text-indigo-200 text-sm leading-relaxed">
            All your WhatsApp conversations, Gmail emails, and Google Drive documents indexed locally. Ask questions, compare quotes, and extract client timelines effortlessly.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/ai')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-indigo-950 font-semibold text-xs shadow-md hover:bg-indigo-50 transition"
            >
              Ask Gemini AI
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => navigate('/connections')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-700/50 hover:bg-indigo-700/70 text-white font-medium text-xs border border-indigo-500/40 transition"
            >
              Manage Connectors
            </button>
          </div>
        </div>

        {/* Ambient decorative glow */}
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>
      </div>

      {/* KPI Cards Grid */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
          Workspace Overview
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statsCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                    {loading ? '...' : card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.bgColor} ${card.textColor}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connector Status Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Connected Accounts
          </h3>
          <button
            onClick={() => navigate('/connections')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            Configure Accounts
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {connections.map((c) => {
            const isConnected = c.status === 'connected';
            return (
              <div
                key={c.platform}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{c.name}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      isConnected
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {isConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {c.description}
                  </p>
                  {c.account && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {c.account.account_name || c.account.account_identifier}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {c.account.account_identifier}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-5 flex items-center gap-2">
                  {isConnected ? (
                    <button
                      onClick={() => handleQuickSync(c.platform)}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync Now
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/connections')}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Synchronizations */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-indigo-500" />
              Recent Synchronization Jobs
            </h4>
            <button
              onClick={() => navigate('/sync')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {activity?.recentSyncs && activity.recentSyncs.length > 0 ? (
              activity.recentSyncs.map((sync) => (
                <div
                  key={sync.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                      {sync.platform} ({sync.job_type})
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Processed {sync.records_processed} records • {new Date(sync.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    sync.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                  }`}>
                    {sync.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No recent sync jobs</p>
            )}
          </div>
        </div>

        {/* Recent AI Conversations */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Recent AI Conversations
            </h4>
            <button
              onClick={() => navigate('/ai')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              New Chat
            </button>
          </div>

          <div className="space-y-3">
            {activity?.recentAi && activity.recentAi.length > 0 ? (
              activity.recentAi.map((ai) => (
                <div
                  key={ai.id}
                  onClick={() => navigate(`/ai?conv=${ai.id}`)}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 truncate pr-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {ai.title}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(ai.updated_at).toLocaleDateString()} at {new Date(ai.updated_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No previous AI conversations</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
