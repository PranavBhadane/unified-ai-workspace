import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Download,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Layers,
  FileCode,
  Copy,
  Check,
  Eye,
  X,
  Radio,
  Activity
} from 'lucide-react';
import api from '../services/api';
import socketService from '../services/socket';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Auto-refresh interval ref
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchLogs();
  }, [page, selectedLevel, selectedModule]);

  // Set up socket listener for live events and polling fallback
  useEffect(() => {
    const handleNewLog = (newLog) => {
      if (!autoRefresh) return;
      // Prepend if matches filter or filters empty
      if (
        (!selectedLevel || newLog.log_level === selectedLevel) &&
        (!selectedModule || newLog.module === selectedModule) &&
        page === 0
      ) {
        setLogs((prev) => [newLog, ...prev.slice(0, pageSize - 1)]);
        setTotal((t) => t + 1);
      }
    };

    socketService.on('system:log', handleNewLog);

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchLogs(true);
      }, 5000);
    }

    return () => {
      socketService.off('system:log', handleNewLog);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, selectedLevel, selectedModule, page, searchQuery]);

  const fetchLogs = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLevel) params.append('level', selectedLevel);
      if (selectedModule) params.append('module', selectedModule);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      params.append('limit', String(pageSize));
      params.append('offset', String(page * pageSize));

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await api.getLogs(queryStr);
      if (res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      console.warn('Failed to retrieve system logs:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      await api.clearLogs();
      setShowClearModal(false);
      setLogs([]);
      setTotal(0);
      fetchLogs();
    } catch (err) {
      alert(`Failed to clear logs: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-3 w-3" /> Error
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <AlertTriangle className="h-3 w-3" /> Warn
          </span>
        );
      case 'debug':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <FileCode className="h-3 w-3" /> Debug
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            <Info className="h-3 w-3" /> Info
          </span>
        );
    }
  };

  const getModuleBadge = (mod) => {
    const colors = {
      ai: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      whatsapp: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      gmail: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
      drive: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      sync: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      http: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      db: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800'
    };
    const c = colors[mod?.toLowerCase()] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${c}`}>
        {mod}
      </span>
    );
  };

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return null;
    let colorClass = 'text-emerald-600 dark:text-emerald-400';
    if (ms > 1000) colorClass = 'text-amber-600 dark:text-amber-400';
    if (ms > 4000) colorClass = 'text-rose-600 dark:text-rose-400 font-bold';
    return (
      <span className={`text-[11px] font-mono ${colorClass}`}>
        {ms}ms
      </span>
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ScrollText className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              System Logs & Diagnostics
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time structured event tracing, request correlation, error stacks, and execution latency.
          </p>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              autoRefresh
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title={autoRefresh ? 'Auto-refresh is active (every 5s & real-time socket events)' : 'Auto-refresh paused'}
          >
            <Radio className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-pulse text-emerald-500' : 'text-slate-400'}`} />
            <span>{autoRefresh ? 'Live Stream: On' : 'Live Stream: Paused'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export CSV / JSON */}
          <a
            href={api.exportLogsUrl('json')}
            download
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="h-3.5 w-3.5" /> JSON
          </a>
          <a
            href={api.exportLogsUrl('csv')}
            download
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>

          {/* Clear Logs */}
          <button
            onClick={() => setShowClearModal(true)}
            className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by message, action, or request ID..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        {/* Level Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedLevel}
            onChange={(e) => {
              setSelectedLevel(e.target.value);
              setPage(0);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Levels</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
            <option value="debug">DEBUG</option>
          </select>

          {/* Module Filter */}
          <select
            value={selectedModule}
            onChange={(e) => {
              setSelectedModule(e.target.value);
              setPage(0);
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Modules</option>
            <option value="ai">AI (Gemini / Tools)</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="gmail">Gmail</option>
            <option value="drive">Drive</option>
            <option value="sync">Sync Manager</option>
            <option value="http">HTTP Routes</option>
            <option value="db">Database</option>
            <option value="logs">Logs</option>
          </select>

          {/* Reset Filters */}
          {(selectedLevel || selectedModule || searchQuery) && (
            <button
              onClick={() => {
                setSelectedLevel('');
                setSelectedModule('');
                setSearchQuery('');
                setPage(0);
              }}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white hover:underline flex-shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Level</th>
                <th className="py-3 px-3">Module</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-3">Latency</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Request ID</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-mono">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const dateStr = new Date(log.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer font-sans"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">
                        {dateStr}
                      </td>

                      {/* Level */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getLevelBadge(log.log_level)}
                      </td>

                      {/* Module */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getModuleBadge(log.module)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">
                        {log.action}
                      </td>

                      {/* Message */}
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate" title={log.message}>
                        {log.message}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {formatDuration(log.duration_ms) || <span className="text-slate-400 text-[10px]">—</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {log.status ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            String(log.status).startsWith('2') || log.status === 'ok' || log.status === 'connected'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}>
                            {log.status}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Request ID */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {log.request_id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(log.request_id, log.id);
                            }}
                            className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            title="Click to copy Request ID"
                          >
                            <span>{log.request_id.slice(-8)}</span>
                            {copiedId === log.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-2.5 w-2.5 opacity-60" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Inspect button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                          title="Inspect complete payload"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                        <span>Loading system logs...</span>
                      </div>
                    ) : (
                      'No system logs found matching criteria.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {logs.length > 0 ? page * pageSize + 1 : 0} - {Math.min((page + 1) * pageSize, total)} of {total} events
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Previous
            </button>
            <span className="font-mono text-[11px]">
              Page {page + 1} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                {getLevelBadge(selectedLog.log_level)}
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedLog.module}:{selectedLog.action}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px]">Log ID:</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200 font-medium">{selectedLog.id}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Timestamp:</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Request ID:</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    {selectedLog.request_id || 'N/A'}
                    {selectedLog.request_id && (
                      <button
                        onClick={() => copyToClipboard(selectedLog.request_id, 'modal')}
                        className="hover:text-indigo-500"
                      >
                        {copiedId === 'modal' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Duration / Latency:</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200">
                    {formatDuration(selectedLog.duration_ms) || 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Message
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed select-text">
                  {selectedLog.message}
                </div>
              </div>

              {(selectedLog.details_json || selectedLog.payload || selectedLog.details) && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Sanitized Payload & Metadata
                  </label>
                  <pre className="p-3 rounded-xl bg-slate-950 text-indigo-300 font-mono text-[11px] overflow-x-auto select-text border border-slate-800">
                    {(() => {
                      try {
                        const raw = selectedLog.details_json || selectedLog.payload || selectedLog.details;
                        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        return JSON.stringify(parsed, null, 2);
                      } catch {
                        return String(selectedLog.details_json || selectedLog.payload || selectedLog.details);
                      }
                    })()}
                  </pre>
                </div>
              )}

              {selectedLog.error_stack && (
                <div>
                  <label className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider block mb-1">
                    Error Stack Trace
                  </label>
                  <pre className="p-3 rounded-xl bg-slate-950 text-rose-300 font-mono text-[11px] overflow-x-auto select-text border border-rose-950">
                    {selectedLog.error_stack}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end flex-shrink-0">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Clear All System Logs?</h3>
                <p className="text-xs text-slate-500">This will empty the `system_logs` table.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete all historical logs? This action will permanently remove log events from the local database.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLogs}
                disabled={clearing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition"
              >
                {clearing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Yes, Clear All Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}