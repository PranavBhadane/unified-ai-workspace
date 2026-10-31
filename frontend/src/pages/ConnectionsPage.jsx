import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Mail,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import api from '../services/api';
import socketService from '../services/socket';

export default function ConnectionsPage() {
  const [searchParams] = useSearchParams();
  const [connectors, setConnectors] = useState([]);
  const [whatsappQr, setWhatsappQr] = useState(null);
  const [loadingPlatform, setLoadingPlatform] = useState(null);
  const [bannerNotice, setBannerNotice] = useState(null);

  useEffect(() => {
    loadConnections();
    loadWhatsAppQr();

    if (searchParams.get('success')) {
      setBannerNotice({ type: 'success', text: 'Google account connected and authorized successfully!' });
    } else if (searchParams.get('error')) {
      setBannerNotice({ type: 'error', text: `Connection error: ${searchParams.get('error')}` });
    }

    const handleWaQr = (data) => {
      setWhatsappQr(data.qr);
    };

    const handleWaStatus = (data) => {
      loadConnections();
      if (data.status === 'connected') {
        setWhatsappQr(null);
      }
    };

    socketService.on('whatsapp:qr', handleWaQr);
    socketService.on('whatsapp:status', handleWaStatus);
    socketService.on('sync:status', loadConnections);

    return () => {
      socketService.off('whatsapp:qr', handleWaQr);
      socketService.off('whatsapp:status', handleWaStatus);
      socketService.off('sync:status', loadConnections);
    };
  }, [searchParams]);

  const loadConnections = async () => {
    try {
      const data = await api.getConnections();
      if (data.success) {
        setConnectors(data.connectors);
      }
    } catch (e) {
      console.warn('Failed to load connections:', e);
    }
  };

  const loadWhatsAppQr = async () => {
    try {
      const data = await api.getWhatsAppQr();
      if (data.success && data.qr) {
        setWhatsappQr(data.qr);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleConnect = async (platform) => {
    setLoadingPlatform(platform);
    try {
      const res = await api.connectPlatform(platform);
      if (platform === 'whatsapp') {
        // Socket will broadcast QR
        loadWhatsAppQr();
      } else if (res.authUrl) {
        // Redirect to Google OAuth consent screen
        window.location.href = res.authUrl;
      }
    } catch (err) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleDisconnect = async (platform) => {
    if (!confirm(`Are you sure you want to disconnect ${platform}? Local records will remain intact.`)) {
      return;
    }
    try {
      await api.disconnectPlatform(platform);
      loadConnections();
      if (platform === 'whatsapp') setWhatsappQr(null);
    } catch (err) {
      alert(`Disconnect failed: ${err.message}`);
    }
  };

  const handleSyncNow = async (platform) => {
    try {
      await api.startSync(platform);
      alert(`Synchronization started for ${platform}. Check the Synchronization tab for live progress.`);
      loadConnections();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Data Connectors
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Connect your personal WhatsApp, Gmail, and Google Drive accounts. Data is indexed locally on your computer.
        </p>
      </div>

      {bannerNotice && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
          bannerNotice.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        }`}>
          <span>{bannerNotice.text}</span>
          <button onClick={() => setBannerNotice(null)} className="p-1 hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* WhatsApp Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              {connectors.find(c => c.platform === 'whatsapp')?.status === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Disconnected
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">WhatsApp</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Sync chats, contacts, voice notes, and PDF attachments via WhatsApp Web Linked Devices.
              </p>
            </div>

            {/* QR Code Stream */}
            {whatsappQr && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Scan with WhatsApp &gt; Linked Devices
                </p>
                <img
                  src={whatsappQr}
                  alt="WhatsApp QR Code"
                  className="mx-auto h-44 w-44 rounded-lg bg-white p-2 shadow-xs"
                />
                <p className="text-[11px] text-slate-400">Auto-refreshes every few seconds</p>
              </div>
            )}

            {connectors.find(c => c.platform === 'whatsapp')?.account && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {connectors.find(c => c.platform === 'whatsapp')?.account.account_name}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  +{connectors.find(c => c.platform === 'whatsapp')?.account.account_identifier}
                </p>
                <p className="text-[10px] text-slate-400 pt-1">
                  Last Sync: {connectors.find(c => c.platform === 'whatsapp')?.account.last_sync_at ? new Date(connectors.find(c => c.platform === 'whatsapp')?.account.last_sync_at).toLocaleString() : 'Never'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {connectors.find(c => c.platform === 'whatsapp')?.status === 'connected' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSyncNow('whatsapp')}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync
                </button>
                <button
                  onClick={() => handleDisconnect('whatsapp')}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition"
                  title="Disconnect"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect('whatsapp')}
                disabled={loadingPlatform === 'whatsapp'}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-sm"
              >
                {loadingPlatform === 'whatsapp' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Show QR Code
              </button>
            )}
          </div>
        </div>

        {/* Gmail Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              {connectors.find(c => c.platform === 'gmail')?.status === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Disconnected
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Gmail</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Connect via official Google OAuth 2.0 with read-only permissions to index threads, invoices, and contracts.
              </p>
            </div>

            {connectors.find(c => c.platform === 'gmail')?.account && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {connectors.find(c => c.platform === 'gmail')?.account.account_name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {connectors.find(c => c.platform === 'gmail')?.account.account_identifier}
                </p>
                <p className="text-[10px] text-slate-400 pt-1">
                  Last Sync: {connectors.find(c => c.platform === 'gmail')?.account.last_sync_at ? new Date(connectors.find(c => c.platform === 'gmail')?.account.last_sync_at).toLocaleString() : 'Never'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {connectors.find(c => c.platform === 'gmail')?.status === 'connected' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSyncNow('gmail')}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync
                </button>
                <button
                  onClick={() => handleDisconnect('gmail')}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition"
                  title="Disconnect"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect('gmail')}
                disabled={loadingPlatform === 'gmail'}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-sm"
              >
                {loadingPlatform === 'gmail' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Connect Gmail
              </button>
            )}
          </div>
        </div>

        {/* Google Drive Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <HardDrive className="h-5 w-5" />
              </div>
              {connectors.find(c => c.platform === 'drive')?.status === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Disconnected
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Google Drive</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Index PDF agreements, spreadsheets, DOCX quotes, and native Google Docs with full-text chunk search.
              </p>
            </div>

            {connectors.find(c => c.platform === 'drive')?.account && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {connectors.find(c => c.platform === 'drive')?.account.account_name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {connectors.find(c => c.platform === 'drive')?.account.account_identifier}
                </p>
                <p className="text-[10px] text-slate-400 pt-1">
                  Last Sync: {connectors.find(c => c.platform === 'drive')?.account.last_sync_at ? new Date(connectors.find(c => c.platform === 'drive')?.account.last_sync_at).toLocaleString() : 'Never'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {connectors.find(c => c.platform === 'drive')?.status === 'connected' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSyncNow('drive')}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync
                </button>
                <button
                  onClick={() => handleDisconnect('drive')}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition"
                  title="Disconnect"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect('drive')}
                disabled={loadingPlatform === 'drive'}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-sm"
              >
                {loadingPlatform === 'drive' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Connect Google Drive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
