import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  MessageSquare,
  Mail,
  HardDrive,
  Users,
  FileText,
  Link2,
  Image,
  Database,
  Radio,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import api from '../services/api';
import socketService from '../services/socket';

export default function SyncPage() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveLogs, setLiveLogs] = useState([]);
  const [startingPlatform, setStartingPlatform] = useState(null);

  // WhatsApp API Live State
  const [waLive, setWaLive] = useState({
    connectionState: 'unknown',
    serviceHealth: 'checking',
    serviceUrl: 'http://localhost:3001',
    stats: {
      totalChats: 0,
      totalMessages: 0,
      totalGroups: 0,
      totalMedia: 0,
      totalLinks: 0,
      totalParticipants: 0
    },
    lastSyncTime: null,
    isFallback: false,
    message: null
  });

  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    loadAllData();

    // 6-second polling interval for live status & health updates
    const pollInterval = setInterval(() => {
      pollWhatsAppStatus();
    }, 6000);

    const handleLog = (log) => {
      setLiveLogs((prev) => [log, ...prev.slice(0, 49)]);
    };

    const handleStatus = () => {
      loadSyncData();
      pollWhatsAppStatus();
    };

    socketService.on('sync:log', handleLog);
    socketService.on('sync:status', handleStatus);
    socketService.on('sync:progress', handleStatus);

    return () => {
      clearInterval(pollInterval);
      socketService.off('sync:log', handleLog);
      socketService.off('sync:status', handleStatus);
      socketService.off('sync:progress', handleStatus);
    };
  }, []);

  const loadAllData = async () => {
    await Promise.all([loadSyncData(), pollWhatsAppStatus()]);
  };

  const loadSyncData = async () => {
    try {
      const [statusRes, histRes] = await Promise.all([
        api.getSyncStatus(),
        api.getSyncHistory()
      ]);
      if (statusRes.success) setSyncStatus(statusRes.status);
      if (histRes.success) setHistory(histRes.history);
    } catch (e) {
      console.warn('Failed to load sync data:', e);
    }
  };

  const pollWhatsAppStatus = async () => {
    try {
      const res = await api.getWhatsAppLiveStatus();
      if (res.success) {
        setWaLive({
          connectionState: res.connectionState || 'disconnected',
          serviceHealth: res.serviceHealth || (res.isFallback ? 'unreachable' : 'reachable'),
          serviceUrl: res.serviceUrl || 'http://localhost:3001',
          account: res.account || null,
          stats: {
            totalChats: res.stats?.totalChats || 0,
            totalMessages: res.stats?.totalMessages || 0,
            totalGroups: res.stats?.totalGroups || 0,
            totalMedia: res.stats?.totalMedia || 0,
            totalLinks: res.stats?.totalLinks || 0,
            totalParticipants: res.stats?.totalParticipants || 0
          },
          lastSyncTime: res.lastSyncTime || null,
          isFallback: !!res.isFallback,
          message: res.message || null
        });
      }
    } catch (err) {
      setWaLive((prev) => ({
        ...prev,
        serviceHealth: 'unreachable',
        isFallback: true,
        message: err.message || 'WhatsApp API service is currently unreachable'
      }));
    }
  };

  const handleSyncGroups = async () => {
    setIsSyncingGroups(true);
    setSyncMessage(null);
    try {
      const res = await api.syncWhatsAppGroups();
      setSyncMessage({
        type: res.warning ? 'warning' : 'success',
        text: res.message || 'Groups synchronized successfully.'
      });
      await pollWhatsAppStatus();
      await loadSyncData();
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: `Failed to synchronize groups: ${err.message}`
      });
    } finally {
      setIsSyncingGroups(false);
      setTimeout(() => setSyncMessage(null), 8000);
    }
  };

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      await pollWhatsAppStatus();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleStartSync = async (platform) => {
    setStartingPlatform(platform);
    try {
      await api.startSync(platform);
      await loadAllData();
    } catch (e) {
      alert(`Failed to start ${platform} sync: ${e.message}`);
    } finally {
      setStartingPlatform(null);
    }
  };

  const handleStopSync = async (platform) => {
    try {
      await api.stopSync(platform);
      await loadSyncData();
    } catch (e) {
      alert(`Failed to cancel sync: ${e.message}`);
    }
  };

  const activeJobs = syncStatus?.runningDetails || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Synchronization Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time synchronization status, archive counts, and service health across WhatsApp, Gmail, and Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Offline / Fallback Warning Banner */}
      {waLive.serviceHealth === 'unreachable' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>WhatsApp API Service Offline:</strong> Could not connect to {waLive.serviceUrl}. Displaying cached local workspace data.
            </span>
          </div>
          <button
            onClick={handleRetryConnection}
            disabled={isRetrying}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition"
          >
            <RotateCcw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
            Retry Connection
          </button>
        </div>
      )}

      {/* Sync Groups Status Toast */}
      {syncMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 transition-all ${
            syncMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : syncMessage.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {syncMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* SECTION 1: PRIMARY WHATSAPP LIVE SYNCHRONIZATION CARD */}
      <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  WhatsApp Archive & Synchronization
                </h3>
                <span className="flex h-2 w-2 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      waLive.connectionState === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      waLive.connectionState === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  ></span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Primary data source: {waLive.isFallback ? 'Local Database Cache' : 'External WhatsApp API'} ({waLive.serviceUrl})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncGroups}
              disabled={isSyncingGroups}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 transition shadow-sm disabled:opacity-60"
            >
              <Users className={`h-3.5 w-3.5 ${isSyncingGroups ? 'animate-spin' : ''}`} />
              {isSyncingGroups ? 'Syncing Groups...' : 'Sync Groups'}
            </button>
          </div>
        </div>

        {/* Live Status Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Connection State */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Connection State
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  waLive.connectionState === 'connected'
                    ? 'bg-emerald-500'
                    : waLive.connectionState === 'connecting'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              ></span>
              <span className="font-bold text-sm capitalize text-slate-900 dark:text-white">
                {waLive.connectionState}
              </span>
            </div>
            {waLive.account && (
              <p className="text-[11px] text-slate-400 truncate">
                {waLive.account.name || waLive.account.phone}
              </p>
            )}
          </div>

          {/* 2. Service Health */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Service Health
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  waLive.serviceHealth === 'reachable'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : waLive.serviceHealth === 'degraded'
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                }`}
              >
                {waLive.serviceHealth === 'reachable'
                  ? 'Reachable'
                  : waLive.serviceHealth === 'degraded'
                  ? 'Degraded'
                  : 'Unreachable'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {waLive.serviceHealth === 'reachable' ? 'API responding OK' : 'Local fallback active'}
            </p>
          </div>

          {/* 3. Last Sync Time */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Last Sync Time
            </div>
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {waLive.lastSyncTime
                ? new Date(waLive.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Never'}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {waLive.lastSyncTime ? new Date(waLive.lastSyncTime).toLocaleDateString() : 'Awaiting trigger'}
            </p>
          </div>

          {/* 4. Active Data Mode */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Sync Mode
            </div>
            <div className="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              {waLive.isFallback ? 'Local Database' : 'API + Storage'}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {waLive.isFallback ? 'Offline Resilient' : 'Synchronized Live'}
            </p>
          </div>
        </div>

        {/* Archive Totals Counters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>WhatsApp Archive Totals</span>
            <span className="text-[11px] text-slate-400">Live counts</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Chats', count: waLive.stats.totalChats, icon: MessageSquare, color: 'text-emerald-500' },
              { label: 'Total Messages', count: waLive.stats.totalMessages, icon: FileText, color: 'text-blue-500' },
              { label: 'Total Groups', count: waLive.stats.totalGroups, icon: Users, color: 'text-purple-500' },
              { label: 'Media Files', count: waLive.stats.totalMedia, icon: Image, color: 'text-amber-500' },
              { label: 'Total Links', count: waLive.stats.totalLinks, icon: Link2, color: 'text-cyan-500' },
              { label: 'Participants', count: waLive.stats.totalParticipants, icon: Radio, color: 'text-rose-500' }
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex items-center gap-3"
                >
                  <div className={`p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs ${stat.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-base text-slate-900 dark:text-white">
                      {Number(stat.count).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: OTHER CONNECTED PLATFORMS MANUAL TRIGGERS */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          Manual Platform Synchronization
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { platform: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500' },
            { platform: 'gmail', name: 'Gmail', icon: Mail, color: 'text-blue-500' },
            { platform: 'drive', name: 'Google Drive', icon: HardDrive, color: 'text-amber-500' }
          ].map((item) => {
            const Icon = item.icon;
            const isRunning = activeJobs.some((j) => j.platform === item.platform);
            return (
              <div
                key={item.platform}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-6 w-6 ${item.color}`} />
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {isRunning ? 'Syncing...' : 'Ready'}
                    </p>
                  </div>
                </div>

                {isRunning ? (
                  <button
                    onClick={() => handleStopSync(item.platform)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-rose-100 transition"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartSync(item.platform)}
                    disabled={startingPlatform === item.platform}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition"
                  >
                    <Play className={`h-3 w-3 fill-current ${startingPlatform === item.platform ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: ACTIVE JOBS PROGRESS CARD */}
      {activeJobs.length > 0 && (
        <div className="p-6 rounded-2xl bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 space-y-4">
          <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
            Active Synchronization Jobs ({activeJobs.length})
          </h3>

          <div className="space-y-4">
            {activeJobs.map((job) => (
              <div key={job.id} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold capitalize text-slate-900 dark:text-white">
                    {job.platform} - {job.account_name || job.account_identifier}
                  </span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {job.progress_pct || 0}%
                  </span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${job.progress_pct || 0}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Processed: {job.records_processed || 0} records</span>
                  <span>Started: {new Date(job.started_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: REAL-TIME LOG VIEWER */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2 text-slate-400">
            <Terminal className="h-4 w-4 text-indigo-400" />
            Live Sync & API Stream
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Real-Time Polling & Socket.IO</span>
        </div>

        <div className="p-4 font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto">
          {liveLogs.length > 0 ? (
            liveLogs.map((log, idx) => (
              <div key={idx} className="flex gap-2 text-[11px]">
                <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span
                  className={`uppercase font-bold ${
                    log.level === 'error'
                      ? 'text-rose-400'
                      : log.level === 'warn'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  [{log.platform || 'sync'}]
                </span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))
          ) : (
            <div className="space-y-1 text-slate-400 text-[11px]">
              <p className="text-emerald-400 font-semibold">? Synchronization monitoring engine active</p>
              <p className="text-slate-500">
                Polling WhatsApp status & health every 6s. Click "Sync Groups" or "Sync" to trigger manual runs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: RECENT SYNC HISTORY TABLE */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recent Sync History</h3>
            <p className="text-[11px] text-slate-400">Audit trail of background and manual synchronization jobs</p>
          </div>
          <button
            onClick={loadSyncData}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-6">Platform</th>
              <th className="py-3 px-4">Operation Type</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Items Processed</th>
              <th className="py-3 px-6">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.length > 0 ? (
              history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="py-3 px-6 font-semibold capitalize text-slate-900 dark:text-white">
                    {h.platform}
                  </td>
                  <td className="py-3 px-4 capitalize text-slate-500 font-medium">
                    {h.job_type || 'Sync'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        h.status === 'completed' || h.status === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : h.status === 'failed'
                          ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {h.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                    {h.records_processed || 0}
                  </td>
                  <td className="py-3 px-6 text-slate-400">
                    {new Date(h.created_at || h.started_at).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-8 text-center text-xs text-slate-400">
                  No previous synchronization history recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
