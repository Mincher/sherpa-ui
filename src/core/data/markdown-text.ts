/**
 * markdown-text.ts — a Markdown text read as lines, blocks and inline parts, and the edits a Markdown editor makes on it.
 * The text is the model: each part is a range of it, so a line's parts joined are the line again. DOM-free. Plan 892.
 *
 * Map:
 * - MdBlock — What a line is: a paragraph, a heading, a list item, a quote, code, a table row, a rule or blank.
 * - MdSpan — An inline span that holds parts: strong, em, strike, code, a link, an image, a comment or an escape.
 * - MdPart — One inline part: text, a mark, a value, or a span of parts. Its range is the text's, end excluded.
 * - MdLine — One line read: its range, its block, its block mark, its depth, its number and its parts.
 * - HIDDEN_MARKS — The blocks whose mark the formatted view hides: their look says it.
 * - readMarkdown — Each line of a text, read.
 * - lineAt — The line that holds an offset.
 * - MdEdit — A text after an edit, and the selection in it.
 * - replaceText — The selection replaced by some text, the caret after it.
 * - MdFormat — What the selection stands in: its block, its list, its spans, and whether it can indent.
 * - TextStyle — A line's style: normal text, a heading, a quote or code.
 * - formatAt — What the selection stands in.
 * - breakLine — Enter: a new line; a list or a quote goes on, and an empty item ends it.
 * - deleteBack — Backspace: a character, a word or to the line's start; a block mark or a value goes whole.
 * - deleteForward — Delete: a character, a word or to the line's end; a value goes whole.
 * - toggleSpan — Bold, italic, strikethrough or code on the selection, or off where it stands in one.
 * - setStyle — Each line of the selection takes a style.
 * - toggleList — Each line of the selection a bulleted or numbered item, or none where all are.
 * - indentItems — Each list item of the selection one level in, or out.
 * - toggleLink — The selection a link, its address selected to type; or a link's marks off.
 * - insertImage — An image at the selection, its words the selection; its address selected.
 * - insertComment — A comment at the selection; its words selected.
 * - insertTable — A table after the line: two columns, a header and one row; its first heading selected.
 * - typeText — Text typed over the selection, the caret after it: a value the selection cuts into goes whole.
 * - insertValue — A value at the selection, a space before it after a word.
 */
import { REF_FORM } from './references.js';

/** What a line is. A `fence` opens or shuts `code`; a `table-rule` is a table's `| --- |` row. */
export type MdBlock = 'paragraph' | 'heading' | 'bullet' | 'number' | 'quote' | 'fence' | 'code' | 'table' | 'table-rule' | 'rule' | 'blank';

/** An inline span that holds parts. An `escape` is a backslash and the character it keeps plain. */
export type MdSpan = 'strong' | 'em' | 'strike' | 'code' | 'link' | 'image' | 'comment' | 'escape';

/** One inline part: text, a mark, a value, or a span of parts. Its range is the text's, end excluded. */
export type MdPart =
  | { type: 'text'; from: number; to: number }
  | { type: 'mark'; from: number; to: number }
  | { type: 'value'; from: number; to: number; key: string }
  | { type: MdSpan; from: number; to: number; parts: MdPart[]; href?: string };

/** One line read: its range (no line break), its block, its block mark's length from its start, its list depth, the
 *  number a numbered item reads (its list's first, counted on), and its parts after the mark. */
export interface MdLine {
  at: number;
  end: number;
  block: MdBlock;
  /** A heading's level, 1 to 6; else 0. */
  level: number;
  marker: number;
  depth: number;
  number: number;
  parts: MdPart[];
}

/** The blocks whose mark the formatted view hides: their look says it. */
export const HIDDEN_MARKS: ReadonlySet<MdBlock> = new Set(['heading', 'bullet', 'number', 'quote']);

