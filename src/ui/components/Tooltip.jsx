function Tooltip({ label, children }) {
  return (
    <span className="sg-tooltip">
      {children}
      <span className="sg-tooltip__tip" role="tooltip">{label}</span>
    </span>
  );
}

export { Tooltip };
