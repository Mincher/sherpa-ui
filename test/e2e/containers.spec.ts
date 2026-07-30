import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

/* ── sherpa-container ──────────────────────────────────────────── */

test('sherpa-container renders default/header/footer slots', async ({ page }) => {
  await mount(page, `<sherpa-container>
      <sherpa-container-header slot="header" data-label="Title"></sherpa-container-header>
      <div>Body</div>
      <div slot="footer">Foot</div>
    </sherpa-container>`, 'sherpa-container');
  const r = await page.evaluate(async () => {
    const c = document.querySelector('sherpa-container') as HTMLElement;
    await new Promise((res) => setTimeout(res, 150)); // slot detection
    const sr = c.shadowRoot!;
    const headerSlot = sr.querySelector('slot[name="header"]') as HTMLSlotElement;
    const defaultSlot = sr.querySelector('.card-content slot:not([name])') as HTMLSlotElement;
    const footerSlot = sr.querySelector('slot[name="footer"]') as HTMLSlotElement;
    return {
      variant: c.dataset['variant'],
      headerAssigned: headerSlot.assignedElements().length,
      // Note: the container injects a resize-menu <template data-menu> into the
      // light DOM, so the default slot also receives that alongside our body div.
      bodyHasDiv: defaultSlot.assignedElements().some((el) => el.tagName === 'DIV' && el.textContent === 'Body'),
      footerText: footerSlot.assignedElements()[0]?.textContent,
    };
  });
  expect(r.variant).toBe('fit'); // default applied in onRender
  expect(r.headerAssigned).toBe(1);
  expect(r.bodyHasDiv).toBe(true);
  expect(r.footerText).toBe('Foot');
});

test('sherpa-container data-selectable click toggles selection + fires card-select/card-click', async ({ page }) => {
  await mount(page, `<sherpa-container data-selectable>
      <div>Body</div>
    </sherpa-container>`, 'sherpa-container');
  const r = await page.evaluate(() => {
    const c = document.querySelector('sherpa-container') as HTMLElement & { selected: boolean };
    let selectDetail: any = null;
    let clickFired = false;
    c.addEventListener('card-select', (e: any) => (selectDetail = e.detail));
    c.addEventListener('card-click', () => (clickFired = true));
    const role = c.getAttribute('role');
    c.click();
    return {
      role,
      ariaChecked: c.getAttribute('aria-checked'),
      selected: c.hasAttribute('data-selected') && c.dataset['selected'] !== 'false',
      selectDetail,
      clickFired,
    };
  });
  expect(r.role).toBe('radio'); // selectable → radio role
  expect(r.selected).toBe(true);
  expect(r.ariaChecked).toBe('true');
  expect(r.selectDetail).toEqual({ selected: true });
  expect(r.clickFired).toBe(true); // selectable is implicitly interactive
});

/* ── sherpa-dialog ─────────────────────────────────────────────── */

test('sherpa-dialog data-open shows the native <dialog>; close fires close', async ({ page }) => {
  await mount(page, `<sherpa-dialog data-label="Confirm"><p>Body</p><button slot="footer">OK</button></sherpa-dialog>`, 'sherpa-dialog');
  const r = await page.evaluate(async () => {
    const d = document.querySelector('sherpa-dialog') as HTMLElement & { show: () => void; hide: () => void; open: boolean };
    const sr = d.shadowRoot!;
    const dialog = sr.querySelector('dialog.dialog') as HTMLDialogElement;
    const title = sr.querySelector('.header-title')!.textContent;
    let openFired = false;
    let closeFired = false;
    d.addEventListener('open', () => (openFired = true));
    d.addEventListener('close', () => (closeFired = true));
    d.setAttribute('data-open', 'true');
    const isOpen = dialog.open;
    // Close via native dialog.close(), which the component listens for
    dialog.close();
    await new Promise((res) => setTimeout(res, 50));
    return { title, isOpen, openFired, closeFired, hostOpen: d.hasAttribute('data-open') };
  });
  expect(r.title).toBe('Confirm');
  expect(r.isOpen).toBe(true);
  expect(r.openFired).toBe(true);
  expect(r.closeFired).toBe(true);
  expect(r.hostOpen).toBe(false); // data-open cleared on native close
});

