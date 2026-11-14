/**
 * A MARKDOWN TEXT IS ITS OWN MODEL: read as lines, blocks and inline parts, each part a range of the text — so a line's
 * parts joined are the line again — and every edit a Markdown editor makes is an edit of the text, with the selection
 * after it. Plan 892.
 *
 *   node --test test/unit/a-markdown-text-is-its-own-model.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const md = await import(new URL('../../dist/core/data/markdown-text.js', import.meta.url));

/** A line's parts as words: `text`, `mark:**`, `strong(…)`. */
const said = (t, parts) => parts.map((p) => ('parts' in p ? `${p.type}(${said(t, p.parts)})` : p.type === 'text' ? t.slice(p.from, p.to) : `${p.type}:${t.slice(p.from, p.to)}`)).join(' | ');
const leaves = (parts) => parts.flatMap((p) => ('parts' in p ? leaves(p.parts) : [p]));

const SAMPLE = [
  '# Title', 'Hi **bold** and *it* and ***both*** {{value:s.name}} `co*de` [a **link**](https://x.io) ![pic](u.png) <!-- note -->',
  '- one', '  - two', '1. first', '7. second', '   1. inner', '> quoted', '```', 'code *as is*', '```',
  '| a | b |', '| --- | --- |', '| `|` | **y** |', '---', 'snake_case _em_ a*b*c \\*not\\*', '',
].join('\n');

test('every line\'s parts, joined, are the line again: the text is the model', () => {
  for (const line of md.readMarkdown(SAMPLE)) {
    const all = leaves(line.parts);
    let at = line.at + line.marker;
    for (const p of all) {
      assert.equal(p.from, at, `a gap or an overlap at ${at}`);
      at = p.to;
    }
    assert.equal(at, all.length ? line.end : line.at + line.marker);
  }
});

test('a line is read as its block: its mark, its level, its depth and the number it reads', () => {
  const lines = md.readMarkdown(SAMPLE);
  assert.deepEqual(lines.map((l) => [l.block, l.level, l.marker, l.depth, l.number]), [
    ['heading', 1, 2, 0, 0], ['paragraph', 0, 0, 0, 0], ['bullet', 0, 2, 0, 0], ['bullet', 0, 4, 1, 0],
    ['number', 0, 3, 0, 1], ['number', 0, 3, 0, 2], ['number', 0, 6, 1, 1], ['quote', 0, 2, 0, 0],
    ['fence', 0, 0, 0, 0], ['code', 0, 0, 0, 0], ['fence', 0, 0, 0, 0],
    ['table', 0, 0, 0, 0], ['table-rule', 0, 0, 0, 0], ['table', 0, 0, 0, 0], ['rule', 0, 0, 0, 0],
    ['paragraph', 0, 0, 0, 0], ['blank', 0, 0, 0, 0],
  ]);
});

test('inline: strong, em, both, a value, code, a link with its words read, an image, a comment, escapes', () => {
  const lines = md.readMarkdown(SAMPLE);
  assert.equal(said(SAMPLE, lines[1].parts), [
    'Hi ', 'strong(mark:** | bold | mark:**)', ' and ', 'em(mark:* | it | mark:*)', ' and ',
    'strong(mark:** | em(mark:* | both | mark:*) | mark:**)', ' ', 'value:{{value:s.name}}', ' ', 'code(mark:` | co*de | mark:`)', ' ',
    'link(mark:[ | a  | strong(mark:** | link | mark:**) | mark:](https://x.io))', ' ', 'image(mark:![ | pic | mark:](u.png))', ' ',
    'comment(mark:<!-- |  note  | mark:-->)',
  ].join(' | '));
  assert.equal(lines[1].parts.find((p) => p.type === 'link').href, 'https://x.io');
  // An underscore inside a word is a character; an asterisk is not.
  assert.equal(said(SAMPLE, lines[15].parts), 'snake_case  | em(mark:_ | em | mark:_) |  a | em(mark:* | b | mark:*) | c  | escape(mark:\\ | *) | not | escape(mark:\\ | *)');
  // Code keeps its words as they are; a table's pipes are marks, and code in a cell keeps its pipe.
  assert.equal(said(SAMPLE, lines[9].parts), 'code *as is*');
  assert.equal(said(SAMPLE, lines[13].parts), 'mark:| |   | code(mark:` | | | mark:`) |   | mark:| |   | strong(mark:** | y | mark:**) |   | mark:|');
});

