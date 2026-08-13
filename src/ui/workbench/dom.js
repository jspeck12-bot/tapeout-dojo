/** True when the node can parent a CodeMirror EditorView. */
function canHostEditor(node) {
  return !!(
    node
    && typeof document !== 'undefined'
    && typeof node.appendChild === 'function'
    && typeof HTMLElement !== 'undefined'
    && (node instanceof HTMLElement || node.nodeType === 1)
  );
}

export { canHostEditor };
