import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  Plus,
  MessageSquare,
  Mail,
  HardDrive,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  Layers,
  AlertTriangle,
  RotateCcw,
  Cpu,
  CheckCircle2,
  Globe
} from 'lucide-react';
import api from '../services/api';
import socketService from '../services/socket';

export default function AIAssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConvTitle, setActiveConvTitle] = useState('New Conversation');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [progressState, setProgressState] = useState(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['whatsapp', 'gmail', 'drive']);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const [lastFailedMessage, setLastFailedMessage] = useState(null);

  // Multi-Provider & Model States
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [changeStatus, setChangeStatus] = useState(null);
  const [modelWarning, setModelWarning] = useState(null);

  const messagesEndRef = useRef(null);

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    await Promise.all([
      loadConversations(),
      loadProvidersAndModels()
    ]);
  };

  const loadProvidersAndModels = async () => {
    try {
      const pRes = await api.getAiProviders();
      if (pRes.success) {
        setProviders(pRes.providers || []);
        const defP = pRes.defaultProvider || 'gemini';
        setSelectedProvider(defP);
        await loadModelsForProvider(defP);
      }
    } catch {
      await loadModelsForProvider('gemini');
    }
  };

  const loadModelsForProvider = async (provider, preserveModel = null) => {
    setLoadingModels(true);
    setModelWarning(null);
    try {
      const res = await api.getModels(provider);
      if (res.success && Array.isArray(res.models)) {
        setModels(res.models);
        if (preserveModel) {
          const exists = res.models.some(m => m.id === preserveModel);
          if (exists) {
            setSelectedModel(preserveModel);
          } else {
            setSelectedModel(preserveModel); // keep user's preference
            setModelWarning(`Notice: Model "${preserveModel}" is not in current active catalog. You may want to choose an available model.`);
          }
        } else if (res.currentModel) {
          setSelectedModel(res.currentModel);
        } else if (res.models[0]?.id) {
          setSelectedModel(res.models[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to load models in chat:', e);
    } finally {
      setLoadingModels(false);
    }
  };

  // Listen to searchParams (specifically ?conv= and ?q=)
  useEffect(() => {
    const convId = searchParams.get('conv');
    if (convId) {
      const parsedId = parseInt(convId, 10);
      if (!isNaN(parsedId)) {
        loadConversation(parsedId);
      }
    } else {
      setActiveConvId(null);
      setActiveConvTitle('New Conversation');
      setMessages([]);
      setProgressState(null);
      setLastFailedMessage(null);
    }

    const queryPrompt = searchParams.get('q');
    if (queryPrompt) {
      setInputMessage(queryPrompt);
    }
  }, [searchParams.get('conv'), searchParams.get('q')]);

  // Socket listeners for real-time AI progress
  useEffect(() => {
    const handleProgress = (data) => {
      if (!activeConvId || String(data.conversationId) === String(activeConvId)) {
        setProgressState({
          stage: data.stage || 'searching_sources',
          text: data.text || `Searching: ${data.tool || 'connected sources'}`
        });
      }
    };

    socketService.on('ai:progress', handleProgress);
    return () => {
      socketService.off('ai:progress', handleProgress);
    };
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progressState, loading]);

  const handleProviderChange = async (e) => {
    const newProvider = e.target.value;
    setSelectedProvider(newProvider);
    setChangeStatus(`Switched to ${newProvider.toUpperCase()}`);
    setTimeout(() => setChangeStatus(null), 3000);
    await loadModelsForProvider(newProvider);
  };

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    setModelWarning(null);
    setChangeStatus(`Model: ${newModel}`);
    setTimeout(() => setChangeStatus(null), 3000);
  };

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    }
  };

  const loadConversation = async (id) => {
    if (!id) return;
    setLoadingHistory(true);
    setProgressState(null);
    setLastFailedMessage(null);
    try {
      setActiveConvId(id);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('conv', String(id));
        return next;
      }, { replace: true });

      const data = await api.getConversation(id);
      if (data.success) {
        setMessages(data.messages || []);
        if (data.conversation) {
          setActiveConvTitle(data.conversation.title || `Conversation #${id}`);
          const convProvider = data.conversation.provider || 'gemini';
          const convModel = data.conversation.model;
          setSelectedProvider(convProvider);
          await loadModelsForProvider(convProvider, convModel);
        }
      }
    } catch (e) {
      console.error('Failed to load conversation:', e);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setActiveConvTitle('New Conversation');
    setMessages([]);
    setProgressState(null);
    setLastFailedMessage(null);
    setInputMessage('');
    setSearchParams({}, { replace: true });
  };

  const togglePlatform = (p) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(item => item !== p));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const executeSend = async (textToSend) => {
    if (!textToSend || !textToSend.trim() || loading) return;

    const userText = textToSend.trim();
    setInputMessage('');
    setLastFailedMessage(null);
    setLoading(true);
    setProgressState({ stage: 'preparing_request', text: 'Preparing query...' });

    const tempUserMsg = {
      id: Date.now(),
      sender: 'user',
      provider: selectedProvider,
      model: selectedModel,
      content: userText,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await api.chat({
        message: userText,
        conversationId: activeConvId,
        provider: selectedProvider,
        model: selectedModel,
        platforms: selectedPlatforms
      });

      if (result.success) {
        if (!activeConvId && result.conversationId) {
          setActiveConvId(result.conversationId);
          setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('conv', String(result.conversationId));
            return next;
          }, { replace: true });
        }

        const botMsg = {
          id: result.assistantMessageId || (Date.now() + 1),
          sender: 'assistant',
          provider: result.provider || selectedProvider,
          model: result.model || selectedModel,
          content: result.reply,
          citations_json: result.sources,
          token_usage_json: result.tokenUsage,
          created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, botMsg]);
        loadConversations();
      }
    } catch (err) {
      console.error('Chat submission failed:', err);
      setLastFailedMessage(userText);
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'assistant',
        provider: selectedProvider,
        model: selectedModel,
        isError: true,
        content: `⚠️ **Request Failed (${err.code || 'ERROR'})**\n\n${err.message}\n\n*Provider:* \`${selectedProvider}\` | *Model:* \`${selectedModel}\``,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setProgressState(null);
    }
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    executeSend(inputMessage);
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      executeSend(lastFailedMessage);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSourceExpand = (id) => {
    setExpandedSources(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const platformBadge = (p) => {
    switch (p) {
      case 'whatsapp':
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"><MessageSquare className="h-3 w-3" /> WhatsApp</span>;
      case 'gmail':
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"><Mail className="h-3 w-3" /> Gmail</span>;
      case 'drive':
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"><HardDrive className="h-3 w-3" /> Drive</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300"><FileText className="h-3 w-3" /> Document</span>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Conversations History Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Conversations</span>
            <button
              onClick={handleNewChat}
              className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition shadow-2xs"
              title="Start New Chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-16rem)]">
            {conversations.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 text-center">No saved chats</p>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeConvId;
                return (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition flex items-center justify-between ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="truncate">{c.title || `Chat #${c.id}`}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-mono px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase">
                          {c.provider || 'gemini'}
                        </span>
                        {c.last_message && (
                          <p className="text-[10px] text-slate-400 truncate font-normal">
                            {c.last_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {new Date(c.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Source Preferences Filter */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Search Scope</p>
          <div className="flex gap-1.5">
            {[
              { id: 'whatsapp', label: 'WA', title: 'WhatsApp' },
              { id: 'gmail', label: 'Gmail', title: 'Gmail' },
              { id: 'drive', label: 'Drive', title: 'Google Drive' }
            ].map(p => {
              const active = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                  title={p.title}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col justify-between h-full bg-white dark:bg-slate-900 overflow-hidden">
        {/* Chat Header with Dual Selectors: Provider & Model */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-sm">
              {activeConvTitle}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* 1. AI Provider Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <Globe className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
              <select
                value={selectedProvider}
                onChange={handleProviderChange}
                disabled={loading}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-1"
                title="Select AI Provider"
              >
                <option value="gemini" className="bg-white dark:bg-slate-900">Google Gemini</option>
                <option value="openai" className="bg-white dark:bg-slate-900">OpenAI / ChatGPT</option>
                <option value="anthropic" className="bg-white dark:bg-slate-900">Anthropic Claude</option>
              </select>
            </div>

            {/* 2. Provider's Dynamic Model Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <Cpu className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
              <select
                value={selectedModel}
                onChange={handleModelChange}
                disabled={loading || loadingModels}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-1 max-w-[180px] truncate"
                title="Select Model for this session"
              >
                {models.length > 0 ? (
                  models.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
                      {m.name || m.displayName || m.id}
                    </option>
                  ))
                ) : (
                  <option value={selectedModel}>{selectedModel}</option>
                )}
              </select>
            </div>

            {changeStatus && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="h-3 w-3" /> {changeStatus}
              </span>
            )}

            {activeConvId && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                Conv #{activeConvId}
              </span>
            )}

            <button
              onClick={handleNewChat}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              title="Start a new blank conversation"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {/* Model warning banner if loaded model is inactive */}
        {modelWarning && (
          <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>{modelWarning}</span>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loadingHistory ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Retrieving conversation history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 my-auto">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Ask your unified data</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Using <strong className="text-indigo-600 dark:text-indigo-400 capitalize">{selectedProvider}</strong> ({selectedModel}) to search your local WhatsApp chats, Gmail threads, and Google Drive files.
                </p>
              </div>

              {/* Sample Queries */}
              <div className="grid grid-cols-1 gap-2 w-full pt-2">
                {[
                  "Give me all details about client XYZ.",
                  "Find every email exchanged with Rahul.",
                  "What payments or rental amounts were discussed?",
                  "Find all invoices related to ABC Enterprises.",
                  "What commitments are still pending?"
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setInputMessage(sample); }}
                    className="p-2.5 text-xs text-left font-medium text-slate-700 dark:text-slate-300 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
                  >
                    <span>{sample}</span>
                    <Send className="h-3 w-3 opacity-40" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.sender === 'user';
              let citations = m.citations || [];
              if (!citations.length && m.citations_json) {
                try {
                  citations = typeof m.citations_json === 'string' ? JSON.parse(m.citations_json) : m.citations_json;
                } catch {}
              }

              return (
                <div key={m.id} className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                  {!isUser && (
                    <div className={`h-8 w-8 rounded-xl ${m.isError ? 'bg-amber-600' : 'bg-indigo-600'} text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5`}>
                      {m.isError ? <AlertTriangle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                  )}

                  <div className={`space-y-3 max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : (m.isError
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-tl-none whitespace-pre-wrap'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 rounded-tl-none whitespace-pre-wrap')
                    }`}>
                      {m.content?.trim() || (isUser ? '' : 'No response text recorded.')}
                    </div>

                    {/* Sources / Citations Section */}
                    {!isUser && citations && citations.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <Layers className="h-3 w-3 text-indigo-500" />
                            Retrieved Sources ({citations.length})
                          </span>
                          <button
                            onClick={() => toggleSourceExpand(m.id)}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                          >
                            {expandedSources[m.id] ? 'Hide' : 'Expand'}
                            {expandedSources[m.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </div>

                        {expandedSources[m.id] && (
                          <div className="space-y-2 pt-1">
                            {citations.map((c, i) => (
                              <div key={i} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 space-y-1">
                                <div className="flex items-center justify-between">
                                  {platformBadge(c.sourcePlatform || c.platform)}
                                  <span className="text-[10px] text-slate-400 font-mono">#{c.recordId}</span>
                                </div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate">{c.title}</p>
                                {c.snippet && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded">
                                    "{c.snippet}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action footer with Provider & Model badge */}
                    {!isUser && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                        <button
                          onClick={() => handleCopy(m.id, m.content)}
                          className="hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition"
                        >
                          {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                        </button>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded capitalize">
                          {m.provider || selectedProvider}: {m.model || selectedModel}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Granular Progress Indicator */}
          {loading && progressState && (
            <div className="flex gap-3 max-w-4xl mr-auto">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse">
                <Bot className="h-4 w-4" />
              </div>
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200 text-xs rounded-tl-none flex items-center gap-3">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-semibold capitalize tracking-wide text-[11px] text-indigo-500 dark:text-indigo-400">
                    {progressState.stage?.replace(/_/g, ' ')}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    {progressState.text}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Retry Action on Failure */}
          {lastFailedMessage && !loading && (
            <div className="flex justify-start pl-11">
              <button
                onClick={handleRetry}
                className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-100 dark:hover:bg-amber-900 transition shadow-2xs"
              >
                <RotateCcw className="h-3 w-3" />
                Retry last question
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question about your clients, chats, emails, or agreements..."
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 transition shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Active: <strong className="text-indigo-600 dark:text-indigo-400 capitalize">{selectedProvider}</strong> ({selectedModel})
            </span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
