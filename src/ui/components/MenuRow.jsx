/**
 * Wide main-menu action row — token classes only, no raw hex.
 */
import { ChevronMark } from './icons.jsx';

function MenuRow({
  title,
  hint,
  icon = null,
  variant = 'default',
  disabled = false,
  type = 'button',
  className = '',
  onClick,
  ...rest
}) {
  const variantClass = variant === 'default' ? '' : ` sg-menu-row--${variant}`;
  const classes = `sg-menu-row${variantClass}${className ? ` ${className}` : ''}`;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {icon ? <span className="sg-menu-row__ico">{icon}</span> : null}
      <span className="sg-menu-row__copy">
        <span className="sg-menu-row__title">{title}</span>
        {hint ? <span className="sg-menu-row__hint">{hint}</span> : null}
      </span>
      <span className="sg-menu-row__chev" aria-hidden="true">
        <ChevronMark size={14} />
      </span>
    </button>
  );
}

export { MenuRow };
