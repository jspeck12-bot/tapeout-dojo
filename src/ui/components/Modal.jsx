import { Panel } from './Panel.jsx';

function Modal({ children, onClose, title, width = 560, labelledBy }) {
  return (
    <div className="sg-modal" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="sg-modal__panel"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <Panel title={title} wide>
          {children}
        </Panel>
      </div>
    </div>
  );
}

export { Modal };
