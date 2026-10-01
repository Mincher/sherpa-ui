import { test, expect } from '@playwright/test';

/**
 * EVERY FILTER CONTROL SHOWS THE QUERY'S ANSWER — TODO 137.
 *
 * Will, 2026-09-30: "Numeric range filter values don't match between the
 * filter-panel and filter-toolbar. I'm worried that we're not using a
 * centralised condition query etc. to coordinate filters."
 *
 * There IS one owner: the Query in the DataSource. A toolbar, the header bar,
 * the filter panel and a grid heading are VIEWS of it. This walks one Records
 * page through every kind of answer, set in one control and read in the
 * others, and after EACH step asks the same thing: does every control hold
 * what the Query holds — the panel too, open or shut?
 *
 * TRAP T-a-panel-follows-the-query-open-or-shut
 * TRAP T-a-suspended-answer-is-drawn-as-off
 * TRAP T-empty-is-every-kind-of-answer
 * TRAP T-a-panel-date-answers-with-its-days
 */
const APP = 'http://localhost:4200/?context=records';

test('a toolbar, the header, the panel and a grid heading all show what the Query holds', async ({ page }) => {
  // One long walk: forty steps, each one waiting for the page to settle.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(APP);
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row'), undefined, { timeout: 30000 });

  const steps = await page.evaluate(async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const wait = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    const source = (window as any).sherpa.source;
    const provider = document.querySelector('sherpa-provider') as any;
    const bar = document.querySelector('#qft') as any;
    const grid = document.querySelector('#grid') as any;
    const head = document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar[slot="filters"]') as any;
    const panel = document.querySelector('#filter-panel') as any;
    await wait(600);

    /** An answer IN FORCE, as one comparable string — null when nothing filters. */
    const inForce = (x: any): string | null => {
      if (!x || x.suspended) return null;
      const rows = (x.conditions ?? []).filter((c: any) => (c.text ?? '').trim() || (c.picked ?? []).length)
        .map((c: any) => [c.join ?? '', c.op, c.text ?? '', (c.picked ?? []).map(String)]);
      const picked = (x.picked ?? []).map(String).sort();
      const text = (x.text ?? '').trim();
      const advanced = (x.mode ?? (rows.length && !picked.length ? 'advanced' : 'simple')) === 'advanced';
      const o: Record<string, unknown> = {};
      if (!advanced && picked.length) o.picked = picked;
      if (!advanced && text) o.text = text;
      if (!advanced && (picked.length || text) && x.op && x.op !== 'eq') o.op = x.op;
      if (!advanced && x.range != null && (picked.length || text)) o.range = x.range;
      if (advanced && rows.length) o.rows = rows;
      return Object.keys(o).length ? JSON.stringify(o) : null;
    };
    const FIELDS: [string, string][] = [
      ['data', 'status'], ['data', 'plan'], ['data', 'owner'], ['data', 'seats'],
      ['view', 'region'], ['view', 'created'], ['view', 'customer'],
    ];
    const out: { step: string; wrong: string[] }[] = [];
    /** The panel's Group or Sort chip, in the grid's scope. */
    const arrangeChip = (kind: string): any => ([...panel.shadowRoot.querySelectorAll('.value')] as any[])
      .find((c) => c.dataset.value === kind && c.closest('[data-scope="data"]'));
    /** Pick row `i` of a Group or Sort chip's menu. */
    const arrange = async (c: any, i: number): Promise<void> => {
      const m = c.querySelector('sherpa-menu'); m.show(c); await wait(250);
      ([...m.querySelectorAll('input')] as HTMLInputElement[])[i]!.click(); await wait(400);
      m.hide?.(); await wait(500);
    };
    /** Every control against the Query. The panel is checked open AND shut. */
    const check = (step: string): void => {
      const wrong: string[] = [];
      for (const [scope, field] of FIELDS) {
        const query = inForce(source.reading(scope, field));
        const inBar = inForce((scope === 'view' ? head : bar).readings[field]);
        const inPanel = inForce(panel.readings?.[scope]?.[field]);
        if (provider.filterMode === 'toolbars' && inBar !== query) wrong.push(`${field}: bar ${inBar}, Query ${query}`);
        if (inPanel !== query) wrong.push(`${field}: panel ${inPanel}, Query ${query}`);
      }
      // GROUP and SORT: the column, and which way — on the bar and in the panel.
      const first = source.state.sort[0];
      const arranged: Record<string, string | null> = {
        sort: first ? `${first.field}:${first.direction}` : null,
        group: source.state.group ? `${source.state.group}:` : null,
      };
      for (const kind of ['sort', 'group']) {
        const shown = (c: any): string | null => (c?.hasAttribute('data-current')
          ? `${c.column}:${kind === 'sort' ? c.dataset.direction : ''}` : null);
        const onBar = shown(([...bar.shadowRoot.querySelectorAll('.organise-chip')] as any[]).find((c) => c.dataset.kind === kind));
        const inPanel = shown(arrangeChip(kind));
        if (onBar !== arranged[kind]) wrong.push(`${kind}: bar ${onBar}, source ${arranged[kind]}`);
        if (inPanel !== arranged[kind]) wrong.push(`${kind}: panel ${inPanel}, source ${arranged[kind]}`);
      }
      const presets = JSON.stringify(source.query.applied.scopes.data?.presets ?? {});
      const barPresets = JSON.stringify(Object.fromEntries(Object.entries(bar.presets ?? {}).map(([k, v]: any) => [k, v.on])));
      if (presets !== barPresets) wrong.push(`presets: bar ${barPresets}, Query ${presets}`);
      out.push({ step, wrong });
    };
    const to = async (mode: 'toolbars' | 'panel'): Promise<void> => { provider.filterMode = mode; await wait(900); };
    const chip = (b: any, id: string): any => b.shadowRoot.querySelector(`.chip[data-id="${id}"]`);
    const menuOf = (b: any, id: string): any => chip(b, id).querySelector('sherpa-menu');
    const open = async (b: any, id: string): Promise<any> => { const m = menuOf(b, id); m.show(chip(b, id)); await wait(250); return m; };
    const apply = async (m: any): Promise<void> => { m.shadowRoot.querySelector('.apply').click(); await wait(900); };
    /** Type as a reader does: into the field's own control. */
    const type = (field: any, value: string): void => {
      const c = field.shadowRoot.querySelector('.control');
      c.value = value;
      c.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      c.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const tick = async (b: any, id: string, value: string): Promise<void> => {
      const m = await open(b, id);
      ([...m.querySelectorAll('input')] as HTMLInputElement[]).find((i) => i.value === value)!.click();
      await wait(200);
      if (m.hasAttribute('open')) m.hide();
      await wait(700);
    };
    const panelField = (field: string): any => panel.shadowRoot.querySelector(`.field[data-field="${field}"]`);
    const total = (): number => source.debugState().total;

    check('start');

    // ── A LIST, and OFF ────────────────────────────────────────────────
    await tick(bar, 'status', 'active'); check('toolbar: Status = active');
    chip(bar, 'status').shadowRoot.querySelector('.body').click(); await wait(700);
    check('toolbar: Status switched OFF — its value kept, and nothing filtered');
    const offTotal = total();
    await to('panel'); check('panel: an OFF answer shows as no answer');
    await to('toolbars');
    chip(bar, 'status').shadowRoot.querySelector('.body').click(); await wait(700);
    check('toolbar: Status ON again');

    // ── A NUMBER, both shapes ──────────────────────────────────────────
    bar.addFilters(['seats']); await wait(700);
    { const m = await open(bar, 'seats');
      const s = m.shadowRoot.querySelector('.body-number-range');
      type(s.shadowRoot.querySelector('.value-start'), '37'); type(s.shadowRoot.querySelector('.value-end'), '120');
      await wait(150); await apply(m); }
    check('toolbar: Seats 37 to 120');
    await to('panel'); check('panel opens on Seats 37 to 120');
    { const s = panelField('seats').querySelector('sherpa-menu').shadowRoot.querySelector('.body-number-range');
      type(s.shadowRoot.querySelector('.value-start'), '60'); await wait(900); }
    check('panel: Seats start 60');
    // The END the toolbar set is still there: the panel did not write an old answer back.
    const keptEnd = JSON.stringify(source.reading('data', 'seats').picked);
    await to('toolbars'); check('toolbar shows Seats 60 to 120');
    { const m = await open(bar, 'seats');
      m.shadowRoot.querySelector('.body-range-switch').shadowRoot.querySelector('.input').click(); await wait(150);
      type(m.shadowRoot.querySelector('.body-number-one'), '12'); await wait(150); await apply(m); }
    check('toolbar: Seats = 12, the range kept');
    await to('panel'); check('panel shows Seats = 12, in the one-value shape');
    const panelSeats = panelField('seats').querySelector('sherpa-menu').reading;

    // ── CONDITIONS ─────────────────────────────────────────────────────
    await to('toolbars');
    { const m = await open(bar, 'owner');
      m.mode = 'advanced'; await wait(200);
      m.conditions = [{ op: 'startswith', text: 'U' }]; await wait(300);
      m.dispatchEvent(new Event('input', { bubbles: true }));
      await apply(m); }
    check('toolbar: Owner starts with U');
    await to('panel'); check('panel shows Owner starts with U');

    // ── A SAVED FILTER ─────────────────────────────────────────────────
    { const p = ([...panel.shadowRoot.querySelectorAll('.value')] as any[]).find((c) => c.dataset.value === 'has-tickets');
      p.shadowRoot.querySelector('.body').click(); await wait(900); }
    check('panel: Has open tickets ON');
    await to('toolbars'); check('toolbar shows Has open tickets ON');
    const presetChip = chip(bar, 'has-tickets').hasAttribute('data-current');

    // ── A DATE RANGE, both ways ────────────────────────────────────────
    const days = (menuOf(head, 'created').querySelector('sherpa-calendar').dataset.available ?? '').split(',').filter(Boolean).sort();
    const pick = async (m: any, from: string, until: string): Promise<void> => {
      const cal = m.querySelector('sherpa-calendar');
      cal.dataset.valueStart = from; cal.dataset.valueEnd = until;
      cal.dispatchEvent(new CustomEvent('range-select', { bubbles: true, composed: true }));
      await wait(200); await apply(m);
    };
    await pick(await open(head, 'created'), days[2], days[10]);
    check('header: Date, a range');
    await to('panel'); check('panel shows the Date range');
    { const dateChip = panelField('created').querySelector('.value');
      const m = dateChip.querySelector('sherpa-menu'); m.show(dateChip); await wait(300);
      await pick(m, days[4], days[8]); }
    check('panel: Date, a narrower range');
    const panelDate = JSON.stringify(source.reading('view', 'created').picked);
    await to('toolbars'); check('header shows the narrower Date range');

    // ── A GRID HEADING ─────────────────────────────────────────────────
    { const h = grid.shadowRoot.querySelector('.head-cell[data-field="seats"] .head-filter');
      const m = h.querySelector('sherpa-menu'); m.show(h); await wait(300);
      // "At least" is an Advanced row: a heading is the chip's own menu. TODO 86
      m.mode = 'advanced'; await wait(200);
      m.conditions = [{ op: 'gte', text: '100' }]; await wait(300);
      m.dispatchEvent(new Event('input', { bubbles: true }));
      await apply(m); }
    check('grid heading: Seats at least 100');
    const heading = JSON.stringify(grid.columnClause('seats'));

    // ── GROUP and SORT: an arrangement, set in each place ────────────────
    { const sortChip = ([...bar.shadowRoot.querySelectorAll('.organise-chip')] as any[]).find((c) => c.dataset.kind === 'sort');
      await arrange(sortChip, 0); check('toolbar: Sort by the first column');
      sortChip.shadowRoot.querySelector('.body').click(); await wait(600); check('toolbar: Sort turned the other way'); }
    const sortTip = ([...bar.shadowRoot.querySelectorAll('.organise-chip')] as any[]).find((c) => c.dataset.kind === 'sort')
      .shadowRoot.querySelector('.count-wrap').dataset.text;
    await to('panel'); check('panel shows the Sort');
    await arrange(arrangeChip('group'), 1); check('panel: Group by the second column');
    await to('toolbars'); check('toolbar shows the Group');
    grid.shadowRoot.querySelector('.head-cell[data-field="plan"] .head-btn').click(); await wait(700);
    check('grid heading: Sort by Plan');
    await to('panel'); check('panel shows the heading\'s Sort');
    await to('toolbars');

    // ── RESET, from each ───────────────────────────────────────────────
    bar.shadowRoot.querySelector('.act[data-act="clear"]').shadowRoot.querySelector('button').click(); await wait(900);
    check('toolbar: Reset empties every kind of field');
    const afterBarReset = ['status', 'owner', 'seats'].map((f) => JSON.stringify(source.reading('data', f) ?? null));
    await tick(bar, 'status', 'active');
    { const m = await open(bar, 'seats'); type(m.shadowRoot.querySelector('.body-number-one'), '50'); await wait(150); await apply(m); }
    await to('panel'); check('panel, before its Reset');
    panel.shadowRoot.querySelector('.reset-all').shadowRoot.querySelector('button').click(); await wait(900);
    check('panel: Reset empties every kind of field');
    const afterPanelReset = ['status', 'seats'].map((f) => JSON.stringify(source.reading('data', f) ?? null));
    await to('toolbars'); check('toolbar, after the panel Reset');

    return { out, sortTip, offTotal, all: 100, keptEnd, panelSeats, presetChip, panelDate, wantDate: JSON.stringify([days[4], days[8]]), heading, afterBarReset, afterPanelReset };
  });

  // The ONE claim, at every step: no control disagrees with the Query.
  expect(steps.out.filter((s) => s.wrong.length)).toEqual([]);
  // …and the steps did what they say.
  expect(steps.offTotal).toBe(steps.all);
  expect(steps.keptEnd).toBe('["60","120"]');
  expect(steps.panelSeats).toMatchObject({ picked: ['12'], range: false, kept: { picked: ['60', '120'] } });
  expect(steps.presetChip).toBe(true);
  expect(steps.panelDate).toBe(steps.wantDate);
  expect(steps.heading).toBe('["seats","gte",100]');
  // A sort says its column AND which way. TODO 125
  expect(steps.sortTip).toBe('Name, descending');
  expect(steps.afterBarReset).toEqual(['null', 'null', 'null']);
  expect(steps.afterPanelReset).toEqual(['null', 'null']);
});
