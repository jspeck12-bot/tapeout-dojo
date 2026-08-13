function Tabs({ tabs, value, onChange, 'aria-label': ariaLabel = 'sections' }) {
  return (
    <div className="sg-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const id = tab.id || tab;
        const label = tab.label || tab;
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`sg-tab${active ? ' is-active' : ''}`}
            onClick={() => onChange && onChange(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
