function Badge({ children, tone = 'default', className = '' }) {
  const toneClass = tone === 'default' ? '' : ` sg-badge--${tone}`;
  return <span className={`sg-badge${toneClass}${className ? ` ${className}` : ''}`}>{children}</span>;
}

export { Badge };