test('sherpa-dialog data-template=wizard renders back/next wizard controls', async ({ page }) => {
  await mount(page, `<sherpa-dialog data-template="wizard" data-label="Setup" data-pages="3" data-page="0">
      <section data-page="0">Step 1</section>
      <section data-page="1">Step 2</section>
      <section data-page="2">Step 3</section>
    </sherpa-dialog>`, 'sherpa-dialog');
  const r = await page.evaluate(async () => {
    const d = document.querySelector('sherpa-dialog') as HTMLElement;
    await d.rendered;
    const sr = d.shadowRoot!;
    return {
      hasBack: !!sr.querySelector('.wizard-back'),
      hasNext: !!sr.querySelector('.wizard-next'),
      stepIndicator: sr.querySelector('.wizard-step-indicator')!.textContent,
    };
  });
  expect(r.hasBack).toBe(true);
  expect(r.hasNext).toBe(true);
  expect(r.stepIndicator).toBe('Step 1 of 3');
});

/* ── sherpa-tooltip ────────────────────────────────────────────── */

test('sherpa-tooltip singleton shows on hovering a [data-tooltip] target', async ({ page }) => {
  await mount(page, `<button data-tooltip="Help text" id="tt-target">?</button>`);
  // Real hover drives the declarative mouseenter handler (capture phase).
  await page.hover('#tt-target');
  await page.waitForTimeout(150); // showFor() awaits the tooltip's rendered promise
  const r = await page.evaluate(() => {
    const tip = document.querySelector('sherpa-tooltip') as HTMLElement | null;
    return {
      hasTip: !!tip,
      content: tip?.shadowRoot?.querySelector('.tooltip-content')?.textContent,
      visible: tip?.dataset['visible'],
    };
  });
  expect(r.hasTip).toBe(true);
  expect(r.content).toBe('Help text');
  expect(r.visible).toBe('true');
});

/* ── sherpa-panel ──────────────────────────────────────────────── */

test('sherpa-panel data-expanded toggle fires panel-toggle; close button fires panel-close', async ({ page }) => {
  await mount(page, `<sherpa-panel data-heading="Details"><div>content</div></sherpa-panel>`, 'sherpa-panel');
  const r = await page.evaluate(() => {
    const p = document.querySelector('sherpa-panel') as HTMLElement & { toggle: () => void };
    const sr = p.shadowRoot!;
    const heading = sr.querySelector('.header-title')!.textContent;
    const toggleDetails: any[] = [];
    let closeFired = false;
    p.addEventListener('panel-toggle', (e: any) => toggleDetails.push(e.detail));
    p.addEventListener('panel-close', () => (closeFired = true));
    p.setAttribute('data-expanded', ''); // triggers panel-toggle { expanded: true }
    const expandCount = toggleDetails.length;
    const expandDetail = toggleDetails[0];
    const expandedAfter = p.hasAttribute('data-expanded');
    (sr.querySelector('.close-btn') as HTMLElement).click(); // fires panel-close + clears expanded (→ panel-toggle { expanded: false })
    return { heading, expandDetail, expandCount, expandedAfter, closeFired, expandedFinal: p.hasAttribute('data-expanded') };
  });
  expect(r.heading).toBe('Details');
  expect(r.expandDetail).toEqual({ expanded: true });
  expect(r.expandedAfter).toBe(true);
  expect(r.closeFired).toBe(true);
  expect(r.expandedFinal).toBe(false);
});

/* ── sherpa-container-overlay ──────────────────────────────────── */

test('sherpa-container-overlay show(anchor) opens and overlay-select fires on item click', async ({ page }) => {
  await mount(page, `
    <button id="ov-anchor">Open</button>
    <sherpa-container-overlay data-variant="menu">
      <ul>
        <li><sherpa-overlay-item value="a" data-action="alpha">Alpha</sherpa-overlay-item></li>
        <li><sherpa-overlay-item value="b" data-action="beta">Beta</sherpa-overlay-item></li>
      </ul>
    </sherpa-container-overlay>`, 'sherpa-container-overlay');
  const r = await page.evaluate(async () => {
    const anchor = document.getElementById('ov-anchor')!;
    const overlay = document.querySelector('sherpa-container-overlay') as HTMLElement & { show: (a: Element) => void; open: boolean };
    await (overlay as any).rendered;
    let openFired = false;
    let selectDetail: any = null;
    overlay.addEventListener('overlay-open', () => (openFired = true));
    overlay.addEventListener('overlay-select', (e: any) => (selectDetail = e.detail));
    overlay.show(anchor);
    const openState = overlay.open;
    // Ensure the overlay items have rendered before clicking.
    const item = overlay.querySelector('sherpa-overlay-item[value="b"]') as HTMLElement & { rendered?: Promise<void> };
    if (item.rendered) await item.rendered;
    item.click();
    return {
      openFired,
      openState,
      value: selectDetail?.value,
      action: selectDetail?.action,
      label: selectDetail?.label,
    };
  });
  expect(r.openFired).toBe(true);
  expect(r.openState).toBe(true);
  expect(r.value).toBe('b');
  expect(r.action).toBe('beta');
  expect(r.label).toBe('Beta');
});