// A reference a text names, `{{kind:id}}`, is one atom, drawn as a chip of its words (plan 956).
const VALUE_AT = new RegExp(REF_FORM.source, 'y');
const PUNCT = /[!-/:-@[-`{-~]/;
const SPACE = /\s/;
const WORD = /[\p{L}\p{N}_]/u;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})(?: +|$)/;
const RULE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const BULLET = /^( *)([-*+]) +/;
const NUMBER = /^( *)(\d{1,9})([.)]) +/;
const QUOTE = /^ {0,3}> ?/;
const TABLE_RULE = /^ *\|?(?: *:?-+:? *\|)+ *(?::?-+:?)? *$/;

/* ── Inline ────────────────────────────────────────────────────────────── */

/** A run of one character from `i`, at most to `to`. */
function runOf(t: string, i: number, to: number): number {
  let n = 0;
  while (i + n < to && t[i + n] === t[i]) n++;
  return n;
}

/** A link's or an image's tail from its `]`: `](address)`, its end and address; none, when it has none. */
function linkTail(t: string, close: number, to: number): { end: number; href: string } | null {
  if (t[close + 1] !== '(') return null;
  const shut = t.indexOf(')', close + 2);
  return shut < 0 || shut >= to ? null : { end: shut + 1, href: t.slice(close + 2, shut).trim() };
}

/** The `]` that shuts a `[` at `open`, across nested brackets, escapes and code; none, when it has none. */
function closeBracket(t: string, open: number, to: number): number {
  let depth = 0;
  for (let j = open + 1; j < to; j++) {
    const skip = atomEnd(t, j, to, false);
    if (skip > j) { j = skip - 1; continue; }
    if (t[j] === '[') depth++;
    else if (t[j] === ']' && depth-- === 0) return j;
  }
  return -1;
}

/** The end of the code span at `i` — its backticks shut by as many — or `i`, when they are not shut. */
function codeEnd(t: string, i: number, to: number): number {
  const n = runOf(t, i, to);
  for (let j = t.indexOf('`', i + n); j >= 0 && j < to; j = t.indexOf('`', j)) {
    const m = runOf(t, j, to);
    if (m === n) return j + m;
    j += m;
  }
  return i;
}

/** The end of an ATOM at `i` — an escape, code, a comment, a value, or (`links`) a link or image — that a span's search
 *  steps over whole; `i`, when none starts there. */
function atomEnd(t: string, i: number, to: number, links = true): number {
  const c = t[i];
  if (c === '\\' && i + 1 < to && PUNCT.test(t[i + 1]!)) return i + 2;
  if (c === '`') return codeEnd(t, i, to);
  if (t.startsWith('<!--', i)) {
    const shut = t.indexOf('-->', i + 4);
    return shut >= 0 && shut + 3 <= to ? shut + 3 : i;
  }
  if (c === '{') {
    VALUE_AT.lastIndex = i;
    const m = VALUE_AT.exec(t);
    return m && i + m[0].length <= to ? i + m[0].length : i;
  }
  if (links && (c === '[' || (c === '!' && t[i + 1] === '['))) {
    const open = c === '!' ? i + 1 : i;
    const close = closeBracket(t, open, to);
    return close < 0 ? i : linkTail(t, close, to)?.end ?? i;
  }
  return i;
}

const mark = (from: number, to: number): MdPart => ({ type: 'mark', from, to });
const text = (from: number, to: number): MdPart => ({ type: 'text', from, to });

/** The atom at `i`, read: its parts and its end. */
function atomAt(t: string, i: number, to: number): { parts: MdPart[]; end: number } | null {
  const c = t[i];
  if (c === '\\' && i + 1 < to && PUNCT.test(t[i + 1]!)) return { parts: [{ type: 'escape', from: i, to: i + 2, parts: [mark(i, i + 1), text(i + 1, i + 2)] }], end: i + 2 };
  if (c === '`') {
    const end = codeEnd(t, i, to);
    // Backticks not shut are text, all of them.
    if (end === i) return { parts: [text(i, i + runOf(t, i, to))], end: i + runOf(t, i, to) };
    const n = runOf(t, i, to);
    const inner = end - n > i + n ? [text(i + n, end - n)] : [];
    return { parts: [{ type: 'code', from: i, to: end, parts: [mark(i, i + n), ...inner, mark(end - n, end)] }], end };
  }
  if (t.startsWith('<!--', i)) {
    const end = atomEnd(t, i, to);
    if (end === i) return null;
    const inner = end - 3 > i + 4 ? [text(i + 4, end - 3)] : [];
    return { parts: [{ type: 'comment', from: i, to: end, parts: [mark(i, i + 4), ...inner, mark(end - 3, end)] }], end };
  }
  if (c === '{') {
    const end = atomEnd(t, i, to);
    return end === i ? null : { parts: [{ type: 'value', from: i, to: end, key: t.slice(i, end) }], end };
  }
  if (c === '[' || (c === '!' && t[i + 1] === '[')) {
    const image = c === '!';
    const open = image ? i + 1 : i;
    const close = closeBracket(t, open, to);
    const tail = close < 0 ? null : linkTail(t, close, to);
    if (!tail) return null;
    // An image's words are plain; a link's are read again.
    const inner = close > open + 1 ? (image ? [text(open + 1, close)] : readInline(t, open + 1, close)) : [];
    const part: MdPart = { type: image ? 'image' : 'link', from: i, to: tail.end, parts: [mark(i, open + 1), ...inner, mark(close, tail.end)], href: tail.href };
    return { parts: [part], end: tail.end };
  }
  return null;
}

