// Shared CodeMirror 6 extension stack for the Silicon Gothic workbench.
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { V_KEYWORDS } from '../../engine/verilog.js';
import { siliconGothicHighlightExt, siliconGothicTheme } from './theme.js';

const VERILOG_SNIPPETS = [
  {
    label: 'module',
    type: 'keyword',
    detail: 'module … endmodule',
    apply: 'module name (\n  input  wire a,\n  output wire y\n);\n  \nendmodule',
  },
  { label: 'always_comb', type: 'keyword', detail: 'always @(*)', apply: 'always @(*) begin\n  \nend' },
  { label: 'always_ff', type: 'keyword', detail: 'posedge clk', apply: 'always @(posedge clk) begin\n  \nend' },
  { label: 'assign', type: 'keyword', detail: 'continuous assign', apply: 'assign y = ' },
  {
    label: 'case',
    type: 'keyword',
    detail: 'case … endcase',
    apply: "case (sel)\n  2'b00: y = a;\n  default: y = 0;\nendcase",
  },
];

function verilogCompletions(context) {
  const word = context.matchBefore(/[A-Za-z_][\w$]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const options = [];
  for (const kw of V_KEYWORDS) {
    options.push({ label: kw, type: 'keyword', detail: 'verilog' });
  }
  for (const snip of VERILOG_SNIPPETS) {
    options.push({ ...snip, boost: 1 });
  }
  return {
    from: word.from,
    options,
    validFor: /^[\w$]*$/,
  };
}

const verilogLanguage = StreamLanguage.define(verilog);

function runKeymap(onRun) {
  if (!onRun) return [];
  return [
    keymap.of([
      {
        key: 'Mod-Enter',
        run: () => {
          onRun();
          return true;
        },
      },
    ]),
  ];
}

/**
 * Build the editable workbench extensions.
 * @param {{ onRun?: () => void, onChange?: (doc: string) => void, readOnly?: boolean }} opts
 */
function buildEditorExtensions(opts = {}) {
  const { onRun, onChange, readOnly = false } = opts;
  const updateListener = onChange
    ? [
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
    ]
    : [];

  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    highlightSelectionMatches(),
    history(),
    indentOnInput(),
    bracketMatching(),
    verilogLanguage,
    siliconGothicTheme,
    siliconGothicHighlightExt,
    autocompletion({ override: [verilogCompletions], activateOnTyping: true }),
    keymap.of([
      ...completionKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...defaultKeymap,
      indentWithTab,
    ]),
    ...runKeymap(onRun),
    ...updateListener,
    EditorState.readOnly.of(!!readOnly),
    EditorView.lineWrapping,
  ];
}

export {
  buildEditorExtensions,
  verilogLanguage,
  verilogCompletions,
  VERILOG_SNIPPETS,
};