test('marks not shut are text', () => {
  const t = 'a ** b, *c, `d, [e](f, {g}';
  assert.equal(said(t, md.readMarkdown(t)[0].parts), t);
});

test('Bold, Italic and Code: on a selection, a line at a time; off where it stands in one; a caret takes its word', () => {
  assert.deepEqual(md.toggleSpan('make this bold', 10, 14, 'strong'), { text: 'make this **bold**', start: 12, end: 16 });
  assert.deepEqual(md.toggleSpan('make this **bold**', 13, 13, 'strong'), { text: 'make this bold', start: 11, end: 11 });
  assert.deepEqual(md.toggleSpan('one word', 6, 6, 'em'), { text: 'one *word*', start: 7, end: 7 });
  assert.deepEqual(md.toggleSpan('a ', 2, 2, 'strong'), { text: 'a ****', start: 4, end: 4 });
  // Spaces at a selection's ends stay outside its marks; each line is its own.
  assert.equal(md.toggleSpan('- one \n- two', 0, 12, 'strike').text, '- ~~one~~ \n- ~~two~~');
  assert.equal(md.toggleSpan('x = 1', 0, 5, 'code').text, '`x = 1`');
});

test('a style replaces each line\'s block mark; code fences the lines, and again takes the fence away', () => {
  assert.deepEqual(md.setStyle('Hello\nWorld', 2, 8, 'h2'), { text: '## Hello\n## World', start: 5, end: 14 });
  assert.equal(md.setStyle('- item', 3, 3, 'quote').text, '> item');
  assert.equal(md.setStyle('# Title', 3, 3, 'paragraph').text, 'Title');
  assert.deepEqual(md.setStyle('a\nb', 0, 3, 'code'), { text: '```\na\nb\n```', start: 4, end: 7 });
  assert.deepEqual(md.setStyle('```\na\nb\n```', 5, 5, 'code'), { text: 'a\nb', start: 1, end: 1 });
});

test('lists: each line an item, numbered from 1; off where every line is one; Indent nests under the item above', () => {
  assert.equal(md.toggleList('a\nb', 0, 3, 'number').text, '1. a\n2. b');
  assert.equal(md.toggleList('1. a\n2. b', 0, 9, 'number').text, 'a\nb');
  assert.equal(md.toggleList('- a\n- b', 0, 7, 'number').text, '1. a\n2. b');
  assert.equal(md.indentItems('- a\n- b', 6, 6, 1).text, '- a\n  - b');
  assert.equal(md.indentItems('1. a\n2. b', 8, 8, 1).text, '1. a\n   1. b');
  assert.equal(md.indentItems('- a\n  - b', 8, 8, -1).text, '- a\n- b');
  // The first item has nothing to nest under; an outer one, nowhere to go.
  assert.equal(md.indentItems('- a', 2, 2, 1).text, '- a');
  assert.equal(md.indentItems('- a', 2, 2, -1).text, '- a');
});

test('Enter goes on with a list or a quote, an empty item ends it or steps out; Shift+Enter stays in the item', () => {
  assert.deepEqual(md.breakLine('- a', 3, 3), { text: '- a\n- ', start: 6, end: 6 });
  assert.deepEqual(md.breakLine('9. a', 4, 4), { text: '9. a\n10. ', start: 9, end: 9 });
  assert.deepEqual(md.breakLine('- a\n- ', 6, 6), { text: '- a\n', start: 4, end: 4 });
  assert.equal(md.breakLine('- a\n  - ', 8, 8).text, '- a\n- ');
  assert.equal(md.breakLine('> a', 3, 3).text, '> a\n> ');
  assert.equal(md.breakLine('# Title', 7, 7).text, '# Title\n');
  // At an item's start, an empty item goes above it, and the caret stays with its words.
  assert.deepEqual(md.breakLine('- a', 2, 2), { text: '- \n- a', start: 5, end: 5 });
  assert.equal(md.breakLine('- a', 3, 3, true).text, '- a\n  ');
});

