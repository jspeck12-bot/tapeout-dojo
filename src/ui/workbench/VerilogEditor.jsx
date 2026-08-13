import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { canHostEditor } from './dom.js';
import { buildEditorExtensions } from './extensions.js';

/**
 * CodeMirror 6 Verilog editor — gutters, Silicon Gothic theme, autocomplete.
 * Falls back silently under react-test-renderer (no real DOM host).
 */
function VerilogEditor({
  value,
  onChange,
  onRun,
  readOnly = false,
  minHeight = 280,
  className = '',
  'aria-label': ariaLabel = 'Verilog workbench editor',
  onReady,
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    const host = hostRef.current;
    if (!canHostEditor(host)) {
      onReady && onReady(false);
      return undefined;
    }

    const extensions = buildEditorExtensions({
      readOnly,
      onChange: (doc) => {
        if (onChangeRef.current) onChangeRef.current(doc);
      },
      onRun: () => {
        if (onRunRef.current) onRunRef.current();
      },
    });

    const state = EditorState.create({
      doc: value || '',
      extensions,
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    onReady && onReady(true);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; doc sync handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value || '' },
      });
    }
  }, [value]);

  return (
    <div
      className={`sg-cm-host${className ? ` ${className}` : ''}`}
      ref={hostRef}
      role="group"
      aria-label={ariaLabel}
      style={{
        minHeight,
        borderRadius: 'var(--sg-radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--sg-line)',
        background: 'var(--sg-bg-deep)',
      }}
    />
  );
}

export { VerilogEditor };
