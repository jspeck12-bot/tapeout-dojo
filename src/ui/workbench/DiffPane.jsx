import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { unifiedMergeView } from '@codemirror/merge';
import { canHostEditor } from './dom.js';
import { buildEditorExtensions } from './extensions.js';

/**
 * Unified diff against `original` using @codemirror/merge.
 * Read-only presentation of draft vs reference (solution / starter).
 */
function DiffPane({
  value,
  original,
  minHeight = 240,
  className = '',
  'aria-label': ariaLabel = 'Verilog solution diff',
  onReady,
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!canHostEditor(host)) {
      onReady && onReady(false);
      return undefined;
    }

    const extensions = [
      ...buildEditorExtensions({ readOnly: true }),
      unifiedMergeView({
        original: original || '',
        highlightChanges: true,
        gutter: true,
        mergeControls: false,
      }),
      EditorView.editable.of(false),
    ];

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
    // Remount when the baseline changes; draft syncs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

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
      className={`sg-cm-diff${className ? ` ${className}` : ''}`}
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

export { DiffPane };
