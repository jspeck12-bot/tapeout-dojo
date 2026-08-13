function ListRow({
  title,
  hint,
  meta,
  active = false,
  equipped = false,
  disabled = false,
  onClick,
  className = '',
  ...rest
}) {
  const cls = [
    'sg-list-row',
    active ? 'is-active' : '',
    equipped ? 'is-equipped' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={disabled} onClick={onClick} {...rest}>
      <span className="sg-list-row__copy">
        <span className="sg-list-row__title">{title}</span>
        {hint ? <span className="sg-list-row__hint">{hint}</span> : null}
      </span>
      {meta != null ? <span className="sg-list-row__meta">{meta}</span> : null}
    </button>
  );
}

export { ListRow };
