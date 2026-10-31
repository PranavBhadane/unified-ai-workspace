import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Download,
  Trash2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  User,
  ExternalLink,
  X,
  Layers,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';

const REPORT_TEMPLATES = [
  {
    id: 'contact_profile',
    title: 'Contact Profile Dossier',
    desc: 'Executive identity summary, cross-channel communication timeline, verified facts vs stated preferences, and action items.',
    category: 'Relationship',
    badge: 'Dossier'
  },
  {
    id: 'client_relationship',
    title: 'Client Relationship Analysis',
    desc: 'Historical engagement patterns, project deals, mutual commitments, sentiment health, and strategic recommendations.',
    category: 'Account',
    badge: 'Strategic'
  },
  {
    id: 'communication_history',
    title: 'Communication History Audit',
    desc: 'Chronological multi-channel message log with exact record citations, response frequencies, and unresolved queries.',
    category: 'Audit',
    badge: 'Timeline'
  },
  {
    id: 'business_activity',
    title: 'Business & Operational Activity Log',
    desc: 'Deliverables exchanged, active operational milestones, quotations, and pending administrative decisions.',
    category: 'Operations',
    badge: 'Operational'
  },
  {
    id: 'payment_transaction',
    title: 'Financial & Payment Reference',
    desc: 'Financial audit of all rental amounts, bank transfers, quotations, invoice references, and outstanding balances.',
    category: 'Finance',
    badge: 'Financial'
  },
  {
    id: 'pending_commitments',
    title: 'Pending Commitments & Action Items',
    desc: 'Actionable audit of explicit promises made by you or the contact, deadline tracking, and urgency classifications.',
    category: 'Compliance',
    badge: 'Action Items'
  },
  {
    id: 'document_summary',
    title: 'Document & Contract Summary',
    desc: 'Cross-platform synthesis of Drive agreements, resumes, spreadsheets, attachments, and version audit trails.',
    category: 'Legal',
    badge: 'Contracts'
  },
  {
    id: 'meeting_discussion',
    title: 'Meeting & Discussion Digest',
    desc: 'Structured meeting and call notes, agreed decisions, speaker highlights, and follow-up responsibilities.',
    category: 'Meetings',
    badge: 'Digest'
  },
  {
    id: 'custom_ai_report',
    title: 'Custom AI Intelligence Dossier',
    desc: 'Ad-hoc multi-source synthesis tailored directly by your custom natural language instruction prompt.',
    category: 'Ad-Hoc',
    badge: 'Custom'
  }
];

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');

  // Generation Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('contact_profile');
  const [topic, setTopic] = useState('');
  const [contactId, setContactId] = useState('');
  const [format, setFormat] = useState('pdf');
  const [provider, setProvider] = useState('gemini');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgressText, setGenProgressText] = useState('');

  // Contacts list for dropdown
  const [contacts, setContacts] = useState([]);

  // Report Reader Modal State
  const [activeReport, setActiveReport] = useState(null);
  const [readingReport, setReadingReport] = useState(false);

  useEffect(() => {
    loadReports();
    loadContacts();
  }, [selectedFormat, searchQuery]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedFormat !== 'all') params.append('format', selectedFormat);
      const res = await api.getReports(`?${params.toString()}`);
      if (res.success) {
        setReports(res.reports);
      }
    } catch (err) {
      console.warn('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await api.getEntities();
      if (res.success && res.entities) {
        setContacts(res.entities);
      }
    } catch {}
  };

  const handleStartGeneration = (templateId = 'contact_profile', targetName = '') => {
    setSelectedTemplate(templateId);
    if (targetName) setTopic(targetName);
    setShowGenerateModal(true);
  };

  const handleSubmitGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setGenProgressText('Gathering cross-channel records from WhatsApp, Gmail, Drive...');

    try {
      setTimeout(() => {
        setGenProgressText('Analyzing factual evidence and classifying statements...');
      }, 4000);

      setTimeout(() => {
        setGenProgressText(`Synthesizing intelligence report with AI & generating ${format.toUpperCase()} export...`);
      }, 10000);

      const res = await api.generateReport({
        templateType: selectedTemplate,
        contactId: contactId ? parseInt(contactId, 10) : null,
        topic: topic.trim(),
        format,
        provider,
        customPrompt: customPrompt.trim()
      });

      if (res.success && res.report) {
        setShowGenerateModal(false);
        setTopic('');
        setCustomPrompt('');
        loadReports();
        // Immediately view the newly generated report
        handleViewReport(res.report.id);
      } else {
        alert(res.error || 'Report generation failed');
      }
    } catch (err) {
      alert(err.message || 'Error generating report');
    } finally {
      setGenerating(false);
      setGenProgressText('');
    }
  };

  const handleViewReport = async (id) => {
    setReadingReport(true);
    try {
      const res = await api.getReport(id);
      if (res.success) {
        setActiveReport(res.report);
      }
    } catch (err) {
      alert('Failed to load report content: ' + err.message);
    } finally {
      setReadingReport(false);
    }
  };

  const handleDeleteReport = async (id) => {
    if (!window.confirm('Are you sure you want to delete this generated report?')) return;
    try {
      const res = await api.deleteReport(id);
      if (res.success) {
        setReports(reports.filter(r => r.id !== id));
        if (activeReport?.id === id) setActiveReport(null);
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getFormatBadge = (fmt = 'pdf') => {
    switch (fmt.toLowerCase()) {
      case 'docx':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 uppercase">DOCX</span>;
      case 'xlsx':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 uppercase">XLSX</span>;
      case 'csv':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 uppercase">CSV</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 uppercase">PDF</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            AI Report & Dossier Generation Engine
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Synthesize multi-channel workspace data into professional dossiers with verified citations and multi-format exports.
          </p>
        </div>

        <button
          onClick={() => handleStartGeneration('contact_profile')}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          Generate New Report
        </button>
      </div>

      {/* 9 Standard Report Templates Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Standard Dossier Templates (9 Categories)
          </h3>
          <span className="text-[11px] text-slate-400">Select any template to build</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REPORT_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-600 transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
                    {tmpl.badge}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{tmpl.category}</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  {tmpl.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {tmpl.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  Audit-Grade
                </span>
                <button
                  onClick={() => handleStartGeneration(tmpl.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition text-xs font-semibold flex items-center gap-1"
                >
                  Configure
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Reports Archive Section */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Generated Reports Archive
            </h3>
            <p className="text-xs text-slate-500">Inspect, preview, and download your synthesized dossiers.</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative max-w-xs w-full">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search archive..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Format Filter */}
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="all">All Formats</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word (DOCX)</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="csv">CSV</option>
            </select>

            <button
              onClick={loadReports}
              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-indigo-600 transition"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Reports Archive Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-6">Report Title</th>
                <th className="py-3 px-4">Template Type</th>
                <th className="py-3 px-4">Target Subject</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-500 mb-1" />
                    Loading reports archive...
                  </td>
                </tr>
              ) : reports.length > 0 ? (
                reports.map((rpt) => (
                  <tr key={rpt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white truncate max-w-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{rpt.title}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 capitalize">
                      {rpt.reportType?.replace(/_/g, ' ') || 'General'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      {rpt.contactName || 'Workspace Subject'}
                    </td>

                    <td className="py-3.5 px-4">
                      {getFormatBadge(rpt.format)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {formatSize(rpt.fileSizeBytes)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(rpt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewReport(rpt.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition flex items-center gap-1 font-semibold text-[11px]"
                          title="Read full synthesized report"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>

                        <a
                          href={api.getReportDownloadUrl(rpt.id)}
                          download
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                          title={`Download ${rpt.format.toUpperCase()} file`}
                        >
                          <Download className="h-4 w-4" />
                        </a>

                        <button
                          onClick={() => handleDeleteReport(rpt.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Delete report"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Sparkles className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    No reports generated yet. Click "Generate New Report" or pick a template above to generate your first dossier.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generation Form Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="p-5 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Configure & Generate AI Intelligence Report
                </h3>
              </div>
              <button
                onClick={() => !generating && setShowGenerateModal(false)}
                disabled={generating}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGenerate} className="p-6 space-y-4">
              {/* Template Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Report Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  disabled={generating}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium outline-none"
                >
                  {REPORT_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.badge})</option>
                  ))}
                </select>
              </div>

              {/* Target Contact / Subject */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Contact / Entity (Optional)
                  </label>
                  <select
                    value={contactId}
                    onChange={(e) => {
                      setContactId(e.target.value);
                      const found = contacts.find(c => String(c.id) === e.target.value);
                      if (found) setTopic(found.primary_name || found.display_name || '');
                    }}
                    disabled={generating}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                  >
                    <option value="">-- Choose from Contacts --</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.primary_name || c.display_name} ({c.company_name || 'Individual'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Topic / Subject Name
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Imran Pathan, Rahul, Expenses, Rental..."
                    disabled={generating}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Format & AI Provider */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Export Output Format
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'pdf', label: 'PDF' },
                      { id: 'docx', label: 'DOCX' },
                      { id: 'xlsx', label: 'XLSX' },
                      { id: 'csv', label: 'CSV' }
                    ].map(f => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setFormat(f.id)}
                        disabled={generating}
                        className={`py-2 rounded-xl text-xs font-bold border transition ${
                          format === f.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    AI Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    disabled={generating}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                  >
                    <option value="gemini">Google Gemini (Active)</option>
                    <option value="openai">OpenAI ChatGPT</option>
                    <option value="anthropic">Anthropic Claude</option>
                  </select>
                </div>
              </div>

              {/* Custom Guidance Prompt */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Guidance or Specific Questions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Focus on all discussions related to equipment rental rates and payment commitments made in June 2026..."
                  disabled={generating}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none resize-none"
                />
              </div>

              {/* Live Progress Bar when generating */}
              {generating && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>AI Synthesis in Progress</span>
                  </div>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">{genProgressText}</p>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={generating}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Sparkles className="h-4 w-4" />
                  {generating ? 'Synthesizing...' : `Generate ${format.toUpperCase()} Report`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Report Viewer Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 truncate max-w-xl">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {activeReport.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getFormatBadge(activeReport.format)}
                    <span className="text-[11px] text-slate-400">
                      Generated: {new Date(activeReport.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={api.getReportDownloadUrl(activeReport.id)}
                  download
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download {activeReport.format.toUpperCase()}
                </a>

                <button
                  onClick={() => setActiveReport(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full bg-white dark:bg-slate-900 my-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <pre className="font-sans text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                {activeReport.markdown}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