/** Where the span opened at `i` by `d` is shut: the start of its closing mark; -1, when it is not. */
function closerOf(t: string, i: number, d: string, to: number): number {
  const c = d[0]!;
  const after = i + d.length;
  for (let j = after; j < to;) {
    const skip = atomEnd(t, j, to);
    if (skip > j) { j = skip; continue; }
    if (t[j] !== c) { j++; continue; }
    const run = runOf(t, j, to);
    // A run of three or more shuts with its last marks: `***both***`.
    const at = run === d.length ? j : run >= 3 && run > d.length ? j + run - d.length : -1;
    const flanked = j > after && !SPACE.test(t[j - 1]!);
    const word = c === '_' && at >= 0 && at + d.length < to && WORD.test(t[at + d.length]!);
    if (at >= 0 && at > after && flanked && !word) return at;
    j += run;
  }
  return -1;
}

const SPANS: readonly (readonly [string, MdSpan])[] = [['**', 'strong'], ['__', 'strong'], ['~~', 'strike'], ['*', 'em'], ['_', 'em']];

/** The emphasis span opened at `i`, read; else the run of marks there as text. */
function emphasisAt(t: string, i: number, from: number, to: number): { parts: MdPart[]; end: number } | null {
  const c = t[i];
  if (c !== '*' && c !== '_' && c !== '~') return null;
  const run = runOf(t, i, to);
  for (const [d, type] of SPANS) {
    if (d[0] !== c || run < d.length) continue;
    const next = t[i + d.length];
    if (next === undefined || i + d.length >= to || SPACE.test(next)) continue;
    // An underscore inside a word is a character: `snake_case`.
    if (c === '_' && i > from && WORD.test(t[i - 1]!)) continue;
    const shut = closerOf(t, i, d, to);
    if (shut < 0) continue;
    const end = shut + d.length;
    return { parts: [{ type, from: i, to: end, parts: [mark(i, i + d.length), ...readInline(t, i + d.length, shut), mark(shut, end)] }], end };
  }
  return { parts: [text(i, i + run)], end: i + run };
}

/** A range of a text read as inline parts; text runs joined. */
function readInline(t: string, from: number, to: number): MdPart[] {
  const out: MdPart[] = [];
  const add = (part: MdPart): void => {
    const last = out.at(-1);
    if (part.type === 'text' && last?.type === 'text' && last.to === part.from) last.to = part.to;
    else out.push(part);
  };
  let pending = from;
  const flush = (at: number): void => { if (at > pending) add(text(pending, at)); };
  for (let i = from; i < to;) {
    const read = atomAt(t, i, to) ?? emphasisAt(t, i, from, to);
    if (!read) { i++; continue; }
    flush(i);
    for (const part of read.parts) add(part);
    i = pending = read.end;
  }
  flush(to);
  return out;
}

/** A table row's parts: each unescaped pipe a mark, each cell read. */
function readRow(t: string, from: number, to: number): MdPart[] {
  const out: MdPart[] = [];
  let cell = from;
  for (let j = from; j < to;) {
    const skip = atomEnd(t, j, to, false);
    if (skip > j) { j = skip; continue; }
    if (t[j] === '|') {
      out.push(...readInline(t, cell, j), mark(j, j + 1));
      cell = j + 1;
    }
    j++;
  }
  return [...out, ...readInline(t, cell, to)];
}

/* ── Lines ─────────────────────────────────────────────────────────────── */

