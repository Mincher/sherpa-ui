import { test, expect } from '@playwright/test';

/**
 * sherpa-kanban-card on the reforged base — a draggable board card: a priority
 * tag, title, description, footer meta (comments / attachments), and an assignee
 * slot. Covers the title prop + slot override, priority → tag status colour, the
 * count meta visibility, the card-open activation event, and the disabled state.
 */

const HARNESS = '/test/reforged/harness.html';

type Rendered = HTMLElement & { rendered?: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true
  );
  await page.waitForFunction(() => !!customElements.get('sherpa-kanban-card'));
});

test('data-title renders into the title fallback', async ({ page }) => {
  const title = await page.evaluate(async () => {
    const el = document.createElement('sherpa-kanban-card') as Rendered;
    el.setAttribute('data-title', 'Fix the login redirect');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector('.title-fallback')!.textContent;
  });
  expect(title).toBe('Fix the login redirect');
});

test('slotted title content hides the data-title fallback', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-kanban-card') as Rendered;
    el.setAttribute('data-title', 'prop title');
    el.textContent = 'Slotted title';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const fb = el.shadowRoot!.querySelector('.title-fallback')!;
    return { display: getComputedStyle(fb).display, hasContent: el.hasAttribute('data-has-content') };
  });
  expect(r.hasContent).toBe(true);
  expect(r.display).toBe('none');
});

test('data-priority shows the tag and maps to its status colour', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-kanban-card') as Rendered;
    el.setAttribute('data-priority', 'high');
    el.setAttribute('data-title', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const tag = el.shadowRoot!.querySelector('.priority')!;
    return { display: getComputedStyle(tag).display, status: tag.getAttribute('data-status'), text: tag.textContent };
  });
  expect(r.display).not.toBe('none'); // tag shows
  expect(r.status).toBe('critical'); // high → critical
  expect(r.text).toBe('high');
});

test('no data-priority hides the tag', async ({ page }) => {
  const display = await page.evaluate(async () => {
    const el = document.createElement('sherpa-kanban-card') as Rendered;
    el.setAttribute('data-title', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.priority')!).display;
  });
  expect(display).toBe('none');
});

test('count meta shows only when its data attribute is set', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-kanban-card') as Rendered;
    el.setAttribute('data-title', 'x');
    el.setAttribute('data-comments', '3');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const comments = el.shadowRoot!.querySelector('.meta-comments')!;
    const attachments = el.shadowRoot!.querySelector('.meta-attachments')!;
    return {
      commentsDisplay: getComputedStyle(comments).display,
      commentsText: comments.querySelector('.meta-count')!.textContent,
      attachmentsDisplay: getComputedStyle(attachments).display,
    };
  });
  expect(r.commentsDisplay).not.toBe('none');
  expect(r.commentsText).toBe('3');
  expect(r.attachmentsDisplay).toBe('none'); // not set → hidden
});

test('activating the card fires card-open with the title; click, Enter, Space all work', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-kanban-card') as Rendered;
    el.setAttribute('data-title', 'Open me');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const details: string[] = [];
    el.addEventListener('card-open', (e) => details.push((e as CustomEvent).detail.title));

    const card = el.shadowRoot!.querySelector<HTMLElement>('.card')!;
    card.click();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    return details;
  });
  expect(r).toEqual(['Open me', 'Open me', 'Open me']);
});

test('disabled blocks activation and drops the card from the tab order', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-kanban-card') as Rendered;
    el.setAttribute('data-title', 'x');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = 0;
    el.addEventListener('card-open', () => fired++);
    const card = el.shadowRoot!.querySelector<HTMLElement>('.card')!;
    card.click();
    return { fired, tabindex: card.getAttribute('tabindex') };
  });
  expect(r.fired).toBe(0);
  expect(r.tabindex).toBe('-1');
});
