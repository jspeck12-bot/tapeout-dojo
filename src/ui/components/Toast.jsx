function Toast({ title, sub, tone = 'cyan' }) {
  return (
    <div className={`sg-toast${tone === 'brass' ? ' sg-toast--brass' : ''}`} role="status">
      <div className="sg-toast__title">{title}</div>
      {sub ? <div className="sg-toast__sub">{sub}</div> : null}
    </div>
  );
}

function ToastStack({ items = [] }) {
  return (
    <div className="sg-toast-stack">
      {items.map((t) => (
        <Toast key={t.id} title={t.title} sub={t.sub} tone={t.kind === 'ach' ? 'brass' : 'cyan'} />
      ))}
    </div>
  );
}

export { Toast, ToastStack };
