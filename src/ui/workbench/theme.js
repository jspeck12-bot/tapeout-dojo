// Silicon Gothic CodeMirror 6 theme — colors from UI tokens (not raw JSX hex).
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { TOKENS } from '../tokens.js';

const C = TOKENS.color;

const siliconGothicTheme = EditorView.theme(
  {
    '&': {
      color: C.ink,
      backgroundColor: C.bgDeep,
      fontSize: '13.5px',
      fontFamily: TOKENS.font.mono,
    },
    '.cm-content': {
      caretColor: C.cyan,
      fontFamily: TOKENS.font.mono,
      lineHeight: '1.55',
      padding: '10px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: C.cyan,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, ' + C.cyanDeep + ' 32%, transparent)',
    },
    '.cm-panels': {
      backgroundColor: C.bgPanel,
      color: C.inkMuted,
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid ' + C.line,
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid ' + C.line,
    },
    '.cm-searchMatch': {
      backgroundColor: 'color-mix(in srgb, ' + C.brass + ' 28%, transparent)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'color-mix(in srgb, ' + C.brass + ' 48%, transparent)',
    },
    '.cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, ' + C.bgHover + ' 70%, transparent)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'color-mix(in srgb, ' + C.cyan + ' 14%, transparent)',
    },
    '.cm-gutters': {
      backgroundColor: C.bg,
      color: C.inkDim,
      border: 'none',
      borderRight: '1px solid ' + C.line,
      fontFamily: TOKENS.font.mono,
    },
    '.cm-activeLineGutter': {
      backgroundColor: C.bgElevated,
      color: C.brass,
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 10px 0 8px',
      minWidth: '2.4em',
    },
    '.cm-foldGutter .cm-gutterElement': {
      color: C.inkDim,
    },
    '.cm-tooltip': {
      backgroundColor: C.bgPanel,
      color: C.ink,
      border: '1px solid ' + C.lineStrong,
      borderRadius: TOKENS.radius.md,
      fontFamily: TOKENS.font.mono,
      fontSize: '12.5px',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: C.bgHover,
        color: C.cyan,
      },
    },
    '.cm-completionLabel': {
      fontFamily: TOKENS.font.mono,
    },
    '.cm-completionDetail': {
      color: C.inkDim,
      fontStyle: 'normal',
    },
    '.cm-diagnostic-error': {
      borderLeftColor: C.danger,
    },
    '.cm-scroller': {
      fontFamily: TOKENS.font.mono,
      outline: 'none',
    },
    '&.cm-focused': {
      outline: '2px solid ' + C.focus,
      outlineOffset: '1px',
    },
    // Merge / diff
    '.cm-changedLine': {
      backgroundColor: 'color-mix(in srgb, ' + C.cyanDeep + ' 12%, transparent)',
    },
    '.cm-deletedChunk': {
      backgroundColor: 'color-mix(in srgb, ' + C.danger + ' 10%, transparent)',
    },
    '.cm-inlineChanged': {
      backgroundColor: 'color-mix(in srgb, ' + C.brass + ' 22%, transparent)',
    },
  },
  { dark: true },
);

const siliconGothicHighlight = HighlightStyle.define([
  { tag: t.keyword, color: C.cyan },
  { tag: t.atom, color: C.brass },
  { tag: t.bool, color: C.brass },
  { tag: t.number, color: C.ok },
  { tag: t.string, color: C.ok },
  { tag: t.comment, color: C.inkDim, fontStyle: 'italic' },
  { tag: t.variableName, color: C.ink },
  { tag: t.definition(t.variableName), color: C.ink },
  { tag: t.operator, color: C.inkMuted },
  { tag: t.punctuation, color: C.inkMuted },
  { tag: t.typeName, color: C.brass },
  { tag: t.meta, color: C.inkDim },
  { tag: t.invalid, color: C.danger },
]);

const siliconGothicHighlightExt = syntaxHighlighting(siliconGothicHighlight);

export { siliconGothicTheme, siliconGothicHighlight, siliconGothicHighlightExt, C as THEME_COLORS };
