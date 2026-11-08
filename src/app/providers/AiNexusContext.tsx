import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/src/services/api-client';
import { AiNexusMessage, AiNexusConversation } from '@/shared/types';

interface AiNexusContextType {
  isOpen: boolean;
  openAssistant: (initialPrompt?: string) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  messages: AiNexusMessage[];
  conversations: AiNexusConversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string, pageContext?: any) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  startNewConversation: () => void;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  suggestedQuestions: string[];
  currentRoute: string;
  setCurrentRoute: (route: string) => void;
}

const AiNexusContext = createContext<AiNexusContextType | undefined>(undefined);

export const AiNexusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AiNexusMessage[]>([]);
  const [conversations, setConversations] = useState<AiNexusConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedRequest, setLastFailedRequest] = useState<{ text: string; pageContext?: any } | null>(null);
  const [currentRoute, setCurrentRoute] = useState<string>('landing');
  const identity = user ? `${user.id}:${role}` : null;
  const identityRef = useRef<string | null>(identity);
  const identityVersionRef = useRef(0);
  const viewVersionRef = useRef(0);

  useLayoutEffect(() => {
    identityRef.current = identity;
    const identityVersion = ++identityVersionRef.current;
    viewVersionRef.current += 1;
    setConversations([]);
    setMessages([]);
    setActiveConversationId(null);
    setIsLoading(false);
    setError(null);
    setLastFailedRequest(null);
    if (identity) void loadConversations(identity, identityVersion, true);
  }, [identity]);

  const isCurrentRequest = (requestIdentity: string, identityVersion: number, viewVersion?: number) =>
    identityRef.current === requestIdentity
    && identityVersionRef.current === identityVersion
    && (viewVersion === undefined || viewVersionRef.current === viewVersion);

  const loadConversation = async (
    id: string,
    requestIdentity: string,
    identityVersion: number,
    viewVersion: number
  ) => {
    if (!isCurrentRequest(requestIdentity, identityVersion, viewVersion)) return;
    setIsLoading(true);
    setError(null);
    try {
      const conv = await api.getNexusConversation(id);
      if (!isCurrentRequest(requestIdentity, identityVersion, viewVersion)) return;
      setActiveConversationId(conv.id);
      setMessages(conv.messages || []);
    } catch (err: any) {
      if (isCurrentRequest(requestIdentity, identityVersion, viewVersion)) {
        setError(err?.message || 'Failed to load conversation');
      }
    } finally {
      if (isCurrentRequest(requestIdentity, identityVersion, viewVersion)) setIsLoading(false);
    }
  };

  const loadConversations = async (
    requestIdentity = identityRef.current,
    identityVersion = identityVersionRef.current,
    selectLatest = false
  ) => {
    if (!requestIdentity || !isCurrentRequest(requestIdentity, identityVersion)) return;
    const initialViewVersion = viewVersionRef.current;
    try {
      const list = await api.getNexusConversations();
      if (!isCurrentRequest(requestIdentity, identityVersion)) return;
      setConversations(list);
      if (selectLatest && list.length > 0 && viewVersionRef.current === initialViewVersion) {
        const viewVersion = ++viewVersionRef.current;
        await loadConversation(list[0].id, requestIdentity, identityVersion, viewVersion);
      } else if (list.length === 0 && selectLatest && viewVersionRef.current === initialViewVersion) {
        setMessages([]);
        setActiveConversationId(null);
      }
    } catch (err: any) {
      if (isCurrentRequest(requestIdentity, identityVersion)) {
        console.warn('[AiNexus] Error loading conversations:', err?.message);
      }
    }
  };

  const selectConversation = async (id: string) => {
    const requestIdentity = identityRef.current;
    if (!requestIdentity) return;
    const identityVersion = identityVersionRef.current;
    const viewVersion = ++viewVersionRef.current;
    await loadConversation(id, requestIdentity, identityVersion, viewVersion);
  };

  const startNewConversation = () => {
    viewVersionRef.current += 1;
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setLastFailedRequest(null);
  };

  const deleteConversation = async (id: string) => {
    const requestIdentity = identityRef.current;
    if (!requestIdentity) return;
    const identityVersion = identityVersionRef.current;
    try {
      await api.deleteNexusConversation(id);
      if (!isCurrentRequest(requestIdentity, identityVersion)) return;
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        startNewConversation();
      }
    } catch (err: any) {
      if (isCurrentRequest(requestIdentity, identityVersion)) {
        setError(err?.message || 'Failed to delete conversation');
      }
    }
  };

  const openAssistant = (initialPrompt?: string) => {
    setIsOpen(true);
    if (initialPrompt && initialPrompt.trim()) {
      sendMessage(initialPrompt.trim());
    }
  };

  const closeAssistant = () => setIsOpen(false);
  const toggleAssistant = () => setIsOpen(prev => !prev);

  const sendMessage = async (text: string, pageContext?: any) => {
    if (!text.trim()) return;
    const requestIdentity = identityRef.current;
    if (!user || !requestIdentity) {
      setError('Sign in to use AI Nexus career guidance.');
      setLastFailedRequest(null);
      return;
    }
    const identityVersion = identityVersionRef.current;
    const viewVersion = viewVersionRef.current;
    const conversationId = activeConversationId;

    // Optimistically add user's message
    const tempUserMsg: AiNexusMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId || 'pending',
      sender: 'user',
      content: text.trim(),
      isAiGenerated: false,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev.filter((message) => !message.id.startsWith('temp-')), tempUserMsg]);
    setIsLoading(true);
    setError(null);
    setLastFailedRequest(null);

    try {
      const response = await api.queryNexus({
        message: text.trim(),
        conversationId: conversationId || undefined,
        contextRoute: currentRoute,
        pageContext
      });

      if (response.success && response.message) {
        if (!isCurrentRequest(requestIdentity, identityVersion, viewVersion)) return;
        setActiveConversationId(response.conversationId);
        // Replace temp or append
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempUserMsg.id);
          return [
            ...withoutTemp,
            { ...tempUserMsg, conversationId: response.conversationId },
            response.message
          ];
        });
        // Refresh conversation listing
        void loadConversations(requestIdentity, identityVersion);
      }
    } catch (err: any) {
      if (!isCurrentRequest(requestIdentity, identityVersion, viewVersion)) return;
      console.error('[AiNexus] Message failed:', err);
      const message = err?.message || 'Failed to generate response. Please check your connection and retry.';
      const authenticationFailed = /authentication token required|invalid or expired token|authentication required/i.test(message);
      setError(authenticationFailed
        ? 'Your sign-in session has expired. Sign in again to continue using AI Nexus.'
        : message);
      setLastFailedRequest(authenticationFailed ? null : { text: text.trim(), pageContext });
    } finally {
      if (isCurrentRequest(requestIdentity, identityVersion, viewVersion)) setIsLoading(false);
    }
  };

  const retryLastMessage = async () => {
    if (lastFailedRequest && !isLoading) await sendMessage(lastFailedRequest.text, lastFailedRequest.pageContext);
  };

  // Role & Route Adaptive Suggested Questions
  const getSuggestedQuestions = (): string[] => {
    if (role === 'JOB_SEEKER') {
      if (currentRoute === 'jobs' || currentRoute === 'job-detail') {
        return [
          'Which jobs best match my current skills?',
          'Why is this job recommended for me?',
          'What skills am I missing for this position?',
          'Help me tailor my cover note for this role'
        ];
      }
      if (currentRoute === 'career-skills') {
        return [
          'What skills should I learn next for the Ethiopian market?',
          'Create a realistic 4-week weekly learning plan',
          'Recommend portfolio projects that prove my missing skills',
          'How can I improve my chances of meeting job requirements?'
        ];
      }
      return [
        'Which jobs best match my verified skills?',
        'What skills am I missing for senior software roles?',
        'Help me prepare for an interview for my target role',
        'Show my application statuses and explain my next steps'
      ];
    }

    if (role === 'EMPLOYER') {
      if (currentRoute === 'employer-dashboard') {
        return [
          'Which candidates best fit our open backend positions?',
          'How can I improve our job description to attract qualified talent?',
          'Draft technical screening questions for a backend engineer',
          'Summarize performance evaluations for recently hired talent'
        ];
      }
      return [
        'Compare our applicants by verified skill match score',
        'Help identify skill gaps in our candidate pipeline',
        'How to write inclusive requirements without degree inflation?',
        'Draft structured interview evaluation rubrics'
      ];
    }

    // ADMIN
    return [
      'Summarize employer verification backlog and risk flags',
      'Show me platform-wide skill demand trends in Ethiopia',
      'Generate an audit summary of recent administrative decisions',
      'Which job sectors have the largest talent supply-demand gap?'
    ];
  };

  return (
    <AiNexusContext.Provider
      value={{
        isOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        messages,
        conversations,
        activeConversationId,
        isLoading,
        error,
        sendMessage,
        retryLastMessage,
        startNewConversation,
        selectConversation,
        deleteConversation,
        suggestedQuestions: getSuggestedQuestions(),
        currentRoute,
        setCurrentRoute
      }}
    >
      {children}
    </AiNexusContext.Provider>
  );
};

export const useAiNexus = () => {
  const context = useContext(AiNexusContext);
  if (!context) {
    throw new Error('useAiNexus must be used within an AiNexusProvider');
  }
  return context;
};
