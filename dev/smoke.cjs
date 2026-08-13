'use strict';
// ============================================================
// GATE · SMOKE — real <App/> tree, menu, no-WebGL fallback.
// ============================================================
const shared = require('./_shared.cjs');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function textOf(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return textOf(node.children);
}
function findClickable(node, label) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const c of node) { const f = findClickable(c, label); if (f) return f; }
    return null;
  }
  const kids = node.children;
  if (kids) {
    const arr = Array.isArray(kids) ? kids : [kids];
    for (const c of arr) { const f = findClickable(c, label); if (f) return f; }
  }
  if (node.props && typeof node.props.onClick === 'function' && textOf(node).includes(label)) {
    return node.props.onClick;
  }
  return null;
}

async function run() {
  shared.installDom();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const TR = require('react-test-renderer');
  const act = TR.act;
  const m = shared.loadMod();
  let checks = 0;

  let root;
  act(() => { root = TR.create(React.createElement(m.App)); });
  for (let i = 0; i < 6; i++) { await act(async () => { await Promise.resolve(); }); }

  const menuText = textOf(root.toJSON());
  for (const marker of ['TAPEOUT', 'NEW GAME', 'CONTINUE', 'SETTINGS']) {
    assert(menuText.includes(marker), `menu missing "${marker}"`);
    checks++;
  }

  const onContinue = findClickable(root.toJSON(), 'CONTINUE');
  assert(typeof onContinue === 'function', 'could not find CONTINUE button');
  act(() => { onContinue(); });
  for (let i = 0; i < 4; i++) { await act(async () => { await Promise.resolve(); }); }

  const screenText = textOf(root.toJSON());
  assert(screenText.includes('NO WEBGL'), 'no-WebGL fallback did not render after entering a 3D world');
  checks++;

  act(() => { root.unmount(); });
  checks++;

  return checks;
}

module.exports = { run };

if (require.main === module) {
  run().then((n) => {
    console.log(`smoke OK · ${n} checks`);
    process.exit(0);
  }).catch((e) => {
    console.error('smoke FAIL: ' + e.message);
    process.exit(1);
  });
}
