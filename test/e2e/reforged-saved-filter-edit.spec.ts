import { test, expect, type Bar } from './harness';

/**
 * A SAVED FILTER KEEPS ITS EDIT — Will, TODO 50: "The same `fx` button, with
 * rows that can be edited. On a filter the reader SAVED that is applied, an
 * edit is a temporary DRAFT; the saved filter does not change. When the draft
 * differs, the menu … offer[s] Save."
 *
 * A line of a reader's own saved filter opens its field in that field's own
 * menu. Apply is the change; its source keeps it, and the chip wears the
 * pending look until it is saved or put back.
 * TRAP T-a-saved-filter-keeps-its-edit
 */

const OWNERS = [
  { value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }, { value: 'Unassigned', label: 'Nobody' },
];

test('a saved line opens its field; Apply sends the change, and the saved filter keeps what it saved', async ({ page }) => {
  const r = await page.evaluate(async (OPTS) => {
    const saved = { owner: { picked: ['Dana', 'Unassigned'] } };
    const bar = await window.__mount<Bar & {
      drawScope(s: unknown): Promise<void>;
      packFilter(s: { id: string; label: string; readings: unknown }): void;
    }>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', options: OPTS },
      { id: 'custom:mine', label: 'Mine', editable: true, removable: true, active: true, readings: saved },
      { id: 'at-risk', label: 'At risk', readings: { owner: { picked: ['Unassigned'] } } },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const sr = bar.shadowRoot!;
    const chip = (id: string) => sr.querySelector<HTMLElement & { toggleMenu(): void }>(`.chip[data-id="${id}"]`)!;
    const menuOf = (id: string) => chip(id).querySelector<HTMLElement>('sherpa-menu')!;
    const rows = (id: string) => [...menuOf(id).children].map((row) =>
      `${row.localName}${row.hasAttribute('data-drill') ? '.drill' : ''}:${row.textContent!.trim()}`);
    const heard: unknown[] = [];
    for (const type of ['preset-edit', 'filter-save', 'quick-filter-change']) {
      bar.addEventListener(type, (e) => heard.push({ type, ...(e as CustomEvent).detail }));
    }

    // Only the reader's OWN opens a line; a shipped one only says it.
    const lines = { own: rows('custom:mine'), shipped: rows('at-risk') };

    chip('custom:mine').toggleMenu();
    await window.__settled();
    menuOf('custom:mine').querySelector<HTMLElement>('[data-drill]')!.click();
    await window.__settled();
    const editor = sr.querySelector<HTMLElement & { open: boolean; values: string[] }>('.qf-editor sherpa-menu')!;
    const opened = {
      open: editor.open, values: editor.values, heading: editor.dataset['heading'],
      savedShut: !menuOf('custom:mine').hasAttribute('open'),
      commits: editor.hasAttribute('data-commit'),
    };
    // Untick Nobody, and Apply.
    editor.querySelector<HTMLInputElement>('input[value="Unassigned"]')!.click();
    editor.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await window.__settled();
    const applied = { heard: [...heard], gone: !sr.querySelector('.qf-editor sherpa-menu') };
    heard.length = 0;

    // Its SOURCE keeps the change and draws it back: the pending look, the new line, Save and Discard.
    const edit = { owner: { picked: ['Dana'] } };
    await bar.drawScope({ holds: ['owner'], readings: {}, presets: { 'custom:mine': true }, edits: { 'custom:mine': edit } });
    await window.__settled();
    const box = (id: string) => chip(id).shadowRoot!.querySelector<HTMLElement>('.body')!;
    const body = (id: string) => getComputedStyle(box(id));
    chip('owner').setAttribute('data-pending', '');
    // Both at REST: a chip's colours transition.
    await Promise.all(['owner', 'custom:mine'].flatMap((id) => box(id).getAnimations().map((a) => a.finished)));
    const drawn = {
      edited: chip('custom:mine').hasAttribute('data-edited'),
      rows: rows('custom:mine'),
      // The pending look: the active edge, and no fill.
      edge: body('custom:mine').borderColor === body('owner').borderColor,
      fill: body('custom:mine').backgroundColor === body('owner').backgroundColor,
      presets: bar.presets,
    };
    chip('owner').removeAttribute('data-pending');

    menuOf('custom:mine').querySelector<HTMLButtonElement>('button[value="save-edit"]')!.click();
    menuOf('custom:mine').querySelector<HTMLButtonElement>('button[value="discard-edit"]')!.click();
    const actions = [...heard];
    heard.length = 0;

    // Saved under its own name: the change is spent, and its source is told.
    bar.packFilter({ id: 'custom:mine', label: 'Mine', readings: edit });
    await window.__settled();
    return {
      lines, opened, applied, drawn, actions,
      packed: { heard: heard.filter((h) => (h as { type: string }).type === 'preset-edit'),
        edited: chip('custom:mine').hasAttribute('data-edited') },
    };
  }, OWNERS);

  expect(r.lines.own).toEqual([
    'p:Owner', 'label.drill:Is one of Dana, Nobody', 'hr:', 'button:Edit filter', 'button:Delete filter',
  ]);
  expect(r.lines.shipped).toEqual(['p:Owner', 'p:Equals Nobody']);
  // The FIELD's own menu, holding the saved answer, waiting for Apply.
  expect(r.opened).toEqual({ open: true, values: ['Dana', 'Unassigned'], heading: 'Owner', savedShut: true, commits: true });
  // ONE change, the chip it was on stays on, and nothing else is reported.
  expect(r.applied.heard).toEqual([{ type: 'preset-edit', id: 'custom:mine', readings: { owner: { picked: ['Dana'] } } }]);
  expect(r.applied.gone).toBe(true);
  expect(r.drawn).toEqual({
    edited: true,
    rows: ['p:Owner', 'label.drill:Equals Dana', 'hr:', 'button:Save filter', 'button:Discard changes',
      'button:Edit filter', 'button:Delete filter'],
    edge: true, fill: true,
    // The LIBRARY keeps what was saved.
    presets: { 'custom:mine': { on: true, readings: { owner: { picked: ['Dana', 'Unassigned'] } } },
      'at-risk': { on: false, readings: { owner: { picked: ['Unassigned'] } } } },
  });
  expect(r.actions).toEqual([
    { type: 'filter-save', readings: { owner: { picked: ['Dana'] } }, id: 'custom:mine', label: 'Mine' },
    { type: 'preset-edit', id: 'custom:mine', readings: null },
  ]);
  expect(r.packed).toEqual({ heard: [{ type: 'preset-edit', id: 'custom:mine', readings: null }], edited: false });
});