test('Backspace takes a block mark at its line\'s start, a value whole, a grapheme whole; Delete joins the next line\'s words', () => {
  assert.deepEqual(md.deleteBack('- a', 2, 2), { text: 'a', start: 0, end: 0 });
  assert.equal(md.deleteBack('- a\n  - b', 8, 8).text, '- a\n- b');
  assert.deepEqual(md.deleteBack('Hi {{value:s.name}}', 19, 19), { text: 'Hi ', start: 3, end: 3 });
  assert.deepEqual(md.deleteBack('ok 👍🏽', 7, 7), { text: 'ok ', start: 3, end: 3 });
  assert.deepEqual(md.deleteBack('a\nb', 2, 2), { text: 'ab', start: 1, end: 1 });
  assert.equal(md.deleteBack('one two', 7, 7, 'word').text, 'one ');
  assert.deepEqual(md.deleteForward('a\n- b', 1, 1), { text: 'ab', start: 1, end: 1 });
  assert.deepEqual(md.deleteForward('{{value:s.name}} hi', 0, 0), { text: ' hi', start: 0, end: 0 });
  // A selection that cuts into a value takes the value whole.
  assert.equal(md.deleteBack('Hi {{value:s.name}}!', 5, 20).text, 'Hi ');
});

test('a link, an image and a comment select what is left to type; a table goes after its line; a value takes a space', () => {
  assert.deepEqual(md.toggleLink('see this', 4, 8, 'link'), { text: 'see [this](https://)', start: 11, end: 19 });
  assert.deepEqual(md.toggleLink('see [this](https://x)', 6, 6, 'link'), { text: 'see this', start: 5, end: 5 });
  assert.deepEqual(md.insertImage('', 0, 0, 'description'), { text: '![description](https://)', start: 15, end: 23 });
  assert.deepEqual(md.insertComment('a', 1, 1, 'comment'), { text: 'a<!-- comment -->', start: 6, end: 13 });
  assert.deepEqual(md.insertTable('Hello', 5, 5, 'Column'), { text: 'Hello\n\n| Column | Column |\n| --- | --- |\n|  |  |', start: 9, end: 15 });
  assert.deepEqual(md.insertValue('Hi', 2, 2, '{{value:s.name}}'), { text: 'Hi {{value:s.name}}', start: 19, end: 19 });
  assert.deepEqual(md.insertValue('Hi ', 3, 3, '{{value:s.name}}'), { text: 'Hi {{value:s.name}}', start: 19, end: 19 });
  // Typed over a selection that cuts into a value, the value goes whole.
  assert.deepEqual(md.typeText('Hi {{value:s.name}}!', 5, 20, 'you'), { text: 'Hi you', start: 6, end: 6 });
  assert.deepEqual(md.insertValue('Hi {{value:s.name}}', 3, 19, '{{value:s.count}}'), { text: 'Hi {{value:s.count}}', start: 20, end: 20 });
});

test('what the selection stands in: its style, its list, its spans, and whether its items can move', () => {
  const at = md.formatAt('## **bo*l*d**', 8, 8);
  assert.deepEqual([at.style, at.strong, at.em, at.list], ['h2', true, true, null]);
  assert.deepEqual(md.formatAt('- a\n- b', 6, 6), { style: 'paragraph', list: 'bullet', strong: false, em: false, strike: false, code: false, link: false, indent: true, outdent: false });
  // A caret at a span's very edge is outside it.
  assert.equal(md.formatAt('**b** c', 5, 5).strong, false);
});
