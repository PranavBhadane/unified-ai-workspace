import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Sparkles,
  MessageSquare,
  Mail,
  HardDrive,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  X
} from 'lucide-react';
import api from '../services/api';

export default function ClientsPage() {
  const [entities, setEntities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityProfile, setEntityProfile] = useState(null);
  const [entityTimeline, setEntityTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [correlating, setCorrelating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'timeline' | 'financial' | 'commitments'
  const navigate = useNavigate();

  useEffect(() => {
    loadEntities();
  }, [searchQuery]);

  const loadEntities = async () => {
    try {
      const data = await api.getEntities(searchQuery);
      if (data.success) {
        setEntities(data.entities);
      }
    } catch (e) {
      console.warn('Failed to load entities:', e);
    }
  };

  const handleSelectEntity = async (entity) => {
    setSelectedEntity(entity);
    setLoading(true);
    setActiveTab('overview');
    try {
      const [profileRes, timelineRes] = await Promise.all([
        api.getEntity(entity.id),
        api.getEntityTimeline(entity.id)
      ]);
      if (profileRes.success) setEntityProfile(profileRes.profile);
      if (timelineRes.success) setEntityTimeline(timelineRes.timeline.events || []);
    } catch (e) {
      console.error('Failed to load entity details:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCorrelate = async () => {
    setCorrelating(true);
    try {
      const res = await api.triggerCorrelation();
      alert(`Cross-platform resolution complete. Correlated ${res.result?.resolvedCount || 0} contacts.`);
      loadEntities();
    } catch (e) {
      alert(`Correlation failed: ${e.message}`);
    } finally {
      setCorrelating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Clients & Entity Intelligence
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Resolved identities correlated across WhatsApp, Gmail, and Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoCorrelate}
            disabled={correlating}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center gap-2 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${correlating ? 'animate-spin' : ''}`} />
            Auto-Correlate Entities
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter clients by name, email, company, or phone..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.length > 0 ? (
          entities.map((e) => (
            <div
              key={e.id}
              onClick={() => handleSelectEntity(e)}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate pr-2">
                    {e.primary_name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 capitalize">
                    {e.entity_type}
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  {e.company_name && <p className="truncate">🏢 {e.company_name}</p>}
                  {e.email && <p className="truncate font-mono text-[11px]">✉️ {e.email}</p>}
                  {e.phone && <p className="truncate font-mono text-[11px]">📞 {e.phone}</p>}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                <span>View Cross-Platform Dossier</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            No clients or entities found. Connect WhatsApp or Gmail and sync to discover contacts.
          </div>
        )}
      </div>

      {/* Detail Modal / Drawer */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {selectedEntity.primary_name[0]}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {selectedEntity.primary_name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedEntity.email || selectedEntity.phone || 'Connected Client'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/reports`)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition"
                  title="Generate Dossier / Report"
                >
                  <FileText className="h-3.5 w-3.5 text-indigo-500" />
                  Generate Report
                </button>
                <button
                  onClick={() => navigate(`/dashboards`)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition"
                  title="View Intelligent Dashboard"
                >
                  <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                  Dashboard
                </button>
                <button
                  onClick={() => navigate(`/ai?q=Give me all details about client ${encodeURIComponent(selectedEntity.primary_name)}`)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 flex items-center gap-1.5 transition shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ask AI
                </button>
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-6 text-xs font-semibold">
              {[
                { id: 'overview', label: 'Cross-Platform Overview' },
                { id: 'timeline', label: `Chronological Timeline (${entityTimeline.length})` },
                { id: 'financial', label: 'Financial References' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 border-b-2 transition ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                  Retrieving client records across platforms...
                </div>
              ) : activeTab === 'overview' ? (
                <div className="space-y-6">
                  {/* Summary metric cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs">
                      <p className="font-semibold">WhatsApp Messages</p>
                      <p className="text-xl font-bold mt-1">{entityProfile?.whatsappMessages?.length || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/40 text-blue-900 dark:text-blue-200 text-xs">
                      <p className="font-semibold">Gmail Emails</p>
                      <p className="text-xl font-bold mt-1">{entityProfile?.emails?.length || 0}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs">
                      <p className="font-semibold">Drive Documents</p>
                      <p className="text-xl font-bold mt-1">{entityProfile?.driveFiles?.length || 0}</p>
                    </div>
                  </div>

                  {/* WhatsApp section */}
                  {entityProfile?.whatsappMessages && entityProfile.whatsappMessages.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Activity
                      </h4>
                      <div className="space-y-2">
                        {entityProfile.whatsappMessages.slice(0, 4).map((m, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs flex justify-between">
                            <span className="text-slate-700 dark:text-slate-300">{m.text_content || m.caption || `[${m.message_type}]`}</span>
                            <span className="text-[10px] text-slate-400 ml-4 flex-shrink-0">{new Date(Number(m.timestamp)).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gmail section */}
                  {entityProfile?.emails && entityProfile.emails.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-blue-500" /> Gmail Correspondence
                      </h4>
                      <div className="space-y-2">
                        {entityProfile.emails.slice(0, 4).map((e, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs flex justify-between">
                            <div className="truncate pr-4">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{e.subject}</p>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{e.snippet}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{new Date(Number(e.internal_date)).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'timeline' ? (
                <div className="space-y-4">
                  {entityTimeline.length > 0 ? (
                    entityTimeline.map((item, idx) => (
                      <div key={idx} className="flex gap-4 items-start text-xs">
                        <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0"></div>
                        <div className="flex-1 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">{item.title}</span>
                            <span className="text-[10px] text-slate-400">{new Date(item.date).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-8 text-center">No timeline events recorded.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {entityProfile?.financialHighlights && entityProfile.financialHighlights.length > 0 ? (
                    entityProfile.financialHighlights.map((f, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{f.source}</span>
                          <span className="text-[10px] text-slate-400">{new Date(f.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 italic">"{f.context}"</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-8 text-center">No financial or payment references recorded for this client.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
