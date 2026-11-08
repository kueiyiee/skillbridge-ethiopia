import { useEffect, useRef, useState, type FormEvent } from 'react';

type NexusMessage = {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt?: string;
};

type StreamDone = {
  conversationId: string;
  message: NexusMessage;
};

type StreamFailure = Error & { retryable: boolean };

function streamFailure(message: string, retryable: boolean): StreamFailure {
  return Object.assign(new Error(message), { retryable });
}

function createTurnId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export function AiNexusPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NexusMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [retryTurn, setRetryTurn] = useState<{
    message: string;
    turnId: string;
    assistantId: string;
    conversationId: string | null;
  } | null>(null);
  const conversationLoad = useRef(0);

  useEffect(() => {
    let mounted = true;
    void fetch('/api/ai/nexus/conversations', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readErrorMessage(response));
        return response.json() as Promise<{ data: ConversationSummary[] }>;
      })
      .then((result) => {
        if (mounted) setConversations(result.data);
      })
      .catch((loadError: unknown) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load conversations.');
      });
    return () => { mounted = false; };
  }, []);

  async function openConversation(id: string) {
    const loadId = ++conversationLoad.current;
    setError('');
    try {
      const response = await fetch(`/api/ai/nexus/conversations/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const result = await response.json() as { data: { messages: NexusMessage[] } };
      if (loadId !== conversationLoad.current) return;
      setActiveConversationId(id);
      setMessages(result.data.messages);
      setRetryTurn(null);
    } catch (loadError) {
      if (loadId === conversationLoad.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load this conversation.');
      }
    }
  }

  function startNewConversation() {
    conversationLoad.current += 1;
    setActiveConversationId(null);
    setMessages([]);
    setDraft('');
    setError('');
    setRetryTurn(null);
  }

  async function streamReply(turn: {
    message: string;
    turnId: string;
    assistantId: string;
    conversationId: string | null;
  }) {
    setSending(true);
    setError('');
    setRetryable(false);
    setMessages((current) => current.map((message) =>
      message.id === turn.assistantId ? { ...message, content: '' } : message,
    ));
    let resolvedConversationId = turn.conversationId;

    try {
      const response = await fetch('/api/ai/nexus/query/stream', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: turn.message,
          conversationId: turn.conversationId || undefined,
          turnId: turn.turnId,
          contextRoute: 'ai-assistant',
        }),
      });
      if (!response.ok) {
        throw streamFailure(await readErrorMessage(response), response.status === 429 || response.status >= 500);
      }
      if (!response.body) throw streamFailure('Streaming is unavailable in this browser. Please retry.', true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;
      const handleEvent = (block: string) => {
        let eventName = 'message';
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (line.startsWith('data:')) data.push(line.slice(5).trim());
        }
        if (!data.length) return;
        const payload = JSON.parse(data.join('\n')) as Record<string, unknown>;
        if (eventName === 'conversation' && typeof payload.conversationId === 'string') {
          resolvedConversationId = payload.conversationId;
          setActiveConversationId(payload.conversationId);
        } else if (eventName === 'delta' && typeof payload.text === 'string') {
          setMessages((current) => current.map((message) =>
            message.id === turn.assistantId ? { ...message, content: message.content + payload.text } : message,
          ));
        } else if (eventName === 'reset') {
          setMessages((current) => current.map((message) =>
            message.id === turn.assistantId ? { ...message, content: '' } : message,
          ));
        } else if (eventName === 'done') {
          const result = payload as unknown as StreamDone;
          completed = true;
          setActiveConversationId(result.conversationId);
          setMessages((current) => current.map((message) =>
            message.id === turn.assistantId ? result.message : message,
          ));
          setConversations((current) => {
            const existing = current.filter((conversation) => conversation.id !== result.conversationId);
            return [
              { id: result.conversationId, title: turn.message.slice(0, 40), updatedAt: new Date().toISOString() },
              ...existing,
            ].slice(0, 20);
          });
        } else if (eventName === 'error') {
          throw streamFailure(
            typeof payload.error === 'string' ? payload.error : 'AI request failed. Please retry.',
            payload.retryable === true,
          );
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        for (const block of blocks) handleEvent(block);
      }
      buffer += decoder.decode();
      if (buffer.trim()) handleEvent(buffer);
      if (!completed) throw streamFailure('The AI stream ended before the answer was complete. Please retry.', true);
      setRetryTurn(null);
    } catch (requestError) {
      const failure = requestError instanceof Error
        ? requestError as StreamFailure
        : streamFailure('AI request failed. Please retry.', true);
      setError(failure.message);
      setRetryable(failure.retryable === true);
      setRetryTurn({ ...turn, conversationId: resolvedConversationId });
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    const turn = {
      message,
      turnId: createTurnId(),
      assistantId: '',
      conversationId: activeConversationId,
    };
    turn.assistantId = `pending-${turn.turnId}`;
    setMessages((current) => [
      ...current,
      { id: `user-${turn.turnId}`, sender: 'user', content: message },
      { id: turn.assistantId, sender: 'assistant', content: '' },
    ]);
    setDraft('');
    void streamReply(turn);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-4 p-4 md:grid-cols-[260px_1fr] md:p-8">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h1 className="font-semibold">AI Nexus</h1>
            <button className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={sending} onClick={startNewConversation}>
              New chat
            </button>
          </div>
          <nav aria-label="Conversations" className="space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${activeConversationId === conversation.id ? 'bg-sky-50 text-sky-800' : 'hover:bg-slate-100'}`}
                onClick={() => void openConversation(conversation.id)}
                disabled={sending}
              >
                {conversation.title}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">SkillBridge Ethiopia assistant</h2>
            <p className="text-sm text-slate-500">Personalized answers use your role-scoped SKILLBRIDGE records.</p>
          </header>
          <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">Ask about your profile, skills, applications, or verified vacancies.</p>
            )}
            {messages.map((message) => (
              <article key={message.id} className={`max-w-3xl whitespace-pre-wrap rounded-xl px-4 py-3 ${message.sender === 'user' ? 'ml-auto bg-sky-50' : 'bg-slate-100'}`}>
                {message.content || (sending && message.sender === 'assistant' ? 'Thinking…' : '')}
              </article>
            ))}
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                <p>{error}</p>
                {retryable && retryTurn && (
                  <button
                    className="mt-2 rounded-md bg-rose-700 px-3 py-1.5 font-medium text-white disabled:opacity-60"
                    disabled={sending}
                    onClick={() => void streamReply(retryTurn)}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
          <form className="flex gap-3 border-t border-slate-200 p-4" onSubmit={submit}>
            <label className="sr-only" htmlFor="nexus-message">Message AI Nexus</label>
            <textarea
              id="nexus-message"
              className="min-h-12 flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              maxLength={4000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a question…"
              disabled={sending}
            />
            <button
              className="self-end rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              disabled={sending || !draft.trim()}
              type="submit"
            >
              {sending ? 'Working…' : 'Send'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
