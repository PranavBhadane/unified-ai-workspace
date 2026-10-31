import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Sparkles,
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  HardDrive,
  Info,
  ExternalLink,
  Cpu,
  Zap,
  HelpCircle,
  Trash2,
  RotateCcw,
  Check,
  Search,
  Filter
} from 'lucide-react';
import api from '../services/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [syncInterval, setSyncInterval] = useState('60');
  const [autoSync, setAutoSync] = useState(false);
  const [allowedSources, setAllowedSources] = useState(['whatsapp', 'gmail', 'drive']);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalStatus, setGeneralStatus] = useState(null);

  // Multi-Provider AI State
  const [providers, setProviders] = useState([]);
  const [activeProviderTab, setActiveProviderTab] = useState('gemini');
  const [providerKeyInputs, setProviderKeyInputs] = useState({ gemini: '', openai: '', anthropic: '' });
  const [providerModels, setProviderModels] = useState({ gemini: [], openai: [], anthropic: [] });
  const [loadingModels, setLoadingModels] = useState({ gemini: false, openai: false, anthropic: false });
  const [modelSearch, setModelSearch] = useState('');
  const [testingProvider, setTestingProvider] = useState({ gemini: false, openai: false, anthropic: false });
  const [testResults, setTestResults] = useState({});
  const [savingProvider, setSavingProvider] = useState({});
  const [selectedModels, setSelectedModels] = useState({
    gemini: 'gemini-3.1-flash-lite',
    openai: 'gpt-4o',
    anthropic: 'claude-3-7-sonnet-20250219'
  });
  const [defaultProvider, setDefaultProvider] = useState('gemini');

  useEffect(() => {
    loadSettings();
    loadProviders();
  }, []);

  useEffect(() => {
    if (activeProviderTab) {
      loadModelsForProvider(activeProviderTab);
    }
  }, [activeProviderTab]);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      if (data.success) {
        setSettings(data.settings);
        if (data.settings.sync_interval_mins) setSyncInterval(data.settings.sync_interval_mins);
        if (data.settings.auto_sync_enabled !== undefined) {
          setAutoSync(data.settings.auto_sync_enabled === 'true' || data.settings.auto_sync_enabled === true);
        }
        if (Array.isArray(data.settings.ai_allowed_sources)) setAllowedSources(data.settings.ai_allowed_sources);
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  const loadProviders = async () => {
    try {
      const data = await api.getAiProviders();
      if (data.success) {
        setProviders(data.providers);
        setDefaultProvider(data.defaultProvider || 'gemini');
        const modelMap = {};
        data.providers.forEach(p => {
          if (p.defaultModel) {
            modelMap[p.provider] = p.defaultModel;
          }
        });
        setSelectedModels(prev => ({ ...prev, ...modelMap }));
      }
    } catch (err) {
      console.warn('Failed to load AI providers:', err);
    }
  };

  const loadModelsForProvider = async (provider) => {
    setLoadingModels(prev => ({ ...prev, [provider]: true }));
    try {
      const res = await api.getModels(provider);
      if (res.success && Array.isArray(res.models)) {
        setProviderModels(prev => ({ ...prev, [provider]: res.models }));
        if (res.currentModel) {
          setSelectedModels(prev => ({ ...prev, [provider]: res.currentModel }));
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch models for ${provider}:`, err);
    } finally {
      setLoadingModels(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleSaveProvider = async (provider) => {
    setSavingProvider(prev => ({ ...prev, [provider]: true }));
    setTestResults(prev => ({ ...prev, [provider]: null }));
    try {
      const payload = {
        provider,
        defaultModel: selectedModels[provider]
      };
      if (providerKeyInputs[provider]?.trim()) {
        payload.apiKey = providerKeyInputs[provider].trim();
      }

      const res = await api.saveAiProvider(payload);
      if (res.success) {
        setProviderKeyInputs(prev => ({ ...prev, [provider]: '' }));
        await loadProviders();
        await loadModelsForProvider(provider);
        setTestResults(prev => ({
          ...prev,
          [provider]: { success: true, reply: `${provider.toUpperCase()} configuration saved successfully!` }
        }));
      }
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [provider]: { success: false, error: `Save failed: ${err.message}` }
      }));
    } finally {
      setSavingProvider(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleTestProvider = async (provider) => {
    setTestingProvider(prev => ({ ...prev, [provider]: true }));
    setTestResults(prev => ({ ...prev, [provider]: null }));
    try {
      const res = await api.testAiProvider(provider, selectedModels[provider]);
      setTestResults(prev => ({ ...prev, [provider]: res }));
      await loadProviders();
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [provider]: { success: false, error: err.message }
      }));
    } finally {
      setTestingProvider(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleRemoveProvider = async (provider) => {
    const pMeta = providers.find(p => p.provider === provider);
    if (!window.confirm(`Are you sure you want to remove the API configuration for ${pMeta?.name || provider}?`)) {
      return;
    }
    try {
      const res = await api.removeAiProvider(provider);
      if (res.success) {
        setProviderKeyInputs(prev => ({ ...prev, [provider]: '' }));
        await loadProviders();
        await loadModelsForProvider(provider);
        setTestResults(prev => ({
          ...prev,
          [provider]: { success: true, reply: 'Configuration removed.' }
        }));
      }
    } catch (err) {
      alert(`Failed to remove configuration: ${err.message}`);
    }
  };

  const handleSetDefaultProvider = async (provider) => {
    try {
      await api.setDefaultAiProvider(provider);
      setDefaultProvider(provider);
      await loadProviders();
    } catch (err) {
      alert(`Failed to set default provider: ${err.message}`);
    }
  };

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSavingGeneral(true);
    setGeneralStatus(null);
    try {
      const res = await api.updateSettings({
        syncIntervalMins: syncInterval,
        autoSyncEnabled: autoSync,
        allowedSources
      });
      if (res.success) {
        setGeneralStatus({ type: 'success', text: 'General preferences saved successfully!' });
        loadSettings();
      }
    } catch (err) {
      setGeneralStatus({ type: 'error', text: `Failed to save preferences: ${err.message}` });
    } finally {
      setSavingGeneral(false);
      setTimeout(() => setGeneralStatus(null), 5000);
    }
  };

  const toggleSource = (source) => {
    if (allowedSources.includes(source)) {
      if (allowedSources.length > 1) {
        setAllowedSources(allowedSources.filter(s => s !== source));
      }
    } else {
      setAllowedSources([...allowedSources, source]);
    }
  };

  // Active provider data
  const currentProviderData = providers.find(p => p.provider === activeProviderTab) || {
    provider: activeProviderTab,
    name: activeProviderTab === 'gemini' ? 'Google Gemini' : (activeProviderTab === 'openai' ? 'OpenAI / ChatGPT' : 'Anthropic Claude'),
    isConfigured: false,
    maskedKey: '',
    status: 'not_configured',
    statusMessage: 'Not configured'
  };

  const currentModels = providerModels[activeProviderTab] || [];
  const filteredModels = currentModels.filter(m =>
    m.name?.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.id?.toLowerCase().includes(modelSearch.toLowerCase())
  );
  const activeModelMeta = currentModels.find(m => m.id === selectedModels[activeProviderTab]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Application Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure Multi-Provider AI credentials, dynamic model catalogs, local storage, and privacy scopes.
        </p>
      </div>

      {/* MODULE 1: AI PROVIDER CONFIGURATION */}
      <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                AI Provider Configuration
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure Google Gemini, OpenAI, and Anthropic Claude credentials and dynamic models independently.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Default Provider:</span>
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {defaultProvider}
            </span>
          </div>
        </div>

        {/* Provider Tabs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'gemini', name: 'Google Gemini', desc: 'Google GenAI SDK (@google/genai)', color: 'from-blue-600 to-indigo-600' },
            { id: 'openai', name: 'OpenAI / ChatGPT', desc: 'Official OpenAI SDK (openai)', color: 'from-emerald-600 to-teal-600' },
            { id: 'anthropic', name: 'Anthropic Claude', desc: 'Official Claude SDK (@anthropic-ai/sdk)', color: 'from-amber-600 to-orange-600' }
          ].map(p => {
            const pMeta = providers.find(item => item.provider === p.id) || {};
            const isSelected = activeProviderTab === p.id;
            const isConf = pMeta.isConfigured;
            const isDef = defaultProvider === p.id;

            return (
              <button
                key={p.id}
                onClick={() => { setActiveProviderTab(p.id); setModelSearch(''); }}
                className={`p-4 rounded-2xl text-left border transition-all relative ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {isDef && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-600 text-white">
                    DEFAULT
                  </span>
                )}
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{p.name}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{p.desc}</p>
                <div className="mt-3 flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      pMeta.status === 'connected'
                        ? 'bg-emerald-500'
                        : isConf
                        ? 'bg-blue-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  ></span>
                  <span className="text-[11px] font-medium capitalize text-slate-500 dark:text-slate-400">
                    {pMeta.status === 'connected' ? 'Connected' : (isConf ? 'Configured' : 'Not configured')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Provider Configuration Panel */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>{currentProviderData.name} Settings</span>
                {currentProviderData.isConfigured && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Saved & Encrypted
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentProviderData.statusMessage || 'Enter API key to activate this provider.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {defaultProvider !== activeProviderTab && currentProviderData.isConfigured && (
                <button
                  type="button"
                  onClick={() => handleSetDefaultProvider(activeProviderTab)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
                >
                  Set as Default Provider
                </button>
              )}

              {currentProviderData.isConfigured && (
                <button
                  type="button"
                  onClick={() => handleRemoveProvider(activeProviderTab)}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* API Key Input & Masked Display */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-slate-400" />
                API Key
              </span>
              {currentProviderData.maskedKey && (
                <span className="text-[11px] font-mono text-slate-400">
                  Current: <strong className="text-slate-700 dark:text-slate-200">{currentProviderData.maskedKey}</strong>
                </span>
              )}
            </label>

            <div className="flex gap-2">
              <input
                type="password"
                value={providerKeyInputs[activeProviderTab] || ''}
                onChange={(e) => setProviderKeyInputs(prev => ({ ...prev, [activeProviderTab]: e.target.value }))}
                placeholder={currentProviderData.maskedKey ? 'Leave empty to keep existing key, or enter new key...' : `Enter ${currentProviderData.name} API Key...`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-xs"
              />
              <button
                type="button"
                onClick={() => handleSaveProvider(activeProviderTab)}
                disabled={savingProvider[activeProviderTab]}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-60 shrink-0"
              >
                <Save className={`h-3.5 w-3.5 ${savingProvider[activeProviderTab] ? 'animate-spin' : ''}`} />
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Keys are encrypted at rest with AES-256-GCM using your credential key and never sent to frontend clients.
            </p>
          </div>

          {/* Test Connection Result Banner */}
          {testResults[activeProviderTab] && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResults[activeProviderTab].success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
              }`}
            >
              {testResults[activeProviderTab].success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">
                  {testResults[activeProviderTab].success ? 'Connection Verified' : 'Connection Test Failed'}
                  {testResults[activeProviderTab].durationMs ? ` (${testResults[activeProviderTab].durationMs}ms)` : ''}
                </p>
                <p className="text-[11px] mt-0.5">
                  {testResults[activeProviderTab].reply || testResults[activeProviderTab].error}
                </p>
              </div>
            </div>
          )}

          {/* MODULE 2: DYNAMIC MODEL DISCOVERY & SELECTION */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-indigo-500" />
                  Available Models ({currentModels.length})
                </h5>
                <p className="text-[11px] text-slate-400">
                  Select the default model for {currentProviderData.name}. Retrieved dynamically from provider API.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadModelsForProvider(activeProviderTab)}
                  disabled={loadingModels[activeProviderTab]}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition shadow-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingModels[activeProviderTab] ? 'animate-spin' : ''}`} />
                  Refresh Models
                </button>

                <button
                  type="button"
                  onClick={() => handleTestProvider(activeProviderTab)}
                  disabled={testingProvider[activeProviderTab] || !currentProviderData.isConfigured}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                >
                  <Zap className={`h-3 w-3 ${testingProvider[activeProviderTab] ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>
              </div>
            </div>

            {/* Model Search & Filter Bar */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder={`Search models in ${currentProviderData.name} catalog...`}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Models Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
              {filteredModels.length > 0 ? (
                filteredModels.map(m => {
                  const isModelSelected = selectedModels[activeProviderTab] === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModels(prev => ({ ...prev, [activeProviderTab]: m.id }))}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isModelSelected
                          ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {m.name || m.id}
                        </span>
                        {isModelSelected && (
                          <span className="h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{m.id}</p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                        {m.contextWindow && <span>Context: {m.contextWindow}</span>}
                        {m.toolCalling && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                            Tools ?
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                  {loadingModels[activeProviderTab] ? 'Loading dynamic models from API...' : 'No models matching search filter.'}
                </div>
              )}
            </div>

            {/* Selected Active Model Summary Bar */}
            {activeModelMeta && (
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                <span className="font-semibold">
                  Default {currentProviderData.name} Model: <strong>{activeModelMeta.name || activeModelMeta.id}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleSaveProvider(activeProviderTab)}
                  disabled={savingProvider[activeProviderTab]}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] transition shadow-xs"
                >
                  Save Selection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODULE: GENERAL SETTINGS (Privacy, Sync, Storage) */}
      <form onSubmit={handleSaveGeneral} className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Data & Synchronization Preferences
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control automated background polling and authorized data retrieval platforms.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingGeneral}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-60"
          >
            <Save className={`h-3.5 w-3.5 ${savingGeneral ? 'animate-spin' : ''}`} />
            Save Preferences
          </button>
        </div>

        {generalStatus && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              generalStatus.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{generalStatus.text}</span>
          </div>
        )}

        {/* Authorized Search Scopes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            Authorized Retrieval Scopes
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'whatsapp', label: 'WhatsApp', desc: 'Chats & archives' },
              { id: 'gmail', label: 'Gmail', desc: 'Emails & threads' },
              { id: 'drive', label: 'Google Drive', desc: 'Documents & PDFs' }
            ].map(s => {
              const active = allowedSources.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{s.label}</span>
                    <input type="checkbox" checked={active} readOnly className="rounded text-indigo-600 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sync Frequency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Automated Background Sync Interval
            </label>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 1 hour (Recommended)</option>
              <option value="180">Every 3 hours</option>
              <option value="360">Every 6 hours</option>
            </select>
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Enable automated background polling
              </span>
            </label>
          </div>
        </div>
      </form>
    </div>
  );
}
