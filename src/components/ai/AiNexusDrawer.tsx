import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { useAiNexus } from '@/src/app/providers/AiNexusContext';
import { 
  Sparkles, 
  Send, 
  X, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  ChevronRight, 
  Bot, 
  User as UserIcon, 
  History, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Briefcase,
  AlertCircle
} from 'lucide-react';

interface AiNexusDrawerProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const AiNexusDrawer: React.FC<AiNexusDrawerProps> = ({ onNavigate }) => {
  const { role, user } = useAuth();
  const { 
    isOpen, 
    closeAssistant, 
    messages, 
    sendMessage, 
    isLoading, 
    error, 
    retryLastMessage,
    suggestedQuestions, 
    startNewConversation,
    conversations,
    selectConversation,
    deleteConversation,
    activeConversationId
  } = useAiNexus();

  const [inputMessage, setInputMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const authenticationError = Boolean(error && /sign in to use AI Nexus|sign-in session has expired/i.test(error));

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;
    sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getAssistantRoleBadge = () => {
    switch (role) {
      case 'JOB_SEEKER':
        return { label: 'Career Intelligence', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800' };
      case 'EMPLOYER':
        return { label: 'Recruitment Intelligence', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800' };
      case 'ADMIN':
        return { label: 'Platform Intelligence', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' };
      default:
        return { label: 'Assistant', color: 'bg-slate-100 text-slate-800' };
    }
  };

  const roleBadge = getAssistantRoleBadge();

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAssistant();
      }}
    >
      <div 
        className={`sb-glass bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-[100dvh] transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-full md:w-[760px]' : 'w-full md:w-[480px]'
        }`}
        role="dialog"
        aria-label="SKILLBRIDGE AI NEXUS Assistant"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl border border-slate-300 bg-slate-100 flex items-center justify-center text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white font-heading tracking-tight">
                  SKILLBRIDGE AI NEXUS
                </span>
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                  {roleBadge.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ask Better. Discover More. Move Forward.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* View Conversation History */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                showHistory ? 'bg-slate-200 dark:bg-slate-800 text-sky-600' : ''
              }`}
              title="Conversation History"
              aria-label="Toggle Conversation History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Expand / Minimize Width */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden md:flex p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isExpanded ? 'Contract View' : 'Expand View'}
              aria-label="Resize drawer"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* New Conversation */}
            <button
              onClick={startNewConversation}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Start New Conversation"
              aria-label="Start New Conversation"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={closeAssistant}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History Overlay Sidebar */}
        {showHistory && (
          <div className="bg-slate-100 dark:bg-slate-950 p-4 border-b border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Saved Conversations ({conversations.length})</span>
              <button 
                onClick={startNewConversation} 
                className="text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
            {conversations.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No prior conversations found.</p>
            ) : (
              conversations.map((c) => (
                <div 
                  key={c.id} 
                  className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeConversationId === c.id 
                      ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-semibold border border-sky-300 dark:border-sky-800' 
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                  }`}
                  onClick={() => {
                    selectConversation(c.id);
                    setShowHistory(false);
                  }}
                >
                  <div className="truncate flex-1 pr-2">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-[10px] text-slate-400">{new Date(c.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-5">
              <div className="w-14 h-14 rounded-2xl border border-slate-300 bg-slate-100 flex items-center justify-center text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Bot className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                  Welcome to AI NEXUS
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Grounded in SKILLBRIDGE's live MySQL-backed application data. Instant career guidance, candidate screening, and platform intelligence tailored to Ethiopia.
                </p>
              </div>

              {!user ? (
                <div className="w-full rounded-xl border border-sky-200 bg-sky-50 p-4 text-left dark:border-sky-900 dark:bg-sky-950/30">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Sign in to start a conversation</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">AI Nexus uses your account to provide role-specific career guidance and protect private profile and application data.</p>
                  <button
                    onClick={() => {
                      closeAssistant();
                      onNavigate?.('auth', { mode: 'login' });
                    }}
                    className="mt-3 min-h-[44px] rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    Sign in
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-2 pt-2">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-left">
                    Suggested Questions
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(q)}
                        className="text-left p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-800 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span className="leading-snug">{q}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5 flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Active Message Stream */
            messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div 
                  key={m.id} 
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-2xl p-4 text-xs space-y-2.5 ${
                    isUser 
                      ? 'bg-sky-600 text-white rounded-br-xs' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/80'
                  }`}>
                    {/* Header info */}
                    {!isUser && (
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[11px] text-slate-900 dark:text-white">AI NEXUS</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${m.isAiGenerated ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200'}`}>
                            {m.isAiGenerated ? `${m.metadata?.provider === 'openai' ? 'OpenAI' : 'Gemini'}${m.metadata?.fallbackUsed ? ' fallback' : ''}` : 'Deterministic fallback'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(m.content, m.id)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                          title="Copy response"
                        >
                          {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    {/* Markdown / text formatting */}
                    <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                      {m.content}
                    </div>

                    {/* Metadata Structured Cards */}
                    {m.metadata && !isUser && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        {/* Job Cards */}
                        {m.metadata.jobCards && m.metadata.jobCards.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Vacancies</span>
                            <div className="grid grid-cols-1 gap-1.5">
                              {m.metadata.jobCards.map((job: any) => (
                                <div 
                                  key={job.id} 
                                  onClick={() => onNavigate && onNavigate('job-detail', { jobId: job.id })}
                                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-500 transition-colors flex items-center justify-between cursor-pointer"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">{job.title}</div>
                                    <div className="text-[10px] text-slate-500">{job.employer} · {job.city || 'Addis Ababa'}</div>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Skill Badges */}
                        {m.metadata.skillBadges && m.metadata.skillBadges.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skill Competency Map</span>
                            <div className="flex flex-wrap gap-1.5">
                              {m.metadata.skillBadges.map((badge: any, bIdx: number) => (
                                <span 
                                  key={bIdx}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                    badge.status === 'matched' 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                      : badge.status === 'missing'
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                      : 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                                  }`}
                                >
                                  {badge.name} ({badge.status})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Follow-up Action Buttons */}
                        {m.metadata.suggestedActions && m.metadata.suggestedActions.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1.5">
                            {m.metadata.suggestedActions.map((action: string, aIdx: number) => (
                              <button
                                key={aIdx}
                                onClick={() => sendMessage(action)}
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 transition-colors cursor-pointer text-left"
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start items-start">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-xs p-4 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                <span>Consulting SKILLBRIDGE database & formulating response...</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Unable to process query</div>
                <div>{error}</div>
                {authenticationError ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeAssistant();
                      onNavigate?.('auth', { mode: 'login' });
                    }}
                    className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-300 px-3 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-950"
                  >
                    Sign in again
                  </button>
                ) : (
                  <button type="button" onClick={() => void retryLastMessage()} disabled={isLoading} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-rose-300 px-3 font-semibold hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-950">Retry last message</button>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form onSubmit={handleSend} className="space-y-2">
            <div className="relative flex items-center">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!user}
                placeholder={user ? `Ask ${roleBadge.label} anything...` : 'Sign in to ask AI Nexus'}
                rows={2}
                className="w-full pl-3 pr-11 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900 dark:text-white resize-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!user || !inputMessage.trim() || isLoading}
                className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{user ? 'Grounded in Ethiopian market data & live application data' : 'Your private data stays protected'}</span>
              <span>{user ? 'Press Enter to send' : 'Sign in required'}</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
