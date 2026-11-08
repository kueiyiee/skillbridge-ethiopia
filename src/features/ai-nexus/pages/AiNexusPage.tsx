import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { useAiNexus } from '@/src/app/providers/AiNexusContext';
import { api } from '@/src/services/api-client';
import { BackButton } from '@/src/components/navigation/BackButton';
import { 
  Sparkles, 
  Send, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  Bot, 
  User as UserIcon, 
  History, 
  ExternalLink,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface AiNexusPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const AiNexusPage: React.FC<AiNexusPageProps> = ({ onNavigate }) => {
  const { role, user } = useAuth();
  const { 
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<'chat' | 'cv'>('chat');
  const [cvText, setCvText] = useState('');
  const [cvTargetRole, setCvTargetRole] = useState('');
  const [cvResult, setCvResult] = useState<{ aiGenerated: boolean; provider?: 'openai' | 'gemini'; fallbackUsed?: boolean; message?: string; data: any } | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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

  const analyzeCv = async () => {
    if (cvText.trim().length < 80 || cvLoading) return;
    setCvLoading(true);
    setCvError(null);
    try {
      const result = await api.analyzeCandidateCv({ cvText: cvText.trim(), targetJobTitle: cvTargetRole.trim() || undefined });
      setCvResult({ aiGenerated: result.aiGenerated, provider: result.provider, fallbackUsed: result.fallbackUsed, message: result.message, data: result.data });
    } catch (error) {
      setCvError(error instanceof Error ? error.message : 'CV analysis failed. Please retry.');
    } finally {
      setCvLoading(false);
    }
  };

  const getRoleHeader = () => {
    switch (role) {
      case 'JOB_SEEKER':
        return {
          title: 'Career Intelligence Workspace',
          description: 'Personalized career guidance grounded in your saved skills and active SKILLBRIDGE records.',
          badge: 'Job Seeker Mode'
        };
      case 'EMPLOYER':
        return {
          title: 'Recruitment Intelligence Workspace',
          description: 'Role-scoped recruitment guidance grounded in your organization’s SKILLBRIDGE records.',
          badge: 'Employer Recruiter Mode'
        };
      case 'ADMIN':
        return {
          title: 'Platform Intelligence Workspace',
          description: 'Platform summaries grounded in current SKILLBRIDGE governance records.',
          badge: 'Platform Administrator Mode'
        };
      default:
        return {
          title: 'AI Intelligence Workspace',
          description: 'Context-aware assistance grounded in role-scoped SKILLBRIDGE records.',
          badge: 'Standard Mode'
        };
    }
  };

  const headerInfo = getRoleHeader();

  return (
    <div className="sb-page mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <BackButton fallbackTo="/" fallbackLabel="Back to Home" />
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/30 text-sky-200 border border-sky-400/30">
              {headerInfo.badge}
            </span>
            <span className="text-xs text-sky-200/80">Career planning, job search, and skills guidance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-sky-400" />
            SKILLBRIDGE Career AI
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {headerInfo.description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={startNewConversation}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 flex items-center gap-2 transition-all cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>
      </div>

      {role === 'JOB_SEEKER' && <div className="inline-flex max-w-full rounded-md border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" role="group" aria-label="AI workspace">
        <button type="button" aria-pressed={workspace === 'chat'} onClick={() => setWorkspace('chat')} className={`inline-flex min-h-10 items-center gap-2 rounded px-3 text-xs font-semibold ${workspace === 'chat' ? 'bg-app-primary text-app-button-primary-foreground dark:bg-app-primary dark:text-app-button-primary-foreground' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Sparkles className="h-4 w-4" />AI Nexus</button>
        <button type="button" aria-pressed={workspace === 'cv'} onClick={() => setWorkspace('cv')} className={`inline-flex min-h-10 items-center gap-2 rounded px-3 text-xs font-semibold ${workspace === 'cv' ? 'bg-app-primary text-app-button-primary-foreground dark:bg-app-primary dark:text-app-button-primary-foreground' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><FileText className="h-4 w-4" />CV analysis</button>
      </div>}

      {role === 'JOB_SEEKER' && workspace === 'cv' && <section className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" aria-labelledby="cv-analysis-title">
        <form onSubmit={(event) => { event.preventDefault(); void analyzeCv(); }} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div><h2 id="cv-analysis-title" className="text-lg font-bold text-slate-950 dark:text-white">CV and skills analysis</h2><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Paste CV text to compare evidence with your SKILLBRIDGE profile and skill catalog. Contact details are redacted server-side; the text is not saved.</p></div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Target role <span className="font-normal text-slate-500">Optional</span><input value={cvTargetRole} onChange={(event) => setCvTargetRole(event.target.value)} maxLength={150} className="mt-1.5 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="e.g. Backend developer" /></label>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">CV text<textarea value={cvText} onChange={(event) => setCvText(event.target.value)} required minLength={80} maxLength={12000} rows={14} className="mt-1.5 block w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm font-normal text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Paste the experience, skills, and project sections you want reviewed." /></label>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-slate-500">{cvText.length.toLocaleString()} / 12,000 characters</span><button type="submit" disabled={cvLoading || cvText.trim().length < 80} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#10243c] px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-800 dark:hover:bg-cyan-700">{cvLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{cvLoading ? 'Analyzing…' : 'Analyze CV'}</button></div>
          {cvError && <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert" aria-live="assertive"><AlertCircle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{cvError}</span><button type="button" onClick={() => void analyzeCv()} disabled={cvLoading} className="min-h-9 rounded-md border border-rose-300 px-3 font-semibold hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-950">Retry</button></div>}
        </form>
        <div className="min-h-64 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5" aria-live="polite">
          {cvLoading && <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-300" role="status"><RefreshCw className="h-4 w-4 animate-spin text-cyan-700" />Analyzing the redacted CV text…</div>}
          {!cvLoading && !cvResult && <div className="flex min-h-48 flex-col items-center justify-center text-center"><FileText className="h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Analysis appears here</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">Only text evidence and real SKILLBRIDGE catalog skills are used. This is guidance, not a hiring decision.</p></div>}
          {!cvLoading && cvResult && <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800"><h3 className="text-base font-bold text-slate-950 dark:text-white">CV review</h3><span className={`rounded px-2 py-1 text-[10px] font-semibold ${cvResult.aiGenerated ? 'bg-cyan-50 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>{cvResult.aiGenerated ? `${cvResult.provider === 'openai' ? 'OpenAI' : 'Gemini'}${cvResult.fallbackUsed ? ' fallback' : ''} analysis` : 'Deterministic review'}</span></div>
            {cvResult.message && <p className="text-xs text-slate-600 dark:text-slate-400">{cvResult.message}</p>}
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{cvResult.data.summary}</p>
            {cvResult.data.skillsEvidence?.length > 0 && <div><h4 className="text-xs font-bold text-slate-900 dark:text-white">Catalog skills evidenced</h4><ul className="mt-2 space-y-2">{cvResult.data.skillsEvidence.map((item: any) => <li key={item.skill} className="rounded-md bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs font-semibold">{item.skill}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.evidence}</p></li>)}</ul></div>}
            {cvResult.data.strengths?.length > 0 && <div><h4 className="text-xs font-bold text-slate-900 dark:text-white">Evidence-based strengths</h4><ul className="mt-2 space-y-2">{cvResult.data.strengths.map((item: any, index: number) => <li key={`${item.observation}-${index}`} className="rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-800"><p className="font-semibold">{item.observation}</p><p className="mt-1 text-slate-600 dark:text-slate-300">“{item.evidence}”</p></li>)}</ul></div>}
            {cvResult.data.recommendations?.length > 0 && <div><h4 className="text-xs font-bold text-slate-900 dark:text-white">Next steps</h4><ul className="mt-2 space-y-2">{cvResult.data.recommendations.map((item: any, index: number) => <li key={`${item.focusSkill}-${index}`} className="rounded-md border-l-2 border-cyan-600 bg-slate-50 p-3 text-xs dark:bg-slate-800"><p className="font-semibold">{item.focusSkill}: {item.action}</p><p className="mt-1 text-slate-600 dark:text-slate-300">Evidence: {item.evidence}</p></li>)}</ul></div>}
            {cvResult.data.missingRequirements?.length > 0 && <div><h4 className="text-xs font-bold text-slate-900 dark:text-white">Target-job requirements not found in the CV text</h4><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{cvResult.data.missingRequirements.join(', ')}</p></div>}
          </div>}
        </div>
      </section>}

      {/* Main 2-Column Layout */}
      {workspace === 'chat' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        
        {/* Left Column: Session History & Suggestions (4 Cols) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          {/* Quick Suggestions Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-heading">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Suggested Inquiries
            </div>
            <div className="space-y-2">
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-slate-200 dark:border-slate-700/60 hover:border-sky-300 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="leading-snug">{q}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5 ml-2 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Persistent Conversation History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-heading">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-600" />
                <span>Conversation Archive ({conversations.length})</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-96 pr-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No stored conversations yet.</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`p-3 rounded-xl text-xs transition-all cursor-pointer border flex items-center justify-between ${
                      activeConversationId === c.id
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
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
          </div>
        </div>

        {/* Right Column: Interactive Chat Interface (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 max-h-[580px]">
            {messages.length === 0 ? (
              <div className="h-full min-h-[360px] flex flex-col justify-center items-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl border border-slate-300 bg-slate-100 flex items-center justify-center text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Bot className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white font-heading">
                    Start a Career AI conversation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Select a suggested question or enter your inquiry below. Responses may use role-scoped SKILLBRIDGE job and profile context when available; AI guidance does not guarantee employment outcomes.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.sender === 'user';
                return (
                  <div key={m.id} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-9 h-9 rounded-xl border border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`max-w-[85%] rounded-2xl p-4 text-xs space-y-3 ${
                      isUser
                        ? 'bg-sky-600 text-white rounded-br-xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-700/80'
                    }`}>
                      {!isUser && (
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">AI NEXUS</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-medium">
                              {m.isAiGenerated ? `${m.metadata?.provider === 'openai' ? 'OpenAI' : 'Gemini'}${m.metadata?.fallbackUsed ? ' fallback' : ''}` : 'Deterministic fallback'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopy(m.content, m.id)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                            title="Copy response"
                          >
                            {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                        {m.content}
                      </div>

                      {/* Metadata Cards */}
                      {m.metadata && !isUser && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                          {m.metadata.jobCards && m.metadata.jobCards.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Vacancies</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {m.metadata.jobCards.map((job: any) => (
                                  <div
                                    key={job.id}
                                    onClick={() => onNavigate('job-detail', { jobId: job.id })}
                                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-500 transition-all flex items-center justify-between cursor-pointer"
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

                          {m.metadata.skillBadges && m.metadata.skillBadges.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Competency Verification</span>
                              <div className="flex flex-wrap gap-1.5">
                                {m.metadata.skillBadges.map((badge: any, bIdx: number) => (
                                  <span
                                    key={bIdx}
                                    className="px-2.5 py-1 rounded-full text-[10px] font-medium border bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800"
                                  >
                                    {badge.name} ({badge.status})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {m.metadata.suggestedActions && m.metadata.suggestedActions.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-2">
                              {m.metadata.suggestedActions.map((action: string, aIdx: number) => (
                                <button
                                  key={aIdx}
                                  onClick={() => sendMessage(action)}
                                  className="px-3 py-1 text-xs rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 transition-colors cursor-pointer text-left"
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
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex gap-3 justify-start items-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                <span>Executing role-verified database reasoning query...</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex flex-wrap items-center gap-2" role="alert" aria-live="assertive">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="min-w-0 flex-1">{error}</span>
                <button type="button" onClick={() => void retryLastMessage()} disabled={isLoading} className="min-h-10 rounded-md border border-rose-300 px-3 font-semibold hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-950">Retry last message</button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
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
                  rows={2}
                  placeholder={`Consult AI NEXUS (${headerInfo.badge})...`}
                  className="w-full pl-4 pr-12 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900 dark:text-white resize-none shadow-xs"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute right-3 bottom-3 p-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white transition-colors cursor-pointer shadow-sm"
                  aria-label="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Verified role-scoped database context</span>
                <span>Press Enter to dispatch query</span>
              </div>
            </form>
          </div>
        </div>
      </div>}
    </div>
  );
};
