import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { FIXTURES } from '../a11y/fixtures.mjs';

/**
 * THE ACCESSIBILITY GATE — every component, WCAG 2.1 level AA. TODO 24.
 *
 * axe-core reads each component's fixture, and writes a REPORT per component
 * to `test/a11y/reports/`: what is wrong, the criterion it breaks, and how to
 * correct it. `test/a11y/baseline.json` holds the failures known today; a
 * count may only fall. `UPDATE_A11Y_BASELINE=1` records a new one.
 *
 * TRAP T-the-a11y-gate-reads-shadow-roots
 */
const HARNESS = '/test/reforged/harness.html';
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const REPORTS = 'test/a11y/reports';
const BASELINE = 'test/a11y/baseline.json';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type Fixture = { html: string; fill?: { at: string; data: unknown }[]; show?: string; anchor?: string };
type Failure = { rule: string; help: string; helpUrl: string; tags: string[]; nodes: { target: string; fix: string; html: string }[] };
type Counts = Record<string, number>;

// Chromium only: the rules are the same in every engine, and one baseline cannot hold three.
test.skip(({ browserName }) => browserName !== 'chromium', 'one engine, one baseline');
// ONE worker, in order: an update writes the one baseline file from every test.
test.describe.configure({ mode: 'default' });

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.addScriptTag({ path: AXE });
});

/** Run axe over `#root`, shadow roots included. */
const audit = (page: Page): Promise<Failure[]> => page.evaluate(async (tags) => {
  type Axe = { run: (at: Element, options: unknown) => Promise<{ violations: {
    id: string; help: string; helpUrl: string; tags: string[];
    nodes: { target: (string | string[])[]; failureSummary?: string; html: string }[];
  }[] }> };
  const { violations } = await (window as unknown as { axe: Axe }).axe
    .run(document.getElementById('root')!, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
  return violations.map((v) => ({
    rule: v.id, help: v.help, helpUrl: v.helpUrl, tags: v.tags,
    nodes: v.nodes.map((n) => ({ target: n.target.flat().join(' >>> '), fix: n.failureSummary ?? '', html: n.html })),
  }));
}, TAGS);

/** Draw one fixture: its markup, its data, and the part it opens. */
const mount = (page: Page, fixture: Fixture): Promise<void> => page.evaluate(async (f) => {
  type Part = HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => unknown; show?: (anchor?: Element | null) => void };
  const settled = (window as unknown as { __settled: () => Promise<void> }).__settled;
  const root = document.getElementById('root')!;
  root.innerHTML = f.html;
  await settled();
  for (const { at, data } of f.fill ?? []) await root.querySelector<Part>(at)?.populate?.(data);
  await settled();
  if (f.show) root.querySelector<Part>(f.show)?.show?.(f.anchor ? root.querySelector(f.anchor) : undefined);
  await settled();
}, fixture);

/** `wcag412` → `4.1.2`, with its level. */
const criteria = (tags: string[]): string => {
  const level = tags.some((t) => /^wcag2\d?aa$/.test(t)) ? 'AA' : 'A';
  const found = tags.filter((t) => /^wcag\d{3,4}$/.test(t)).map((t) => {
    const d = t.slice(4);
    return `${d[0]}.${d[1]}.${d.slice(2)}`;
  });
  return `${found.join(', ') || 'no single criterion'} (level ${level})`;
};

/** One component's report: what is wrong, the criterion, and how to correct it. */
const report = (name: string, failures: Failure[]): string => [
  `# ${name} — accessibility, WCAG 2.1 AA`,
  '',
  failures.length ? `${failures.reduce((n, f) => n + f.nodes.length, 0)} failures, in ${failures.length} rules.` : 'No failures.',
  ...failures.flatMap((f) => [
    '',
    `## ${f.rule} — ${f.help}`,
    '',
    `- Breaks: WCAG ${criteria(f.tags)}`,
    `- More: ${f.helpUrl}`,
    ...f.nodes.flatMap((n) => [
      '',
      `### \`${n.target}\``,
      '',
      '```html',
      n.html,
      '```',
      '',
      n.fix,
    ]),
  ]),
  '',
].join('\n');

const counts = (failures: Failure[]): Counts => Object.fromEntries(failures.map((f) => [f.rule, f.nodes.length]));

const baseline = (): Record<string, Counts> => {
  try { return JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Counts>; } catch { return {}; }
};

test('axe reaches inside a shadow root', async ({ page }) => {
  const found = await page.evaluate(() => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<button></button>';
    document.getElementById('root')!.replaceChildren(host);
  }).then(() => audit(page));
  expect(found.map((f) => f.rule)).toEqual(['button-name']);
  // The target crosses the boundary: host, then the node inside it.
  expect(found[0]!.nodes[0]!.target).toContain(' >>> button');
});

test('a host label reaches its control — read by ROLE, never the attribute', async ({ page }) => {
  await mount(page, { html: '<sherpa-switch aria-label="Increase contrast"></sherpa-switch>'
    + '<sherpa-button data-type="icon" data-icon-start="xmark" aria-label="Close"></sherpa-button>' });
  await expect(page.getByRole('switch', { name: 'Increase contrast' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(1);
});

test('every component has a fixture', () => {
  const components = readdirSync('src/components').filter((d) => d.startsWith('sherpa-')).sort();
  expect(Object.keys(FIXTURES).sort()).toEqual(components);
});

for (const [name, fixture] of Object.entries(FIXTURES as Record<string, Fixture>)) {
  test(`${name} meets WCAG 2.1 AA, or fails no more than its baseline`, async ({ page }) => {
    await mount(page, fixture);
    const failures = await audit(page);
    mkdirSync(REPORTS, { recursive: true });
    writeFileSync(`${REPORTS}/${name}.md`, report(name, failures));

    const now = counts(failures);
    if (process.env.UPDATE_A11Y_BASELINE) {
      const { [name]: _was, ...rest } = baseline();
      const next = failures.length ? { ...rest, [name]: now } : rest;
      const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
      writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
      return;
    }
    const known = baseline()[name] ?? {};
    expect(now, `${name}: see ${REPORTS}/${name}.md. A count that FELL needs UPDATE_A11Y_BASELINE=1.`).toEqual(known);
  });
}
