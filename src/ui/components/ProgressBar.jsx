function ProgressBar({
  value = 0,
  tone = 'cyan',
  size = 'md',
  label,
  className = '',
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const sizeClass = size === 'sm' ? ' sg-progress--sm' : '';
  return (
    <div
      className={`sg-progress sg-progress--${tone}${sizeClass}${className ? ` ${className}` : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="sg-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export { ProgressBar };