test('an OFF saved filter comes on as its change is applied; a number opens on its rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'health', label: 'Health', kind: 'number', advanced: true, min: 0, max: 100 },
      { id: 'custom:risky', label: 'Risky', editable: true, removable: true,
        readings: { health: { conditions: [{ op: 'lt', text: '60' }] } } },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const sr = bar.shadowRoot!;
    const chip = sr.querySelector<HTMLElement & { toggleMenu(): void; current: boolean }>('.chip[data-id="custom:risky"]')!;
    const heard: unknown[] = [];
    for (const type of ['preset-edit', 'quick-filter-change']) {
      bar.addEventListener(type, (e) => heard.push({ type, active: (e as CustomEvent).detail?.active, ...(e as CustomEvent).detail }));
    }
    chip.toggleMenu();
    await window.__settled();
    chip.querySelector<HTMLElement>('sherpa-menu [data-drill]')!.click();
    await window.__settled();
    const editor = sr.querySelector<HTMLElement & {
      mode: string; conditions: { op: string; text?: string }[]; reading: unknown;
    }>('.qf-editor sherpa-menu')!;
    const opened = { mode: editor.mode, rows: editor.conditions.map((c) => [c.op, c.text]) };
    editor.conditions = [{ op: 'lt', text: '50' }];
    editor.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await window.__settled();
    return {
      opened, on: chip.current,
      heard: heard.map((h) => {
        const { type, id, readings, active } = h as Record<string, unknown>;
        return type === 'preset-edit' ? { type, id, readings } : { type, active };
      }),
    };
  });

  expect(r.opened).toEqual({ mode: 'advanced', rows: [['lt', '60']] });
  expect(r.on).toBe(true);
  // ON first, then the change: a scope drawn with it off would switch it off.
  expect(r.heard).toEqual([
    { type: 'quick-filter-change', active: ['custom:risky'] },
    { type: 'preset-edit', id: 'custom:risky', readings: { health: { conditions: [{ op: 'lt', text: '50' }] } } },
  ]);
});

