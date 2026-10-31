import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  ExternalLink,
  HardDrive,
  Download,
  Filter,
  Eye,
  X,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  FolderArchive,
  Calendar,
  Layers,
  ArrowUpDown,
  Check,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedFileType, setSelectedFileType] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [loading, setLoading] = useState(false);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [searchQuery, selectedSource, selectedFileType, sortBy]);

  const loadStats = async () => {
    try {
      const data = await api.getDocumentStats();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      console.warn('Failed to load document stats:', e);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        q: searchQuery,
        source: selectedSource,
        fileType: selectedFileType,
        sortBy
      });
      const data = await api.getDocuments(`?${queryParams.toString()}`);
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.warn('Failed to load documents:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreview = async (doc) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const data = await api.getDocumentPreview(doc.id);
      if (data.success) {
        setPreviewData(data);
        if (data.type === 'spreadsheet' && data.sheetNames?.length > 0) {
          setActiveSheet(data.sheetNames[0]);
        }
      } else {
        setPreviewData({ error: data.error || 'Failed to load document preview' });
      }
    } catch (err) {
      setPreviewData({ error: err.message || 'Error generating document preview' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getDocIcon = (type = '', mime = '') => {
    switch (type) {
      case 'spreadsheet':
        return <FileSpreadsheet className="h-5 w-5 text-emerald-500 shrink-0" />;
      case 'docx':
        return <FileText className="h-5 w-5 text-blue-500 shrink-0" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-rose-500 shrink-0" />;
      case 'image':
        return <ImageIcon className="h-5 w-5 text-purple-500 shrink-0" />;
      case 'archive':
        return <FolderArchive className="h-5 w-5 text-amber-500 shrink-0" />;
      case 'text':
        return <FileCode className="h-5 w-5 text-slate-500 shrink-0" />;
      default:
        return <FileText className="h-5 w-5 text-indigo-500 shrink-0" />;
    }
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case 'drive':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
            <HardDrive className="h-3 w-3" />
            Google Drive
          </span>
        );
      case 'gmail':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
            Gmail Attachment
          </span>
        );
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
            WhatsApp Media
          </span>
        );
      case 'report':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
            <Sparkles className="h-3 w-3" />
            AI Dossier
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-mono text-slate-500 capitalize">
            {source}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-500" />
            Unified Document Library & Explorer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Search, inspect, preview, and download spreadsheets, agreements, PDFs, and AI dossiers across connected sources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative max-w-sm w-full">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by name or phrase..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            onClick={() => { loadDocuments(); loadStats(); }}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition"
            title="Refresh documents list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Indexed Documents</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.totalCount || documents.length}</p>
            <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
              {formatSize(stats?.totalBytes)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Google Drive Files</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.bySource?.drive?.count || 0}</p>
            <span className="text-xs font-mono text-slate-400">
              {formatSize(stats?.bySource?.drive?.bytes)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Gmail Attachments</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats?.bySource?.gmail?.count || 0}</p>
            <span className="text-xs font-mono text-slate-400">
              {formatSize(stats?.bySource?.gmail?.bytes)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">AI Generated Reports</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats?.bySource?.reports?.count || 0}</p>
            <span className="text-xs text-slate-400">Multi-format Dossiers</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
        {/* Source Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">Source:</span>
          {[
            { id: 'all', label: 'All Sources' },
            { id: 'drive', label: 'Google Drive' },
            { id: 'gmail', label: 'Gmail' },
            { id: 'whatsapp', label: 'WhatsApp' },
            { id: 'report', label: 'AI Reports' }
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSource(s.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedSource === s.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-indigo-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* File Type Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">Format:</span>
          {[
            { id: 'all', label: 'All Types' },
            { id: 'spreadsheet', label: 'Spreadsheets' },
            { id: 'pdf', label: 'PDFs' },
            { id: 'docx', label: 'Word (DOCX)' },
            { id: 'image', label: 'Images' },
            { id: 'text', label: 'Text/Code' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedFileType(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                selectedFileType === t.id
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800/80 text-slate-500 border border-slate-200 dark:border-slate-700/80 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-6">Document Name</th>
              <th className="py-3 px-4">Source Platform</th>
              <th className="py-3 px-4">Owner / Context</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Modified / Created</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                  Loading document catalog...
                </td>
              </tr>
            ) : documents.length > 0 ? (
              documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  {/* Name */}
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-3">
                      {getDocIcon(doc.fileType, doc.mimeType)}
                      <div className="truncate max-w-sm">
                        <span className="font-semibold text-slate-900 dark:text-white truncate block">
                          {doc.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono truncate block">
                          {doc.mimeType}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Source */}
                  <td className="py-3.5 px-4">
                    {getSourceBadge(doc.source)}
                  </td>

                  {/* Context / Contact */}
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                    {doc.associatedContact || doc.contextTitle || 'Workspace'}
                  </td>

                  {/* Size */}
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {formatSize(doc.sizeBytes)}
                  </td>

                  {/* Modified */}
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                    {doc.timestamp ? new Date(doc.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* In-App Preview Button */}
                      <button
                        onClick={() => handleOpenPreview(doc)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition flex items-center gap-1 font-semibold text-[11px]"
                        title="Interactive In-App Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>

                      {/* Download Button */}
                      <a
                        href={api.getDocumentDownloadUrl(doc.id)}
                        download
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                        title="Download Document"
                      >
                        <Download className="h-4 w-4" />
                      </a>

                      {/* External Web Link */}
                      {doc.webLink && (
                        <a
                          href={doc.webLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                          title="Open Original Cloud Document"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <FileText className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  No documents found matching the filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* In-App Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 truncate max-w-xl">
                {getDocIcon(previewDoc.fileType, previewDoc.mimeType)}
                <div className="truncate">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {previewDoc.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getSourceBadge(previewDoc.source)}
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatSize(previewDoc.sizeBytes)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={api.getDocumentDownloadUrl(previewDoc.id)}
                  download
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>

                {previewDoc.webLink && (
                  <a
                    href={previewDoc.webLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Original
                  </a>
                )}

                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30 dark:bg-slate-950/40">
              {previewLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-semibold">Generating high-fidelity document preview...</p>
                </div>
              ) : previewData?.error ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-3">
                  <AlertCircle className="h-10 w-10 text-amber-500" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Local Preview Unavailable</h4>
                  <p className="text-xs text-slate-500">{previewData.error}</p>
                  {previewDoc.webLink && (
                    <a
                      href={previewDoc.webLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
                    >
                      View on Google Drive
                    </a>
                  )}
                </div>
              ) : previewData?.type === 'spreadsheet' ? (
                /* Interactive Spreadsheet Viewer */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Sheet Tabs */}
                  {previewData.sheetNames?.length > 1 && (
                    <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto shrink-0">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase mr-2 shrink-0">Sheets:</span>
                      {previewData.sheetNames.map((sheetName) => (
                        <button
                          key={sheetName}
                          onClick={() => setActiveSheet(sheetName)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition ${
                            activeSheet === sheetName
                              ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800'
                              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {sheetName}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Spreadsheet Grid */}
                  <div className="flex-1 overflow-auto p-4">
                    {previewData.sheets?.[activeSheet]?.previewRows?.length > 0 ? (
                      <div className="inline-block min-w-full align-middle border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                          {/* First row as header if present */}
                          <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0">
                            <tr>
                              <th className="py-2 px-3 text-slate-400 font-mono text-[10px] w-12 text-center border-r border-slate-200 dark:border-slate-700">#</th>
                              {previewData.sheets[activeSheet].previewRows[0].map((col, idx) => (
                                <th key={idx} className="py-2 px-3 text-left font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 truncate max-w-xs">
                                  {String(col !== undefined && col !== null ? col : `Col ${idx + 1}`)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                            {previewData.sheets[activeSheet].previewRows.slice(1).map((row, rowIdx) => (
                              <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-1.5 px-3 text-slate-400 text-center bg-slate-50/50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-[10px]">
                                  {rowIdx + 2}
                                </td>
                                {previewData.sheets[activeSheet].previewRows[0].map((_, colIdx) => (
                                  <td key={colIdx} className="py-1.5 px-3 text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 truncate max-w-xs">
                                    {row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="p-8 text-center text-slate-400 text-xs">This sheet contains no tabular data.</p>
                    )}
                  </div>
                </div>
              ) : previewData?.type === 'docx' ? (
                /* Word Document Render (Mammoth HTML) */
                <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full bg-white dark:bg-slate-900 my-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <div
                    className="prose dark:prose-invert max-w-none text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewData.html }}
                  />
                </div>
              ) : previewData?.type === 'markdown' ? (
                /* Markdown Preview (Reports) */
                <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full bg-white dark:bg-slate-900 my-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <pre className="font-sans text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                    {previewData.markdown}
                  </pre>
                </div>
              ) : previewData?.type === 'pdf' ? (
                /* PDF Preview with text excerpt & stream embed */
                <div className="flex-1 overflow-hidden flex flex-col">
                  {previewData.streamUrl ? (
                    <iframe
                      src={previewData.streamUrl}
                      className="w-full flex-1 border-0"
                      title="PDF Stream"
                    />
                  ) : (
                    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full bg-white dark:bg-slate-900 my-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                      <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
                        <span>Extracted Document Text ({previewData.pageCount || 1} Pages)</span>
                        <a href={api.getDocumentDownloadUrl(previewDoc.id)} download className="text-indigo-600 font-semibold hover:underline">
                          Download Original PDF
                        </a>
                      </div>
                      <pre className="font-sans text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                        {previewData.textSample}
                      </pre>
                    </div>
                  )}
                </div>
              ) : previewData?.type === 'image' ? (
                /* Image Preview */
                <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
                  <img
                    src={previewData.streamUrl}
                    alt={previewDoc.name}
                    className="max-h-full max-w-full rounded-2xl object-contain shadow-lg"
                  />
                </div>
              ) : (
                /* Plain Text / Code */
                <div className="flex-1 overflow-auto p-6 font-mono text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 m-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {previewData?.content || 'No text content available for this file type.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
