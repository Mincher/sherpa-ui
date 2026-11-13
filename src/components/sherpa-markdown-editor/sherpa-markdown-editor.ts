/**
 * sherpa-markdown-editor — a Markdown text, edited as it reads. The TEXT is the model: the formatted view draws it, each
 * mark its own hidden part, so the DOM's text is the Markdown and a caret is one offset in it. Every edit is the text's
 * (`markdown-text.ts`); the browser's own is read back only where it cannot be stopped (an IME). Plan 892.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';
import { primaryKey, primaryLabel } from '../../core/ui/modifier-key.js';
import {
  HIDDEN_MARKS, breakLine, deleteBack, deleteForward, formatAt, indentItems, insertComment, insertImage, insertTable,
  insertValue, readMarkdown, setStyle, toggleLink, toggleList, toggleSpan, typeText,
  type MdEdit, type MdLine, type MdPart, type TextStyle,
} from '../../core/data/markdown-text.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-group/sherpa-group.js';
import '../sherpa-menu/sherpa-menu.js';

/** A point in the DOM: a node and an offset in it. */
type Point = [Node, number];

/** One step of the history: the text, and the selection in it. */
type Step = MdEdit;

/** A drawn span, by the range of the text it holds: its marks show while the caret is in it. */
interface Drawn { el: HTMLElement; from: number; to: number }

/** Typing within this long of the last keystroke, where it left off, is one step to undo. */
const TYPING_MS = 1000;

const TEXT_NODE = 3;

