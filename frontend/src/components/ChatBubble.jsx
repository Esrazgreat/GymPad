import { useI18n } from '../i18n/index.jsx';

/**
 * One chat message.
 *
 * Coach replies render very light markdown — **bold** and line breaks only.
 * That's deliberate: the emergency reply uses **bold** for the phone numbers,
 * and a full markdown parser is a lot of bundle for two features.
 */

function renderInline(text) {
  // Split on **bold** and rebuild as React nodes. No dangerouslySetInnerHTML —
  // this content comes from a model and must never be able to inject markup.
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      return (
        <strong key={i} className="text-gold font-black">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{chunk}</span>;
  });
}

export default function ChatBubble({ role, content, streaming = false, emergency = false }) {
  const { t } = useI18n();
  const isUser = role === 'user';

  const base = 'max-w-[85%] rounded-card px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words';
  const skin = isUser
    ? 'bg-flame text-[#1a0d08] font-semibold rounded-br-md'
    : emergency
      ? 'bg-danger/15 border border-danger/60 text-ink rounded-bl-md'
      : 'gp-card rounded-bl-md';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-riseIn`}>
      <div className={`${base} ${skin}`}>
        {emergency && (
          <div className="flex items-center gap-2 mb-2 text-danger font-black text-sm uppercase tracking-wide">
            <span aria-hidden="true">⚠️</span>
            {t('emergency.title')}
          </div>
        )}

        {content.split('\n').map((line, i) => (
          <div key={i} className={line.trim() === '' ? 'h-3' : undefined}>
            {renderInline(line)}
          </div>
        ))}

        {streaming && (
          <span
            className="inline-block w-2 h-4 ml-0.5 align-middle bg-gold animate-pulse rounded-sm"
            aria-label={t('coach.thinking')}
          />
        )}
      </div>
    </div>
  );
}
