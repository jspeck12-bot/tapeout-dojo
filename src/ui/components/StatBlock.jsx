function StatBlock({ label, value, tone = 'default', delta, className = '' }) {
  const toneClass = tone === 'default' ? '' : ` sg-stat--${tone}`;
  const down = typeof delta === 'number' ? delta < 0 : String(delta || '').startsWith('−') || String(delta || '').startsWith('-');
  return (
    <div className={`sg-stat${toneClass}${className ? ` ${className}` : ''}`}>
      {label ? <div className="sg-stat__label">{label}</div> : null}
      <div className="sg-stat__value">{value}</div>
      {delta != null && delta !== '' ? (
        <div className={`sg-stat__delta${down ? ' is-down' : ''}`}>{delta}</div>
      ) : null}
    </div>
  );
}

export { StatBlock };
