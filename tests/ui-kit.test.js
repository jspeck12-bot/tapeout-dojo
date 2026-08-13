import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test } from 'vitest';
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, TOKEN_CSS, TOKENS } from '../src/ui/tokens.js';
import { Button } from '../src/ui/components/Button.jsx';
import { Panel } from '../src/ui/components/Panel.jsx';
import { Badge } from '../src/ui/components/Badge.jsx';
import { ProgressBar } from '../src/ui/components/ProgressBar.jsx';
import { UiKitScreen } from '../src/ui/UiKitScreen.jsx';

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx|css)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const { createElement: h } = React;

describe('Silicon Gothic UI kit', () => {
  test('exports a complete token map and self-hosted faces', () => {
    expect(TOKENS.color.brass).toMatch(/^#/);
    expect(TOKENS.color.cyan).toMatch(/^#/);
    expect(FONT_DISPLAY).toContain('Oxanium');
    expect(FONT_BODY).toContain('IBM Plex Sans');
    expect(FONT_MONO).toContain('JetBrains Mono');
    expect(FONT_DISPLAY).not.toContain('Segoe');
    expect(FONT_MONO).not.toContain('Cascadia');
    expect(TOKEN_CSS).toContain('@font-face');
    expect(TOKEN_CSS).toContain('fonts/oxanium-600.woff2');
    expect(TOKEN_CSS).toContain('fonts/jetbrains-mono-400.woff2');
    expect(TOKEN_CSS).toContain('fonts/ibm-plex-sans-400.woff2');
    expect(TOKEN_CSS).not.toContain('fonts.googleapis.com');
    expect(TOKEN_CSS).not.toContain('ui-monospace');
    expect(TOKEN_CSS).toContain('--sg-font-body:');
    expect(TOKEN_CSS).toContain('.sg-btn--primary');
    expect(TOKEN_CSS).toContain('.sg-panel');
    expect(TOKEN_CSS).toContain('.sg-menu-row');
    expect(TOKEN_CSS).toContain('.sg-badge');
    expect(TOKEN_CSS).toContain('.sg-progress');
    expect(TOKEN_CSS).toContain('.sg-modal');
    expect(TOKEN_CSS).toContain('.sg-toast');
    expect(TOKEN_CSS).toContain('--sg-motion-enter:');
    expect(TOKEN_CSS).toContain('prefers-reduced-motion');
    expect(TOKEN_CSS).toContain('font-variant-ligatures');
    expect(TOKEN_CSS).toContain('.sg-header');
    expect(TOKEN_CSS).toContain('.sg-enter');
    expect(TOKEN_CSS).toContain('.sg-btn:hover');
    expect(TOKEN_CSS).toContain('.sg-btn:focus-visible');
    expect(TOKEN_CSS).toContain('.sg-btn:disabled');
  });

  test('src has no system font stacks or lucide-react imports', () => {
    const root = path.resolve(fileURLToPath(new URL('../src', import.meta.url)));
    const files = walk(root);
    const banned = /ui-monospace|Segoe UI|Cascadia|Menlo|Consolas|SFMono-Regular|system-ui|from ['"]lucide-react['"]/;
    const hits = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (banned.test(text)) hits.push(path.relative(root, file));
    }
    expect(hits).toEqual([]);
  });

  test('Button and Panel render with token classes and no inline hex colors', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        h(Panel, { title: 'Bay' },
          h(Button, { variant: 'primary' }, 'run'),
          h(Button, { variant: 'brass', size: 'sm' }, 'forge'),
          h(Badge, { tone: 'cyan' }, 'lot'),
          h(ProgressBar, { value: 67, label: 'yield' }),
        ),
      );
    });
    const json = tree.toJSON();
    expect(json.props.className).toContain('sg-panel');
    const html = JSON.stringify(json);
    expect(html).toContain('sg-btn--primary');
    expect(html).toContain('sg-btn--brass');
    expect(html).toContain('sg-btn--sm');
    expect(html).toContain('sg-badge--cyan');
    expect(html).toContain('sg-progress');
    expect(html).not.toMatch(/style":\{[^}]*#[0-9a-fA-F]{3,8}/);
  });

  test('UiKitScreen exposes data-uikit-status and kit copy', async () => {
    let root;
    await act(async () => {
      root = TestRenderer.create(h(UiKitScreen, { go: () => {} }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    const json = root.toJSON();
    expect(json.props['data-uikit-status']).toBe('ready');
    expect(json.props.className).toContain('sg-ui');
    const text = JSON.stringify(json);
    expect(text).toContain('TAPEOUT');
    expect(text).toContain('Color tokens');
    expect(text).toContain('Buttons');
    expect(text).toContain('JetBrains Mono');
    expect(text).toContain('IBM Plex Sans');
    expect(text).toContain('ProgressBar');
  });
});