/** THE RECORDS PAGE, end to end, against the examples server (:4200). */
test('the Records page changes a saved filter, keeps it unsaved, then saves it under its name', async ({ page }) => {
  const native: string[] = [];
  page.on('dialog', (d) => { native.push(d.type()); void d.dismiss(); });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await page.evaluate(() => localStorage.removeItem('sherpa:filters:customers'));
  const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('sherpa:filters:customers') ?? '{}'));
  const total = () => page.evaluate(() =>
    (window as unknown as { sherpa: { source: { debugState(): { total: number } } } }).sherpa.source.debugState().total);
  const inBar = (sel: string) => page.evaluate((s) => !!document
    .querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!.querySelector(s), sel);
  const nameIt = async (name: string) => {
    await expect.poll(() => page.evaluate(() =>
      (document.querySelector('#save-filter') as HTMLElement & { open: boolean }).open)).toBe(true);
    const offered = await page.evaluate(() =>
      (document.querySelector('#save-filter-name') as HTMLElement & { value: string }).value);
    await page.evaluate((n) => {
      (document.querySelector('#save-filter-name') as HTMLElement & { value: string }).value = n;
      document.querySelector('#save-filter-ok')!.shadowRoot!.querySelector('button')!.click();
    }, name);
    return offered;
  };

  // Save Pro and Enterprise as "Big plans".
  await page.evaluate(() => {
    const qft = document.querySelector('#context-root sherpa-quick-filter-toolbar') as Bar & {
      setChipReading(id: string, r: unknown): void; report(): void;
    };
    qft.setChipReading('plan', { picked: ['Pro', 'Enterprise'] });
    qft.report();
  });
  await expect.poll(() => inBar('.add-btn sherpa-menu[data-saveable]')).toBe(true);
  await page.evaluate(() => document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
    .querySelector('.add-btn sherpa-menu')!.shadowRoot!.querySelector<HTMLElement>('.save')!.click());
  await nameIt('Big plans');
  await expect.poll(kept).toEqual({ 'big-plans': { label: 'Big plans', readings: { plan: { picked: ['Pro', 'Enterprise'] } } } });
  await expect.poll(() => inBar('.chip[data-id="custom:big-plans"][data-current]')).toBe(true);
  const both = await total();

  // CHANGE it: Pro only. The rows follow; what is saved does not.
  await page.evaluate(async () => {
    const sr = document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!;
    const chip = sr.querySelector<HTMLElement & { toggleMenu(): void }>('.chip[data-id="custom:big-plans"]')!;
    chip.toggleMenu();
    await new Promise((r) => requestAnimationFrame(r));
    chip.querySelector<HTMLElement>('sherpa-menu [data-drill]')!.click();
  });
  await expect.poll(() => inBar('.qf-editor sherpa-menu[open]')).toBe(true);
  await page.evaluate(() => {
    const editor = document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
      .querySelector<HTMLElement>('.qf-editor sherpa-menu')!;
    editor.querySelector<HTMLInputElement>('input[value="Enterprise"]')!.click();
    editor.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
  });
  await expect.poll(() => inBar('.chip[data-id="custom:big-plans"][data-edited][data-current]')).toBe(true);
  await expect.poll(total).toBeLessThan(both);
  expect(await page.evaluate(() => (window as unknown as {
    sherpa: { source: { query: { applied: { scopes: Record<string, { edits?: unknown }> } } } };
  }).sherpa.source.query.applied.scopes['data']?.edits)).toEqual({ 'custom:big-plans': { plan: { picked: ['Pro'] } } });
  expect((await kept())['big-plans'].readings).toEqual({ plan: { picked: ['Pro', 'Enterprise'] } });

  // A RELOAD keeps the change: it is in the Query.
  const changed = await total();
  await page.reload();
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await expect.poll(() => inBar('.chip[data-id="custom:big-plans"][data-edited][data-current]')).toBe(true);
  await expect.poll(total).toBe(changed);

  // SAVE it: its own name is offered, and the change is what is kept.
  await page.evaluate(() => document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
    .querySelector<HTMLButtonElement>('.chip[data-id="custom:big-plans"] sherpa-menu button[value="save-edit"]')!.click());
  expect(await nameIt('Big plans')).toBe('Big plans');
  await expect.poll(kept).toEqual({ 'big-plans': { label: 'Big plans', readings: { plan: { picked: ['Pro'] } } } });
  await expect.poll(() => inBar('.chip[data-id="custom:big-plans"][data-edited]')).toBe(false);
  await expect.poll(() => inBar('.chip[data-id="custom:big-plans"][data-current]')).toBe(true);
  expect(native).toEqual([]);
  await page.evaluate(() => localStorage.removeItem('sherpa:filters:customers'));
});

