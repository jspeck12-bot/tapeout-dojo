/**
 * Silicon Gothic button — styles come only from token CSS variables / classes.
 * No raw hex in this component.
 */
function Button({
  children,
  variant = 'default',
  size = 'md',
  disabled = false,
  type = 'button',
  className = '',
  icon = null,
  onClick,
  ...rest
}) {
  const variantClass = variant === 'default' ? '' : ` sg-btn--${variant}`;
  const sizeClass = size === 'md' ? '' : ` sg-btn--${size}`;
  const classes = `sg-btn${variantClass}${sizeClass}${className ? ` ${className}` : ''}`;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export { Button };
