/**
 * Diegetic fab panel — brass corner brackets, token-driven surface.
 * No raw hex in this component.
 */
function Panel({
  title,
  children,
  tight = false,
  wide = false,
  className = '',
  as: Tag = 'section',
  ...rest
}) {
  const sizeClass = tight ? ' sg-panel--tight' : wide ? ' sg-panel--wide' : '';
  const classes = `sg-panel${sizeClass}${className ? ` ${className}` : ''}`;
  return (
    <Tag className={classes} {...rest}>
      <span className="sg-panel__brackets" aria-hidden="true" />
      {title ? <h2 className="sg-panel__title">{title}</h2> : null}
      <div className="sg-panel__body">{children}</div>
    </Tag>
  );
}

export { Panel };