/** THE PANEL, which answers for the bar in panel mode, has the same doors. */
test('in the panel a saved line opens its field; its change is drawn, saved or put back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const owner = { id: 'owner', label: 'Owner', select: 'multiple',
      options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }, { value: 'Unassigned', label: 'Nobody' }] };
    const saved = { owner: { picked: ['Dana', 'Unassigned'] } };
    const mine = { id: 'custom:mine', label: 'Mine', preset: true, editable: true, readings: saved };
    const panel = await window.__mount<HTMLElement & { populate(d: unknown): Promise<void> }>('sherpa-filter-panel',
      [{ scope: 'data', label: 'Customer records', filters: [mine, owner] }], { open: true, style: 'inline-size: 400px' });
    await window.__settled();
    const sr = panel.shadowRoot!;
    const chip = () => sr.querySelector<HTMLElement & { toggleMenu(): void }>('.value[data-value="custom:mine"]')!;
    const rows = () => [...chip().querySelector('sherpa-menu')!.children]
      .map((row) => `${row.localName}${row.hasAttribute('data-drill') ? '.drill' : ''}:${row.textContent!.trim()}`);
    const heard: unknown[] = [];
    for (const type of ['preset-edit', 'filter-save', 'quick-filter-change']) {
      panel.addEventListener(type, (e) => {
        const d = (e as CustomEvent).detail;
        heard.push(type === 'quick-filter-change' ? { type, presets: d.readings?.data?.presets?.picked } : { type, ...d });
      });
    }

    chip().toggleMenu();
    await window.__settled();
    chip().querySelector<HTMLElement>('sherpa-menu [data-drill]')!.click();
    await window.__settled();
    const editor = sr.querySelector<HTMLElement & { open: boolean; values: string[] }>('.editor sherpa-menu')!;
    const opened = { open: editor.open, values: editor.values };
    editor.querySelector<HTMLInputElement>('input[value="Unassigned"]')!.click();
    editor.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await window.__settled();
    const applied = [...heard];
    heard.length = 0;

    // Its source draws the change back.
    await panel.populate([{ scope: 'data', label: 'Customer records', filters: [
      { ...mine, active: true, edited: { owner: { picked: ['Dana'] } } }, owner,
    ] }]);
    await window.__settled();
    const drawn = { edited: chip().hasAttribute('data-edited'), rows: rows() };
    chip().querySelector<HTMLButtonElement>('button[value="save-edit"]')!.click();
    chip().querySelector<HTMLButtonElement>('button[value="discard-edit"]')!.click();
    return { opened, applied, drawn, actions: heard, gone: !sr.querySelector('.editor sherpa-menu') };
  });

  expect(r.opened).toEqual({ open: true, values: ['Dana', 'Unassigned'] });
  // ON first, as a tap on it would, then the change — in its scope.
  expect(r.applied).toEqual([
    { type: 'quick-filter-change', presets: ['custom:mine'] },
    { type: 'preset-edit', scope: 'data', id: 'custom:mine', readings: { owner: { picked: ['Dana'] } } },
  ]);
  expect(r.drawn).toEqual({
    edited: true,
    rows: ['p:Owner', 'label.drill:Equals Dana', 'hr:', 'button:Save filter', 'button:Discard changes',
      'button:Edit filter', 'button:Delete filter'],
  });
  expect(r.actions).toEqual([
    { type: 'filter-save', scope: 'data', readings: { owner: { picked: ['Dana'] } }, id: 'custom:mine', label: 'Mine' },
    { type: 'preset-edit', scope: 'data', id: 'custom:mine', readings: null },
  ]);
  expect(r.gone).toBe(true);
});
