/**
 * A single oversized statistic.
 *
 * Used for the headline numbers (streak, minutes, sessions) and for live values
 * during a workout. Numerals are tabular so a counting timer doesn't make the
 * layout twitch on every tick.
 */
export default function BigStat({ value, label, icon, tone = 'default', size = 'md' }) {
  const sizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-mega',
    xl: 'text-giga',
  };
  const tones = {
    default: 'text-ink',
    flame: 'gp-gradient-text',
    cyan: 'text-cyan',
    dim: 'text-dim',
  };

  return (
    <div className="gp-card p-4 text-center">
      {icon && (
        <div className="text-lg mb-1" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className={`gp-num ${sizes[size]} ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-dim mt-1 font-bold">{label}</div>
    </div>
  );
}