/** Each line of a text, read: its block, its mark, its depth, its number and its parts. */
export function readMarkdown(t: string): MdLine[] {
  const lines: MdLine[] = [];
  let fence: string | null = null;
  // Each open list level: where its marker stands, and where its content does.
  let levels: { indent: number; content: number }[] = [];
  let counts: (number | undefined)[] = [];
  let at = 0;
  for (const source of t.split('\n')) {
    const end = at + source.length;
    const line = (block: MdBlock, marker = 0, parts: MdPart[] = [], more: Partial<MdLine> = {}): MdLine =>
      ({ at, end, block, level: 0, marker, depth: 0, number: 0, parts, ...more });
    const whole = source.length ? [mark(at, end)] : [];
    const f = FENCE.exec(source);
    let read: MdLine;
    if (fence !== null) {
      const shuts = f && f[1]![0] === fence[0] && f[1]!.length >= fence.length && !source.slice(f[0].length).trim();
      read = shuts ? line('fence', 0, whole) : line('code', 0, source.length ? [text(at, end)] : []);
      if (shuts) fence = null;
    } else if (f) {
      fence = f[1]!;
      read = line('fence', 0, whole);
    } else if (!source.trim()) {
      read = line('blank', 0, source.length ? [text(at, end)] : []);
    } else {
      const h = HEADING.exec(source);
      const b = BULLET.exec(source);
      const n = NUMBER.exec(source);
      const q = QUOTE.exec(source);
      const content = (marker: number): MdPart[] => readInline(t, at + marker, end);
      if (h) read = line('heading', h[0].length, content(h[0].length), { level: h[1]!.length });
      else if (RULE.test(source)) read = line('rule', 0, whole);
      else if (b || n) {
        const m = (b ?? n)!;
        const indent = m[1]!.length;
        while (levels.length && indent < levels.at(-1)!.content) levels.pop();
        const depth = levels.length;
        levels.push({ indent, content: m[0].length });
        counts = counts.slice(0, depth + 1);
        let number = 0;
        if (n) number = counts[depth] = counts[depth] === undefined ? Number(n[2]) : counts[depth]! + 1;
        else counts[depth] = undefined;
        read = line(b ? 'bullet' : 'number', m[0].length, content(m[0].length), { depth, number });
      } else if (q) read = line('quote', q[0].length, content(q[0].length));
      else if (source.trimStart().startsWith('|')) read = TABLE_RULE.test(source) ? line('table-rule', 0, whole) : line('table', 0, readRow(t, at, end));
      else read = line('paragraph', 0, content(0));
    }
    // A list goes on over blank lines and its own items; anything else ends it.
    if (read.block !== 'bullet' && read.block !== 'number' && read.block !== 'blank') {
      levels = [];
      counts = [];
    }
    lines.push(read);
    at = end + 1;
  }
  return lines;
}

/** The line that holds an offset: the last whose range reaches it. */
export function lineAt(lines: readonly MdLine[], offset: number): number {
  let i = 0;
  while (i + 1 < lines.length && lines[i + 1]!.at <= offset) i++;
  return i;
}

/* ── Edits ─────────────────────────────────────────────────────────────── */

/** A text after an edit, and the selection in it. */
export interface MdEdit {
  text: string;
  start: number;
  end: number;
}

/** The selection replaced by some text, the caret after it. */
export function replaceText(t: string, start: number, end: number, insert: string): MdEdit {
  const at = start + insert.length;
  return { text: t.slice(0, start) + insert + t.slice(end), start: at, end: at };
}

/** One insertion or removal, applied with others from the last to the first. */
interface Change { at: number; cut: number; put: string; /** A caret at `at` moves past what is put. */ before?: boolean }

/** Apply changes, each in the text as it was, and carry the selection through them. */
function apply(t: string, start: number, end: number, changes: readonly Change[]): MdEdit {
  const sorted = [...changes].sort((a, b) => b.at - a.at);
  let out = t;
  for (const c of sorted) out = out.slice(0, c.at) + c.put + out.slice(c.at + c.cut);
  const move = (pos: number): number => {
    let to = pos;
    for (const c of changes) {
      if (pos > c.at + c.cut || (pos === c.at + c.cut && c.cut > 0)) to += c.put.length - c.cut;
      else if (pos > c.at) to += Math.min(c.put.length, pos - c.at) - (pos - c.at);
      else if (pos === c.at && c.before) to += c.put.length;
    }
    return to;
  };
  return { text: out, start: move(start), end: move(end) };
}

/** The lines a selection touches, by index. */
function touched(lines: readonly MdLine[], start: number, end: number): MdLine[] {
  return lines.slice(lineAt(lines, start), lineAt(lines, end) + 1);
}

/** Each span, at any depth, of a line's parts. */
function spansOf(parts: readonly MdPart[]): Extract<MdPart, { parts: MdPart[] }>[] {
  return parts.flatMap((p) => ('parts' in p ? [p, ...spansOf(p.parts)] : []));
}

/** Each value of a line's parts, at any depth. */
function valuesOf(parts: readonly MdPart[]): Extract<MdPart, { type: 'value' }>[] {
  return parts.flatMap((p) => (p.type === 'value' ? [p] : 'parts' in p ? valuesOf(p.parts) : []));
}

/** What the selection stands in: its line's style and list, each span it is inside, and whether its items can move. */
export interface MdFormat {
  style: TextStyle;
  list: 'bullet' | 'number' | null;
  strong: boolean;
  em: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
  indent: boolean;
  outdent: boolean;
}

/** A line's style: normal text, a heading, a quote or code. */
export type TextStyle = 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'quote' | 'code';

