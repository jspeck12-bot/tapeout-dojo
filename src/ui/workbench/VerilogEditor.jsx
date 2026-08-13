import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import { canHostEditor } from './dom.js';
import { buildEditorExtensions, combinedCompletions, errorExtensions } from './extensions.js';

function portsKey(ports) {
  return (ports || []).map((p) => `${p.n}:${p.d}:${p.w}`).join(',');
}

function errKey(errLines) {
  if (!errLines) return '';
  const arr = errLines instanceof Set ? [...errLines] : [...errLines];
  return arr.sort((a, b) => a - b).join(',');
}

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
  errLines,
  ports,
  'aria-label': ariaLabel = 'Verilog workbench editor',
  onReady,
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const errCompRef = useRef(null);
  const portsCompRef = useRef(null);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    const host = hostRef.current;
    if (!canHostEditor(host)) {
      onReady && onReady(false);
      return undefined;
    }

    errCompRef.current = new Compartment();
    portsCompRef.current = new Compartment();

    const extensions = buildEditorExtensions({
      readOnly,
      errLines,
      ports,
      errCompartment: errCompRef.current,
      portsCompartment: portsCompRef.current,
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
    // Mount once; doc / markers sync handled below.
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

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !errCompRef.current) return;
    view.dispatch({
      effects: errCompRef.current.reconfigure(errorExtensions(errLines)),
    });
  }, [errLines, errKey(errLines)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !portsCompRef.current) return;
    view.dispatch({
      effects: portsCompRef.current.reconfigure(
        autocompletion({
          override: [(ctx) => combinedCompletions(ctx, ports)],
          activateOnTyping: true,
        }),
      ),
    });
  }, [ports, portsKey(ports)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`sg-cm-host${className ? ` ${className}` : ''}${errLines && (errLines.size || errLines.length) ? ' is-errored' : ''}`}
      ref={hostRef}
      role="group"
      aria-label={ariaLabel}
      data-err-lines={errKey(errLines) || undefined}
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
