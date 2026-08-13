// Shared CodeMirror 6 extension stack for the Silicon Gothic workbench.
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
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
  gutter,
  GutterMarker,
  Decoration,
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

function lineSet(errLines) {
  if (!errLines) return new Set();
  if (errLines instanceof Set) return errLines;
  return new Set(errLines);
}

class ErrorGutterMarker extends GutterMarker {
  eq() { return true; }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-err-mark';
    span.textContent = '◈';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
}

const ERR_MARK = new ErrorGutterMarker();

function errorGutter(errLines) {
  const lines = lineSet(errLines);
  return gutter({
    class: 'cm-errorGutter',
    lineMarker(view, line) {
      const n = view.state.doc.lineAt(line.from).number;
      return lines.has(n) ? ERR_MARK : null;
    },
  });
}

const ERROR_LINE = Decoration.line({ class: 'cm-errorLine' });

function errorLineHighlight(errLines) {
  const lines = lineSet(errLines);
  return EditorView.decorations.of((view) => {
    const builder = new RangeSetBuilder();
    const nums = [...lines].filter((n) => n >= 1 && n <= view.state.doc.lines).sort((a, b) => a - b);
    for (const n of nums) {
      const line = view.state.doc.line(n);
      builder.add(line.from, line.from, ERROR_LINE);
    }
    return builder.finish();
  });
}

function errorExtensions(errLines) {
  return [errorGutter(errLines), errorLineHighlight(errLines)];
}

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

function portCompletionItems(ports) {
  return (ports || []).map((p) => ({
    label: p.n,
    type: 'variable',
    detail: `${p.d === 'in' ? 'in' : 'out'} ${p.w > 1 ? `[${p.w - 1}:0]` : '1'}`,
    boost: 6,
  }));
}

function combinedCompletions(context, ports) {
  const word = context.matchBefore(/[A-Za-z_][\w$]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const base = verilogCompletions(context) || {
    from: word.from,
    options: [],
    validFor: /^[\w$]*$/,
  };
  return {
    ...base,
    options: [...portCompletionItems(ports), ...base.options],
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

function completionExt(ports) {
  return autocompletion({
    override: [(ctx) => combinedCompletions(ctx, ports)],
    activateOnTyping: true,
  });
}

/**
 * Build the editable workbench extensions.
 * @param {{ onRun?: () => void, onChange?: (doc: string) => void, readOnly?: boolean, errLines?: Set<number>|number[], ports?: {n:string,d:string,w:number}[], errCompartment?: import('@codemirror/state').Compartment, portsCompartment?: import('@codemirror/state').Compartment }} opts
 */
function buildEditorExtensions(opts = {}) {
  const {
    onRun,
    onChange,
    readOnly = false,
    errLines,
    ports,
    errCompartment,
    portsCompartment,
  } = opts;
  const updateListener = onChange
    ? [
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
    ]
    : [];

  const errExt = errorExtensions(errLines);
  const portExt = completionExt(ports);

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
    errCompartment ? errCompartment.of(errExt) : errExt,
    portsCompartment ? portsCompartment.of(portExt) : portExt,
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
  combinedCompletions,
  portCompletionItems,
  errorExtensions,
  errorGutter,
  VERILOG_SNIPPETS,
};