/** What the selection stands in; `lines`, the text read already. */
export function formatAt(t: string, start: number, end = start, lines: readonly MdLine[] = readMarkdown(t)): MdFormat {
  const line = lines[lineAt(lines, start)]!;
  const inside = (type: MdSpan): boolean => spansOf(line.parts).some((s) => s.type === type && s.from < start && end < s.to);
  const style: TextStyle = line.block === 'heading' ? `h${line.level}` as TextStyle : line.block === 'quote' ? 'quote'
    : line.block === 'code' || line.block === 'fence' ? 'code' : 'paragraph';
  const items = touched(lines, start, end).filter((l) => l.block === 'bullet' || l.block === 'number');
  return {
    style,
    list: line.block === 'bullet' || line.block === 'number' ? line.block : null,
    strong: inside('strong'), em: inside('em'), strike: inside('strike'), code: inside('code'), link: inside('link'),
    indent: items.length > 0 && items.every((l) => siblingAbove(lines, l) !== undefined),
    outdent: items.length > 0 && items.some((l) => l.depth > 0),
  };
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** The length of the character before `at` in `s`, or after it: a whole grapheme, an emoji too. */
function charLength(s: string, at: number, back: boolean): number {
  if (!segmenter) return 1;
  const parts = [...segmenter.segment(back ? s.slice(0, at) : s.slice(at))];
  return (back ? parts.at(-1) : parts[0])?.segment.length ?? 1;
}

/** A word's length before `at` in `s`, or after it, with the spaces beside it. */
function wordLength(s: string, at: number, back: boolean): number {
  const m = back ? /(?:[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+)?\s*$/u.exec(s.slice(0, at)) : /^\s*(?:[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+)?/u.exec(s.slice(at));
  return m?.[0].length || 1;
}

/** A range widened over each value it cuts into: a value goes whole. */
function wholeValues(line: MdLine, from: number, to: number): [number, number] {
  let [a, b] = [from, to];
  for (const v of valuesOf(line.parts)) {
    if (a > v.from && a < v.to) a = v.from;
    if (b > v.from && b < v.to) b = v.to;
  }
  return [a, b];
}

/** The list item above at the same depth, before any line of a lower depth: what an item nests under. */
function siblingAbove(lines: readonly MdLine[], item: MdLine): MdLine | undefined {
  for (let i = lines.indexOf(item) - 1; i >= 0; i--) {
    const l = lines[i]!;
    if (l.block === 'blank') continue;
    if (l.block !== 'bullet' && l.block !== 'number') return undefined;
    if (l.depth === item.depth) return l;
    if (l.depth < item.depth) return undefined;
  }
  return undefined;
}

/** Enter: a new line. In a list or a quote the next line is one too; an empty item ends its list (or steps out a level),
 *  an empty quote line its quote. `soft` (Shift+Enter): a line in the same item, no new mark. */
export function breakLine(t: string, start: number, end: number, soft = false): MdEdit {
  const cut = replaceText(t, start, end, '');
  const c = cut.start;
  const lines = readMarkdown(cut.text);
  const line = lines[lineAt(lines, c)]!;
  const src = cut.text.slice(line.at, line.end);
  const contentAt = line.at + line.marker;
  const item = line.block === 'bullet' || line.block === 'number';
  if (soft) return replaceText(cut.text, c, c, `\n${item ? ' '.repeat(line.marker) : ''}`);
  if (item || line.block === 'quote') {
    const empty = line.end === contentAt;
    if (empty && item && line.depth > 0) return indentItems(cut.text, c, c, -1);
    if (empty) return apply(cut.text, c, c, [{ at: line.at, cut: line.marker, put: '' }]);
    const next = item
      ? src.slice(0, line.marker).replace(/\d+(?=[.)])/, (n) => String(Number(n) + 1))
      : src.slice(0, line.marker);
    // At the start of an item, an empty one above it; the caret stays with its words.
    if (c <= contentAt) return apply(cut.text, c, c, [{ at: line.at, cut: 0, put: `${src.slice(0, line.marker)}\n` }]);
    return replaceText(cut.text, c, c, `\n${next}`);
  }
  if (line.block === 'heading' && c <= contentAt && line.end > contentAt) return apply(cut.text, c, c, [{ at: line.at, cut: 0, put: '\n' }]);
  if (line.block === 'code') return replaceText(cut.text, c, c, `\n${/^\s*/.exec(src)![0]}`);
  return replaceText(cut.text, c, c, '\n');
}

/** Backspace: the selection, else the character, word (`word`) or line (`line`) before the caret. At an item's,
 *  heading's or quote's start its mark goes (an inner item steps out a level), at a line's start the line joins the one
 *  above, and a value goes whole. */
export function deleteBack(t: string, start: number, end: number, unit: 'char' | 'word' | 'line' = 'char'): MdEdit {
  if (start < end) {
    const lines = readMarkdown(t);
    const [a] = wholeValues(lines[lineAt(lines, start)]!, start, start);
    const [, b] = wholeValues(lines[lineAt(lines, end)]!, end, end);
    return replaceText(t, a, b, '');
  }
  const lines = readMarkdown(t);
  const line = lines[lineAt(lines, start)]!;
  const contentAt = line.at + line.marker;
  if (line.marker && HIDDEN_MARKS.has(line.block) && start <= contentAt) {
    if ((line.block === 'bullet' || line.block === 'number') && line.depth > 0) return indentItems(t, start, end, -1);
    return apply(t, start, end, [{ at: line.at, cut: line.marker, put: '' }]);
  }
  if (start === line.at) return start === 0 ? { text: t, start, end } : replaceText(t, start - 1, start, '');
  const value = valuesOf(line.parts).find((v) => v.to === start);
  if (value) return replaceText(t, value.from, start, '');
  const from = line.at + (HIDDEN_MARKS.has(line.block) ? line.marker : 0);
  const src = t.slice(from, start);
  const n = unit === 'line' ? src.length : unit === 'word' ? wordLength(src, src.length, true) : charLength(src, src.length, true);
  const [a] = wholeValues(line, start - Math.min(n, src.length), start);
  return replaceText(t, a, start, '');
}

/** Delete: the selection, else the character, word (`word`) or line (`line`) after the caret. At a line's end the next
 *  line joins it, its block mark gone; a value goes whole. */
export function deleteForward(t: string, start: number, end: number, unit: 'char' | 'word' | 'line' = 'char'): MdEdit {
  if (start < end) return deleteBack(t, start, end);
  const lines = readMarkdown(t);
  const i = lineAt(lines, start);
  const line = lines[i]!;
  if (start === line.end) {
    const next = lines[i + 1];
    if (!next) return { text: t, start, end };
    return replaceText(t, start, next.at + (HIDDEN_MARKS.has(next.block) ? next.marker : 0), '');
  }
  const value = valuesOf(line.parts).find((v) => v.from === start);
  if (value) return replaceText(t, start, value.to, '');
  const src = t.slice(start, line.end);
  const n = unit === 'line' ? src.length : unit === 'word' ? wordLength(src, 0, false) : charLength(src, 0, false);
  const [, b] = wholeValues(line, start, start + Math.min(n, src.length));
  return replaceText(t, start, b, '');
}

const MARKS: Readonly<Record<'strong' | 'em' | 'strike' | 'code', string>> = { strong: '**', em: '*', strike: '~~', code: '`' };

/** Bold, italic, strikethrough or code on the selection, a line at a time; or off, where the selection stands in such a
 *  span. A caret in a word takes the word; a caret elsewhere opens an empty pair to type into. */
export function toggleSpan(t: string, start: number, end: number, type: 'strong' | 'em' | 'strike' | 'code'): MdEdit {
  const lines = readMarkdown(t);
  const line = lines[lineAt(lines, start)]!;
  // A caret at a span's very edge is outside it.
  const own = spansOf(line.parts).filter((s) => s.type === type && s.from <= start && end <= s.to && !(start === end && (start === s.from || start === s.to))).at(-1);
  if (own) {
    const open = own.parts[0]!;
    const close = own.parts.at(-1)!;
    return apply(t, start, end, [{ at: open.from, cut: open.to - open.from, put: '' }, { at: close.from, cut: close.to - close.from, put: '' }]);
  }
  const d = MARKS[type];
  if (start === end) {
    const lo = line.at + (HIDDEN_MARKS.has(line.block) ? line.marker : 0);
    let a = start;
    while (a > lo && WORD.test(t[a - 1]!)) a--;
    let b = start;
    while (b < line.end && WORD.test(t[b]!)) b++;
    if (a < start && b > start) return apply(t, start, end, [{ at: a, cut: 0, put: d, before: true }, { at: b, cut: 0, put: d }]);
    return { text: t.slice(0, start) + d + d + t.slice(start), start: start + d.length, end: start + d.length };
  }
  const changes: Change[] = [];
  for (const l of touched(lines, start, end)) {
    if (l.block === 'code' || l.block === 'fence') continue;
    let a = Math.max(start, l.at + (HIDDEN_MARKS.has(l.block) ? l.marker : 0));
    let b = Math.min(end, l.end);
    // A mark beside a space does not open or shut: the spaces stay outside.
    while (a < b && SPACE.test(t[a]!)) a++;
    while (b > a && SPACE.test(t[b - 1]!)) b--;
    if (a < b) changes.push({ at: a, cut: 0, put: d, before: true }, { at: b, cut: 0, put: d });
  }
  return apply(t, start, end, changes);
}

const STYLE_MARK: Readonly<Record<Exclude<TextStyle, 'code'>, string>> = {
  paragraph: '', h1: '# ', h2: '## ', h3: '### ', h4: '#### ', h5: '##### ', h6: '###### ', quote: '> ',
};

/** Each line of the selection takes a style: its block mark replaced. Code fences the lines; code again takes the fence
 *  away. */
export function setStyle(t: string, start: number, end: number, style: TextStyle): MdEdit {
  const lines = readMarkdown(t);
  const own = touched(lines, start, end);
  const first = own[0]!;
  const last = own.at(-1)!;
  if (style === 'code') {
    const k = lines.indexOf(first);
    const pair = fencePairs(lines).find(([o, s]) => o <= k && k <= s);
    if (pair) {
      const [o, s] = [lines[pair[0]]!, lines[pair[1]]!];
      const changes: Change[] = [{ at: o.at, cut: o.end - o.at + (o === s ? 0 : 1), put: '' }];
      if (s !== o && s.block === 'fence') changes.push({ at: s.at - 1, cut: s.end - s.at + 1, put: '' });
      return apply(t, start, end, changes);
    }
    return apply(t, start, end, [{ at: first.at, cut: 0, put: '```\n', before: true }, { at: last.end, cut: 0, put: '\n```' }]);
  }
  const put = STYLE_MARK[style];
  const changes = own.filter((l) => l.block !== 'code' && l.block !== 'fence').map((l): Change => {
    // A list item's or a quote's mark goes whole, its indent with it.
    const cut = l.block === 'paragraph' || l.block === 'table' || l.block === 'blank' ? 0 : l.marker;
    return { at: l.at, cut, put, before: true };
  });
  return apply(t, start, end, changes);
}

/** Each code block's fences, by line index: its opening fence and its shutting one, or its last line where none shuts. */
function fencePairs(lines: readonly MdLine[]): [number, number][] {
  const pairs: [number, number][] = [];
  let open = -1;
  lines.forEach((l, i) => {
    if (l.block !== 'fence') return;
    if (open < 0) open = i;
    else { pairs.push([open, i]); open = -1; }
  });
  if (open >= 0) pairs.push([open, lines.length - 1]);
  return pairs;
}

/** Each line of the selection a bulleted or numbered item — numbered from 1, or on from the item above — or none,
 *  where each already is one. Blank lines and code are left. */
export function toggleList(t: string, start: number, end: number, type: 'bullet' | 'number'): MdEdit {
  const lines = readMarkdown(t);
  const own = touched(lines, start, end).filter((l) => l.block !== 'blank' && l.block !== 'code' && l.block !== 'fence');
  if (!own.length) return replaceText(t, start, end, type === 'bullet' ? '- ' : '1. ');
  if (own.every((l) => l.block === type)) return apply(t, start, end, own.map((l) => ({ at: l.at, cut: l.marker, put: '' })));
  const counts = new Map<number, number>();
  const changes = own.map((l): Change => {
    const listed = l.block === 'bullet' || l.block === 'number';
    const indent = listed ? /^ */.exec(t.slice(l.at, l.end))![0] : '';
    const depth = listed ? l.depth : 0;
    const above = listed ? siblingAbove(lines, l) : lines[lines.indexOf(l) - 1];
    const from = counts.get(depth) ?? (above?.block === 'number' && above.depth === depth && !own.includes(above) ? above.number : 0);
    counts.set(depth, from + 1);
    const mark = type === 'bullet' ? '- ' : `${from + 1}. `;
    const cut = l.block === 'paragraph' || l.block === 'table' ? 0 : l.marker;
    return { at: l.at, cut, put: indent + mark };
  });
  return apply(t, start, end, changes);
}

/** Each list item of the selection one level in (`by` 1), under the item above, or out (`by` -1). A numbered item
 *  counts from 1 at its new level, or on from the item it now follows. An item that cannot move stays. */
export function indentItems(t: string, start: number, end: number, by: 1 | -1): MdEdit {
  const lines = readMarkdown(t);
  const items = touched(lines, start, end).filter((l) => l.block === 'bullet' || l.block === 'number');
  const changes: Change[] = [];
  for (const item of items) {
    const src = t.slice(item.at, item.end);
    const indent = /^ */.exec(src)![0].length;
    let to: number;
    if (by > 0) {
      const parent = siblingAbove(lines, item);
      if (!parent) continue;
      // Under the item above: at its content's column.
      to = parent.marker;
    } else {
      if (item.depth === 0) continue;
      // Out to the indent of the nearest item above at a lower depth.
      let i = lines.indexOf(item) - 1;
      while (i >= 0 && !((lines[i]!.block === 'bullet' || lines[i]!.block === 'number') && lines[i]!.depth < item.depth)) i--;
      to = i >= 0 ? /^ */.exec(t.slice(lines[i]!.at, lines[i]!.end))![0].length : 0;
    }
    const num = /^ *(\d+)(?=[.)])/.exec(src);
    if (!num) changes.push({ at: item.at, cut: indent, put: ' '.repeat(to) });
    else {
      // Its number at the new level: on from the item it follows there, else 1.
      const level = item.depth + by;
      let n = 1;
      for (let i = lines.indexOf(item) - 1; i >= 0; i--) {
        const l = lines[i]!;
        if (l.block === 'blank') continue;
        if (l.block !== 'bullet' && l.block !== 'number') break;
        if (l.depth < level) break;
        if (l.depth === level) { n = l.block === 'number' ? l.number + 1 : 1; break; }
      }
      // One change, the indent and the number: two at one place would cross.
      changes.push({ at: item.at, cut: indent + num[1]!.length, put: ' '.repeat(to) + String(n) });
    }
  }
  return apply(t, start, end, changes);
}

/** The link the selection stands in, at any depth of its line. */
function linkAround(lines: readonly MdLine[], start: number, end: number): Extract<MdPart, { parts: MdPart[] }> | undefined {
  const line = lines[lineAt(lines, start)]!;
  return spansOf(line.parts).filter((s) => s.type === 'link' && s.from <= start && end <= s.to).at(-1);
}

const ADDRESS = 'https://';

/** The selection a link, `words` where it is empty, its address selected to type over. In a link, its marks go. */
export function toggleLink(t: string, start: number, end: number, words: string): MdEdit {
  const own = linkAround(readMarkdown(t), start, end);
  if (own) {
    const open = own.parts[0]!;
    const close = own.parts.at(-1)!;
    return apply(t, start, end, [{ at: open.from, cut: open.to - open.from, put: '' }, { at: close.from, cut: close.to - close.from, put: '' }]);
  }
  const said = t.slice(start, end).includes('\n') ? '' : t.slice(start, end);
  const link = `[${said || words}](${ADDRESS})`;
  const at = start + link.length - ADDRESS.length - 1;
  return { text: t.slice(0, start) + link + t.slice(end), start: at, end: at + ADDRESS.length };
}

/** An image at the selection, its words the selection or `words`; its address selected to type over. */
export function insertImage(t: string, start: number, end: number, words: string): MdEdit {
  const said = t.slice(start, end).includes('\n') ? '' : t.slice(start, end);
  const image = `![${said || words}](${ADDRESS})`;
  const at = start + image.length - ADDRESS.length - 1;
  return { text: t.slice(0, start) + image + t.slice(end), start: at, end: at + ADDRESS.length };
}

/** A comment at the selection, its words the selection or `words`, selected. */
export function insertComment(t: string, start: number, end: number, words: string): MdEdit {
  const said = t.slice(start, end) || words;
  const at = start + 5;
  return { text: `${t.slice(0, start)}<!-- ${said} -->${t.slice(end)}`, start: at, end: at + said.length };
}

/** A table after the selection's line — a blank line before it, where the line has words — two columns, a header and one
 *  row; its first heading selected. */
export function insertTable(t: string, _start: number, end: number, heading: string): MdEdit {
  const lines = readMarkdown(t);
  const line = lines[lineAt(lines, end)]!;
  const blank = line.block === 'blank';
  const before = blank ? '' : '\n\n';
  const table = `| ${heading} | ${heading} |\n| --- | --- |\n|  |  |`;
  const at = (blank ? line.at : line.end) + before.length + 2;
  const put = blank ? table : before + table;
  const from = blank ? line.at : line.end;
  const cut = blank ? line.end - line.at : 0;
  return { text: t.slice(0, from) + put + t.slice(from + cut), start: at, end: at + heading.length };
}

/** Text typed over the selection, the caret after it: a value the selection cuts into goes whole. */
export function typeText(t: string, start: number, end: number, insert: string): MdEdit {
  if (start === end) return replaceText(t, start, end, insert);
  const cut = deleteBack(t, start, end);
  return replaceText(cut.text, cut.start, cut.start, insert);
}

/** A value at the selection: a space before it where it follows a word or a mark, none at a line's start or after a
 *  space. */
export function insertValue(t: string, start: number, end: number, key: string): MdEdit {
  const cut = start === end ? { text: t, start } : deleteBack(t, start, end);
  const before = cut.text[cut.start - 1];
  return replaceText(cut.text, cut.start, cut.start, `${before !== undefined && !SPACE.test(before) ? ' ' : ''}${key}`);
}