export class SherpaMarkdownEditor extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-text-area.css', import.meta.url),
    new URL('./sherpa-markdown-editor.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-markdown-editor.html', import.meta.url);

  static override props = {
    'data-label': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-error': { type: 'string', kind: 'content' },
    'data-view': { type: 'enum', kind: 'behaviour', values: ['formatted', 'markdown'] },
    'data-help-href': { type: 'string', kind: 'behaviour' },
    'data-single-line': { type: 'boolean', kind: 'behaviour' },
  } as const;

  /** A form cannot see inside a shadow root: the host takes part for it. */
  static readonly formAssociated = true;

  // A host label names the box.
  static override labelTarget = '.content';
  static override observed = ['value', 'placeholder', 'name', 'required', 'disabled', 'readonly', 'data-view', 'data-help-href'];

  /** The Markdown; null until a host or the `value` attribute gives one. */
  #text: string | null = null;
  /** The selection, as offsets in the text: kept while focus is in the toolbar. */
  #sel = { start: 0, end: 0 };
  /** The text read as lines: what is drawn. */
  #lines: MdLine[] = [];
  /** The text `#lines` were read from. */
  #linesOf: string | null = null;
  /** Each span drawn, by the range it holds. */
  #spans: Drawn[] = [];
  /** The steps Undo takes back, the last last. */
  #undo: Step[] = [];
  /** The steps Redo makes again. */
  #redo: Step[] = [];
  /** When and where the last keystroke left off: the next within reach is the same step. */
  #typed: { at: number; caret: number } | null = null;
  /** The text when focus came in: `change` when it leaves, if the text moved. */
  #held: string | null = null;
  /** An IME is composing: the browser edits, and the text is read back at its end. */
  #composing = false;
  /** Each value's words, by its key. */
  #labels: Readonly<Record<string, string>> = {};

  /** The Markdown text. A write says nothing, and starts the history again. */
  get value(): string {
    return this.#text ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    this.#reset(String(v ?? ''));
  }

  /** Each value's words, by its key: a chip reads them; a value with none reads its key. */
  get valueLabels(): Readonly<Record<string, string>> {
    return this.#labels;
  }
  set valueLabels(labels: Readonly<Record<string, string>>) {
    this.#labels = { ...labels };
    this.#draw();
  }

  /** Put a value at the caret — over the selection — as typed: `input` goes out. */
  insertValue(key: string): void {
    if (this.#off()) return;
    const { start, end } = this.#readSel();
    this.#commit(insertValue(this.value, start, end, key));
    this.focus();
  }

  /** The box takes the focus, in the view shown. */
  override focus(options?: FocusOptions): void {
    (this.#markdown() ? this.$('.source') : this.$('.content'))?.focus(options);
    this.#place();
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(on: boolean) {
    this.toggleAttribute('disabled', on);
  }

  override onRender(): void {
    this.#text ??= this.getAttribute('value') ?? '';
    this.#sel = { start: this.#text.length, end: this.#text.length };
    toolbarKeys(this.$('.bar')!);
    // The tips name the primary key: ⌘ on a Mac, Ctrl elsewhere.
    for (const tool of this.$$('[data-tip*="Ctrl"]')) tool.setAttribute('data-tip', tool.getAttribute('data-tip')!.replaceAll('Ctrl', primaryLabel));
    const content = this.$('.content')!;
    const source = this.$<HTMLTextAreaElement>('.source')!;
    content.addEventListener('beforeinput', this.#onBeforeInput);
    content.addEventListener('input', this.#onNativeInput);
    content.addEventListener('compositionstart', () => { this.#composing = true; });
    content.addEventListener('compositionend', () => { this.#composing = false; this.#readBack(); });
    content.addEventListener('paste', this.#onPaste);
    for (const type of ['copy', 'cut']) content.addEventListener(type, this.#onCopy as EventListener);
    // A drag would move text the editor cannot follow: not yet (plan 892, later).
    for (const type of ['dragstart', 'drop']) content.addEventListener(type, (event) => event.preventDefault());
    for (const box of [content, source]) {
      box.addEventListener('keydown', this.#onKey as EventListener);
      box.addEventListener('focus', this.#onFocus);
    }
    source.addEventListener('beforeinput', this.#onSourceBefore as EventListener);
    source.addEventListener('input', this.#onSourceInput);
    source.addEventListener('select', this.#readSource);
    source.addEventListener('keyup', this.#readSource);
    source.addEventListener('pointerup', this.#readSource);
    this.$('.label')?.addEventListener('click', () => this.focus());
    this.$('.bar')!.addEventListener('button-click', this.#onTool);
    this.$('.styles')!.addEventListener('menu-select', this.#onStyle);
    // Focus leaving the editor: its change, as a field's. Inside it — the toolbar — is still the editor.
    this.addEventListener('focusout', this.#onLeave);
    this.#syncAttrs();
    this.#draw();
  }

  /** The caret is the document's to tell: heard while connected, so a moved editor hears it again. */
  override onConnect(): void {
    this.on(document, 'selectionchange', this.#onSelection);
  }

  override onChange(name: string): void {
    if (name === 'value') {
      if (this.getAttribute('value') !== this.#text) this.#reset(this.getAttribute('value') ?? '');
      return;
    }
    if (name === 'data-view') this.#showView();
    this.#syncAttrs();
  }

  /* ── The text ───────────────────────────────────────────────────────── */

  /** A new text, from outside: its history starts again, and nothing is said. */
  #reset(text: string): void {
    this.#text = text;
    this.#undo = [];
    this.#redo = [];
    this.#typed = null;
    this.#sel = { start: text.length, end: text.length };
    this.#draw();
  }

  /** An edit: kept in the history, drawn, the selection put back, and said as `input`. */
  #commit(edit: MdEdit, typing = false): void {
    const was = this.value;
    if (edit.text === was) {
      this.#sel = { start: edit.start, end: edit.end };
      this.#open();
      this.#place();
      this.#syncTools();
      return;
    }
    // Typing on from where the last keystroke left off, soon after it, is the same step.
    const now = Date.now();
    const goesOn = typing && this.#typed && now - this.#typed.at < TYPING_MS && this.#typed.caret === this.#sel.start;
    if (!goesOn) this.#undo.push({ text: was, start: this.#sel.start, end: this.#sel.end });
    this.#redo = [];
    this.#typed = typing ? { at: now, caret: edit.end } : null;
    this.#text = edit.text;
    this.#sel = { start: edit.start, end: edit.end };
    this.#draw();
    this.emit('input', { value: this.#text });
  }

  /** Undo, or Redo: the step before, or after. */
  #step(back: boolean): void {
    const from = back ? this.#undo : this.#redo;
    const to = back ? this.#redo : this.#undo;
    const step = from.pop();
    if (!step) return;
    to.push({ text: this.value, start: this.#sel.start, end: this.#sel.end });
    this.#typed = null;
    this.#text = step.text;
    this.#sel = { start: step.start, end: step.end };
    this.#draw();
    this.emit('input', { value: this.#text });
  }

  /* ── Drawing ────────────────────────────────────────────────────────── */

  /** Draw the text in the view shown, open the spans the caret is in, put the selection back, and tell the toolbar
   *  and the form. */
  #draw(): void {
    const content = this.$('.content');
    const source = this.$<HTMLTextAreaElement>('.source');
    if (!content || !source || this.#text === null) return;
    const text = this.#text;
    if (source.value !== text) source.value = text;
    this.#read();
    this.#spans = [];
    const tpl = (name: string): HTMLTemplateElement | null => this.$<HTMLTemplateElement>(`template.${name}-tpl`);
    const [line, lead, mark, span, value, gap] = ['line', 'lead', 'mark', 'span', 'value', 'break'].map(tpl);
    const draw = (part: MdPart): Node => {
      const said = text.slice(part.from, part.to);
      if (part.type === 'text') return document.createTextNode(said);
      if (part.type === 'mark') {
        const el = this.clone(mark)!;
        el.textContent = said;
        return el;
      }
      if (part.type === 'value') {
        const el = this.clone(value)!;
        el.dataset['key'] = part.key;
        el.textContent = this.#labels[part.key] ?? part.key.slice(1, -1);
        el.title = part.key;
        return el;
      }
      const el = this.clone(span)!;
      el.dataset['kind'] = part.type;
      if (part.href) el.title = part.href;
      el.append(...part.parts.map(draw));
      this.#spans.push({ el, from: part.from, to: part.to });
      return el;
    };
    content.replaceChildren(...this.#lines.map((l) => {
      const el = this.clone(line)!;
      el.dataset['block'] = l.block;
      if (l.level) el.dataset['level'] = String(l.level);
      if (l.depth) el.dataset['depth'] = String(Math.min(l.depth, 6));
      if (l.block === 'number') el.dataset['number'] = String(l.number);
      if (l.marker) {
        // A heading's, an item's or a quote's mark: its look says it.
        const m = this.clone(lead)!;
        m.textContent = text.slice(l.at, l.at + l.marker);
        el.append(m);
      }
      el.append(...l.parts.map(draw));
      // A line with nothing to show keeps its height, and a place for the caret.
      if (l.end === l.at + l.marker) el.append(this.clone(gap)!);
      return el;
    }));
    this.toggleState('empty', text === '');
    this.#open();
    this.#place();
    this.#syncTools();
    this.#syncForm();
  }

  /** The text's lines, read once a text. */
  #read(): MdLine[] {
    const text = this.value;
    if (this.#linesOf !== text) {
      this.#lines = readMarkdown(text);
      this.#linesOf = text;
    }
    return this.#lines;
  }

  /** Each span the selection's ends stand in shows its marks. */
  #open(): void {
    const { start, end } = this.#sel;
    for (const s of this.#spans) {
      const open = (s.from <= start && start <= s.to) || (s.from <= end && end <= s.to);
      if (s.el.hasAttribute('data-open') !== open) s.el.toggleAttribute('data-open', open);
    }
  }

  /* ── The selection ──────────────────────────────────────────────────── */

  /** Is the Markdown view shown? */
  #markdown(): boolean {
    return this.dataset['view'] === 'markdown';
  }

  /** Is the formatted box where the reader is? */
  #inContent(): boolean {
    return this.root.activeElement === this.$('.content');
  }

  /** The selection in the shadow root, as the engine gives it: its own, a composed range, or the document's. */
  #domSelection(): { anchor: Point; focus: Point } | null {
    const sel = document.getSelection();
    if (!sel) return null;
    const own = (this.root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.();
    if (own?.anchorNode && this.root.contains(own.anchorNode)) return { anchor: [own.anchorNode, own.anchorOffset], focus: [own.focusNode!, own.focusOffset] };
    if (typeof sel.getComposedRanges === 'function') {
      const range = sel.getComposedRanges({ shadowRoots: [this.root] })[0];
      if (range && this.root.contains(range.startContainer)) {
        const start: Point = [range.startContainer, range.startOffset];
        const end: Point = [range.endContainer, range.endOffset];
        return (sel as Selection & { direction?: string }).direction === 'backward' ? { anchor: end, focus: start } : { anchor: start, focus: end };
      }
    }
    if (sel.anchorNode && this.root.contains(sel.anchorNode)) return { anchor: [sel.anchorNode, sel.anchorOffset], focus: [sel.focusNode!, sel.focusOffset] };
    return null;
  }

  /** The selection now: the box's, where the reader is in it; else the one kept. */
  #readSel(): { start: number; end: number } {
    if (this.#markdown()) {
      const source = this.$<HTMLTextAreaElement>('.source')!;
      if (this.root.activeElement === source) this.#sel = { start: source.selectionStart, end: source.selectionEnd };
      return this.#sel;
    }
    const dom = this.#inContent() ? this.#domSelection() : null;
    if (dom) {
      const a = this.#offsetOf(...dom.anchor);
      const f = this.#offsetOf(...dom.focus);
      this.#sel = { start: Math.min(a, f), end: Math.max(a, f) };
    }
    return this.#sel;
  }

  /** A line element's Markdown: its text, each value's key, and a break that is not its last node a new line. */
  #sourceOf(el: Node): string {
    let out = '';
    el.childNodes.forEach((node, i) => {
      if (node.nodeType === TEXT_NODE) out += (node as Text).data;
      else if (node instanceof HTMLElement && node.classList.contains('value')) out += node.dataset['key'] ?? '';
      else if (node instanceof HTMLBRElement) out += i < el.childNodes.length - 1 ? '\n' : '';
      else out += this.#sourceOf(node);
    });
    return out;
  }

  /** How much Markdown stands in a line before a DOM point; a point in a value stands after it. */
  #before(line: Element, node: Node, offset: number): number {
    let n = 0;
    let done = false;
    const visit = (el: Node): void => {
      const kids = el.childNodes;
      for (let k = 0; k < kids.length && !done; k++) {
        if (el === node && k === offset) { done = true; return; }
        const kid = kids[k]!;
        if (kid.nodeType === TEXT_NODE) {
          if (kid === node) { n += offset; done = true; return; }
          n += (kid as Text).data.length;
        } else if (kid instanceof HTMLElement && kid.classList.contains('value')) {
          n += kid.dataset['key']?.length ?? 0;
          if (kid.contains(node)) { done = true; return; }
        } else visit(kid);
      }
      if (el === node) done = true;
    };
    visit(line);
    return n;
  }

  /** A DOM point as an offset in the text; one inside a hidden block mark stands after it. */
  #offsetOf(node: Node, offset: number, clamp = true): number {
    const content = this.$('.content')!;
    const rows = [...content.children];
    if (node === content) {
      const i = Math.min(offset, rows.length);
      return rows.slice(0, i).reduce((n, r) => n + this.#sourceOf(r).length + 1, 0) - (i === rows.length && i > 0 ? 1 : 0);
    }
    const row = rows.find((r) => r.contains(node));
    if (!row) return this.#sel.start;
    const index = rows.indexOf(row);
    const at = rows.slice(0, index).reduce((n, r) => n + this.#sourceOf(r).length + 1, 0);
    let local = this.#before(row, node, offset);
    const line = this.#lines[index];
    if (clamp && line && HIDDEN_MARKS.has(line.block) && local < line.marker) local = line.marker;
    return at + local;
  }

  /** Does a node of the drawn text show? A hidden block mark's, or a shut span's mark's, does not. */
  #shows(node: Node): boolean {
    const el = node.parentElement;
    if (!el?.classList.contains('mark')) return true;
    if (el.classList.contains('lead')) return false;
    const span = el.parentElement;
    return !span?.classList.contains('span') || span.hasAttribute('data-open');
  }

  /** An offset in the text as a DOM point that shows: in a hidden mark's place, the nearest text that shows. */
  #pointAt(offset: number): Point {
    const content = this.$('.content')!;
    let i = 0;
    while (i + 1 < this.#lines.length && this.#lines[i + 1]!.at <= offset) i++;
    const line = this.#lines[i];
    const row = content.children[i];
    if (!line || !row) return [content, content.childNodes.length];
    let local = offset - line.at;
    if (HIDDEN_MARKS.has(line.block) && local < line.marker) local = line.marker;
    let n = 0;
    let found: Point | null = null;
    const visit = (el: Node): boolean => {
      const kids = [...el.childNodes];
      for (const kid of kids) {
        if (kid.nodeType === TEXT_NODE) {
          const len = (kid as Text).data.length;
          if (this.#shows(kid) && local >= n && local <= n + len) {
            found = [kid, local - n];
            // Inside it, or at its end with nothing after: this is the place.
            if (local < n + len) return true;
          }
          n += len;
        } else if (kid instanceof HTMLElement && kid.classList.contains('value')) {
          const len = kid.dataset['key']?.length ?? 0;
          const index = kids.indexOf(kid);
          if (local === n && !found) { found = [el, index]; return true; }
          n += len;
          if (local === n) found = [el, index + 1];
        } else if (kid instanceof HTMLBRElement) {
          if (!found) found = [el, kids.indexOf(kid)];
        } else if (visit(kid)) return true;
      }
      return false;
    };
    visit(row);
    return found ?? [row, row.childNodes.length];
  }

  /** Put the kept selection in the box the reader is in. */
  #place(): void {
    const { start, end } = this.#sel;
    if (this.#markdown()) {
      const source = this.$<HTMLTextAreaElement>('.source');
      if (source && this.root.activeElement === source) source.setSelectionRange(start, end);
      return;
    }
    if (!this.#inContent()) return;
    const a = this.#pointAt(start);
    const f = start === end ? a : this.#pointAt(end);
    const selection = document.getSelection();
    selection?.setBaseAndExtent(a[0], a[1], f[0], f[1]);
    // A selection set by code is not scrolled to, as a typed one is: the box brings the caret into view. TODO 953
    const content = this.$('.content');
    if (!content || !selection?.rangeCount) return;
    const range = document.createRange();
    range.setStart(f[0], f[1]);
    let caret = range.getBoundingClientRect();
    // A caret at an empty line's break has no box of its own: its line's.
    if (!caret.height) caret = (f[0] instanceof Element ? f[0] : f[0].parentElement)?.closest('.line')?.getBoundingClientRect() ?? caret;
    const box = content.getBoundingClientRect();
    if (caret.bottom > box.bottom) content.scrollTop += caret.bottom - box.bottom;
    else if (caret.top < box.top) content.scrollTop -= box.top - caret.top;
  }

  /** The caret moved in the formatted box: kept, its spans opened, the tools told. */
  #onSelection = (): void => {
    if (this.#markdown() || !this.#inContent() || this.#composing) return;
    const was = this.#sel;
    const now = this.#readSel();
    // A caret inside a value — Firefox puts one there at a line's end — goes after it, where the keys can move it.
    const dom = this.#domSelection();
    if (dom && [dom.anchor[0], dom.focus[0]].some((n) => n.parentElement?.closest('.value'))) this.#place();
    if (now.start === was.start && now.end === was.end) return;
    this.#open();
    this.#syncTools();
  };

  /** The caret moved in the Markdown view: kept, and the tools told. */
  #readSource = (): void => {
    if (!this.#markdown()) return;
    this.#readSel();
    this.#syncTools();
  };

  /* ── Typing ─────────────────────────────────────────────────────────── */

  /** Is it one line: no line break goes in (TODO 913)? */
  #single(): boolean {
    return this.hasAttribute('data-single-line');
  }
  /** Does it take no edit: disabled, or read only? */
  #off(): boolean {
    return this.matches(':disabled') || this.hasAttribute('readonly');
  }

  /** Each edit the browser would make, made in the text instead. One it cannot stop — an IME's — it makes, and the
   *  text is read back. */
  #onBeforeInput = (event: InputEvent): void => {
    if (this.#off()) {
      event.preventDefault();
      return;
    }
    if (event.isComposing || event.inputType === 'insertCompositionText') return;
    const t = this.value;
    const { start, end } = this.#readSel();
    const unit = (type: string): 'char' | 'word' | 'line' => (/Word/.test(type) ? 'word' : /Line/.test(type) ? 'line' : 'char');
    let edit: MdEdit | null = null;
    let typing = false;
    switch (event.inputType) {
      case 'insertText':
        edit = typeText(t, start, end, event.data ?? '');
        typing = true;
        break;
      case 'insertParagraph': if (!this.#single()) edit = breakLine(t, start, end); break;
      case 'insertLineBreak': if (!this.#single()) edit = breakLine(t, start, end, true); break;
      case 'deleteContentBackward': case 'deleteWordBackward': case 'deleteSoftLineBackward': case 'deleteHardLineBackward':
        edit = deleteBack(t, start, end, unit(event.inputType));
        break;
      case 'deleteContentForward': case 'deleteWordForward': case 'deleteSoftLineForward': case 'deleteHardLineForward':
        edit = deleteForward(t, start, end, unit(event.inputType));
        break;
      case 'deleteByCut': case 'deleteContent': edit = deleteBack(t, start, end); break;
      case 'insertFromPaste': case 'insertFromDrop': case 'insertFromPasteAsQuotation': break;
      case 'historyUndo': this.#step(true); break;
      case 'historyRedo': this.#step(false); break;
      case 'formatBold': this.#act('strong'); break;
      case 'formatItalic': this.#act('em'); break;
      default:
        // A spelling fix, and the rest: the browser's, read back after.
        if (!event.inputType.startsWith('format')) return;
    }
    event.preventDefault();
    if (edit) this.#commit(edit, typing);
  };

  /** The native `input` is composed: it would go out beside this editor's own. An edit the browser made is read back. */
  #onNativeInput = (event: Event): void => {
    event.stopPropagation();
    if (this.#composing || (event as InputEvent).isComposing) return;
    this.#readBack();
  };

  /** The text as the browser left it, and its caret, made the text. */
  #readBack(): void {
    const content = this.$('.content')!;
    const dom = this.#domSelection();
    const caret = dom ? this.#offsetOf(...dom.focus, false) : this.value.length;
    const text = [...content.childNodes].map((n) => (n.nodeType === TEXT_NODE ? (n as Text).data : this.#sourceOf(n))).join('\n');
    this.#commit({ text, start: caret, end: caret }, true);
  }

  /** A paste is its plain text, at the selection: Markdown pasted reads as it is. */
  #onPaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    if (this.#off()) return;
    const said = (event.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
    const text = this.#single() ? said.replace(/\s*\n\s*/g, ' ') : said;
    const { start, end } = this.#readSel();
    this.#commit(typeText(this.value, start, end, text));
  };

  /** A copy is the Markdown of the selection, its hidden marks too; a cut takes it out. */
  #onCopy = (event: ClipboardEvent): void => {
    const { start, end } = this.#readSel();
    if (start === end) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', this.value.slice(start, end));
    if (event.type === 'cut' && !this.#off()) this.#commit(deleteBack(this.value, start, end));
  };

  /** The Markdown view's own edits, kept in the same history. */
  #onSourceBefore = (event: InputEvent): void => {
    if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return;
    event.preventDefault();
    this.#step(event.inputType === 'historyUndo');
  };

  /** A key in the Markdown view: its text, as typing. */
  #onSourceInput = (event: Event): void => {
    // Composed: this editor's own goes out instead.
    event.stopPropagation();
    const source = event.target as HTMLTextAreaElement;
    // One line: a break typed is a space, so the caret stays where it was.
    const text = this.#single() ? source.value.replace(/\n/g, ' ') : source.value;
    this.#commit({ text, start: source.selectionStart, end: source.selectionEnd }, true);
  };

  /** The keys: Undo, Redo, Bold, Italic and Link; in a list item, Tab and Shift+Tab move it. */
  #onKey = (event: KeyboardEvent): void => {
    if (this.#off()) return;
    const key = event.key.toLowerCase();
    if (primaryKey(event) && !event.altKey) {
      const act = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' ? 'redo' : key === 'b' ? 'strong' : key === 'i' ? 'em' : key === 'k' ? 'link' : null;
      if (!act) return;
      event.preventDefault();
      this.#act(act);
      return;
    }
    if (key === 'tab' && !event.altKey && !primaryKey(event)) {
      const { start, end } = this.#readSel();
      const can = formatAt(this.value, start, end, this.#read());
      if (!(event.shiftKey ? can.outdent : can.indent)) return;
      event.preventDefault();
      this.#act(event.shiftKey ? 'outdent' : 'indent');
    }
  };

  /** Focus came in: the text it leaves with is checked against this one. */
  #onFocus = (): void => {
    this.#held ??= this.value;
  };

  /** Focus left the editor: `change`, if the text moved since it came in. */
  #onLeave = (event: FocusEvent): void => {
    if (event.relatedTarget && (event.relatedTarget === this || this.contains(event.relatedTarget as Node))) return;
    const held = this.#held;
    this.#held = null;
    if (held !== null && held !== this.value) this.emit('change', { value: this.value });
  };

  /* ── The toolbar ────────────────────────────────────────────────────── */

  /** A tool pressed: its act, or a view. */
  #onTool = (event: Event): void => {
    const tool = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-view]');
    if (!tool) return;
    if (tool.classList.contains('view')) return this.#pickView(tool.dataset['view'] === 'markdown' ? 'markdown' : 'formatted');
    if (tool.dataset['action']) this.#act(tool.dataset['action']);
  };

  /** A text style picked: each line of the selection takes it. */
  #onStyle = (event: Event): void => {
    event.stopPropagation();
    const style = (event as CustomEvent<{ value: string }>).detail.value as TextStyle;
    const { start, end } = this.#sel;
    this.#commit(setStyle(this.value, start, end, style));
    this.focus();
  };

  /** One tool's act, on the selection kept; the box takes the focus back. */
  #act(action: string): void {
    if (this.#off()) return;
    const t = this.value;
    const { start, end } = this.#readSel();
    const lines = this.#read();
    const multi = lines.findIndex((l) => l.end >= start) !== lines.findIndex((l) => l.end >= end);
    const edits: Readonly<Record<string, () => MdEdit>> = {
      strong: () => toggleSpan(t, start, end, 'strong'),
      em: () => toggleSpan(t, start, end, 'em'),
      bullet: () => toggleList(t, start, end, 'bullet'),
      number: () => toggleList(t, start, end, 'number'),
      indent: () => indentItems(t, start, end, 1),
      outdent: () => indentItems(t, start, end, -1),
      link: () => toggleLink(t, start, end, this.word('link')),
      comment: () => insertComment(t, start, end, this.word('comment')),
      // Code in a line, or the lines a block: a selection over lines, or a caret on an empty one, fences them.
      code: () => (multi || (start === end && !lines.find((l) => l.end >= start && l.at <= start)?.parts.length) || formatAt(t, start, end, lines).style === 'code'
        ? setStyle(t, start, end, 'code') : toggleSpan(t, start, end, 'code')),
      image: () => insertImage(t, start, end, this.word('image')),
      table: () => insertTable(t, start, end, this.word('column')),
    };
    if (action === 'undo' || action === 'redo') this.#step(action === 'undo');
    else if (edits[action]) this.#commit(edits[action]());
    this.focus();
  }

  /** The reader picked a view: shown, and said. */
  #pickView(view: 'formatted' | 'markdown'): void {
    if ((this.dataset['view'] ?? 'formatted') === view) return;
    this.dataset['view'] = view;
    this.emit('view-change', { view });
    this.focus();
  }

  /** The view shown: the Markdown view holds the text; the formatted one draws it again. */
  #showView(): void {
    const markdown = this.#markdown();
    for (const button of this.$$('.view')) button.setAttribute('aria-pressed', String((button.dataset['view'] === 'markdown') === markdown));
    // Tools that read the drawn text — the style's label, the pressed marks — say nothing in the Markdown itself.
    this.#draw();
  }

  /** Each tool says what the selection stands in, and whether it can act. */
  #syncTools(): void {
    if (this.#text === null) return;
    const { start, end } = this.#sel;
    const off = this.matches(':disabled');
    const can = formatAt(this.#text, start, end, this.#read());
    const press = (action: string, on: boolean): void => this.$(`.tool[data-action="${action}"]`)?.setAttribute('aria-pressed', String(on));
    press('strong', can.strong);
    press('em', can.em);
    press('bullet', can.list === 'bullet');
    press('number', can.list === 'number');
    press('link', can.link);
    press('code', can.code || can.style === 'code');
    const enable = (action: string, on: boolean): void => {
      this.$(`.tool[data-action="${action}"]`)?.toggleAttribute('disabled', off || !on);
    };
    enable('undo', this.#undo.length > 0);
    enable('redo', this.#redo.length > 0);
    enable('indent', can.indent);
    enable('outdent', can.outdent);
    for (const tool of this.$$('.tool:not([data-action="undo"], [data-action="redo"], [data-action="indent"], [data-action="outdent"]), .style, .view')) {
      tool.toggleAttribute('disabled', off);
    }
    const style = this.$('.style');
    const named = this.$(`.styles button[value="${can.style}"]`)?.textContent?.trim() || this.word(can.style);
    if (style && style.dataset['label'] !== named) style.dataset['label'] = named;
  }

  /* ── The form ───────────────────────────────────────────────────────── */

  /** Native attributes onto the two boxes, and the help link's address. */
  #syncAttrs(): void {
    const content = this.$('.content');
    const source = this.$<HTMLTextAreaElement>('.source');
    if (!content || !source) return;
    const off = this.matches(':disabled');
    const readonly = this.hasAttribute('readonly');
    content.contentEditable = off || readonly ? 'false' : 'true';
    content.setAttribute('aria-disabled', String(off));
    content.setAttribute('aria-readonly', String(readonly));
    content.setAttribute('aria-multiline', String(!this.#single()));
    content.setAttribute('aria-required', String(this.hasAttribute('required')));
    content.tabIndex = off ? -1 : 0;
    this.mirrorAttrs(source, ['placeholder', 'required', 'readonly']);
    source.disabled = off;
    // Only a web address, or one on this site: never a script.
    const help = this.$<HTMLAnchorElement>('.help');
    const href = this.dataset['helpHref'];
    if (help && href && /^(https?:\/\/|\/|\.)/i.test(href)) help.href = href;
    for (const button of this.$$('.view')) button.setAttribute('aria-pressed', String((button.dataset['view'] === 'markdown') === this.#markdown()));
    this.#syncTools();
    this.#syncForm();
  }

  /** Tell the form the text, and whether it is acceptable. */
  #syncForm(): void {
    if (this.#text === null) return;
    this.formLink.value(this.#text);
    const anchor = this.$('.content') ?? undefined;
    const error = this.dataset['error'];
    if (error) this.formLink.validity({ customError: true }, error, anchor);
    else if (this.hasAttribute('required') && !this.#text.trim()) this.formLink.validity({ valueMissing: true }, this.word('required'), anchor);
    else this.formLink.validity({});
  }

  protected override syncFormValue(): void {
    this.#syncForm();
  }

  /** Inside a disabled `<fieldset>`, as by its own `disabled`. */
  formDisabledCallback(): void {
    this.#syncAttrs();
  }

  /** Its form was reset: the text it was given in markup. */
  formResetCallback(): void {
    this.#reset(this.getAttribute('value') ?? '');
  }

  /** Back, or a session restored: the text the form kept. */
  formStateRestoreCallback(state: string): void {
    this.#reset(state);
  }
}

define('sherpa-markdown-editor', SherpaMarkdownEditor);
