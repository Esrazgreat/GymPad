import { useCallback, useEffect, useRef, useState } from 'react';
import Header from '../components/Header.jsx';
import ChatBubble from '../components/ChatBubble.jsx';
import { useI18n } from '../i18n/index.jsx';
import { streamCoach, ApiError } from '../lib/api.js';

/**
 * AI coach chat.
 *
 * Streams token-by-token so the reply starts appearing immediately — on a slow
 * connection a 5-second silence reads as "broken", while streaming text reads as
 * "thinking".
 *
 * The emergency case is handled distinctly: when the server's red-flag
 * interceptor fires, the reply renders in an alert-styled bubble. That
 * interception happens server-side before the model is ever called, so it cannot
 * be talked around.
 */
export default function Coach() {
  const { t, tList, lang } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest message in view as tokens arrive.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Cancel any in-flight stream if the user navigates away mid-reply.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || streaming) return;

      setError(null);
      setInput('');

      const history = [...messages, { role: 'user', content }];
      setMessages([...history, { role: 'assistant', content: '', streaming: true }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamCoach({
          messages: history.map(({ role, content: c }) => ({ role, content: c })),
          lang,
          signal: controller.signal,
          onEmergency: () => {
            setMessages((list) => {
              const next = [...list];
              next[next.length - 1] = { ...next[next.length - 1], emergency: true };
              return next;
            });
          },
          onDelta: (_chunk, full) => {
            setMessages((list) => {
              const next = [...list];
              next[next.length - 1] = { ...next[next.length - 1], content: full };
              return next;
            });
          },
        });
      } catch (err) {
        if (err.name === 'AbortError') return;
        const message =
          err instanceof ApiError && err.status === 429
            ? err.message
            : t('common.somethingWrong');
        setError(message);
        // Drop the empty assistant bubble so the transcript isn't left dangling.
        setMessages((list) => list.filter((m, i) => !(i === list.length - 1 && !m.content)));
      } finally {
        setStreaming(false);
        abortRef.current = null;
        setMessages((list) =>
          list.map((m, i) => (i === list.length - 1 ? { ...m, streaming: false } : m)),
        );
        inputRef.current?.focus();
      }
    },
    [messages, streaming, lang, t],
  );

  const suggestions = tList('coach.suggestions');

  return (
    <main className="gp-shell flex flex-col" style={{ minHeight: '100dvh' }}>
      <Header title={t('coach.title')} subtitle={t('coach.subtitle')} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4 gp-hide-scroll">
        {messages.length === 0 ? (
          <div className="gp-card p-6 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">🤖</div>
            <h2 className="font-display text-lg mb-2">{t('coach.emptyTitle')}</h2>
            <p className="text-dim text-sm leading-relaxed mb-5">{t('coach.emptyBody')}</p>

            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="gp-ghost w-full !justify-start text-left !py-3 text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <ChatBubble
              key={i}
              role={message.role}
              content={message.content}
              streaming={message.streaming}
              emergency={message.emergency}
            />
          ))
        )}

        {error && (
          <p className="text-danger text-sm text-center py-2" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Composer — pinned above the bottom nav. */}
      <div
        className="sticky bottom-0 pt-3 bg-gradient-to-t from-[#120A1F] via-[#120A1F] to-transparent"
        style={{ paddingBottom: 'calc(var(--gp-safe-bottom) + 5rem)' }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2 items-end"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={t('coach.placeholder')}
            className="gp-input flex-1 resize-none max-h-32"
            disabled={streaming}
            aria-label={t('coach.placeholder')}
          />
          <button
            type="submit"
            className="gp-btn !px-4 shrink-0"
            disabled={streaming || !input.trim()}
            aria-label={t('coach.send')}
          >
            {streaming ? '···' : '↑'}
          </button>
        </form>

        <p className="text-dim/60 text-[10px] text-center mt-2 leading-relaxed">
          {t('coach.medicalDisclaimer')}
        </p>
      </div>
    </main>
  );
}
