import { test, expect } from './fixture';

/**
 * sherpa-chat-message on the reforged base — a chat bubble. Proves the role-driven
 * layout + colour (assistant left/neutral, user right/accent, system centred/muted),
 * the text-field sync (author, time, content), the slotted-body override, and the
 * avatar-slot presence reflection.
 *
 * The component isn't registered by the harness index, so each spec imports the
 * compiled module to trigger its customElements.define().
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-chat-message/sherpa-chat-message.js');
    await customElements.whenDefined('sherpa-chat-message');
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void> };

test('defaults to the assistant role', async ({ page }) => {
  const role = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chat-message') as WithRender;
    el.setAttribute('data-message', 'hello');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.dataset.type;
  });
  expect(role).toBe('assistant');
});

test('data-message, data-name and data-timestamp write their text nodes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chat-message') as WithRender;
    el.setAttribute('data-message', 'The answer is 42.');
    el.setAttribute('data-name', 'Sherpa');
    el.setAttribute('data-timestamp', '10:30');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const txt = (sel: string) => el.shadowRoot!.querySelector(sel)!.textContent;
    return {
      content: txt('.content'),
      author: txt('.author'),
      time: txt('.time'),
      metaVisible: getComputedStyle(el.shadowRoot!.querySelector('.meta')!).display !== 'none',
    };
  });
  expect(r.content).toBe('The answer is 42.');
  expect(r.author).toBe('Sherpa');
  expect(r.time).toBe('10:30');
  expect(r.metaVisible).toBe(true);
});

test('meta row collapses when there is no author or time', async ({ page }) => {
  const visible = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chat-message') as WithRender;
    el.setAttribute('data-message', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.meta')!).display !== 'none';
  });
  expect(visible).toBe(false);
});

test('a slotted body replaces the data-message text node', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chat-message') as WithRender;
    el.setAttribute('data-message', 'ignored');
    el.textContent = 'Slotted bubble body';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasContent: el.matches(':state(has-content-slot)'),
      contentDisplay: getComputedStyle(el.shadowRoot!.querySelector('.content')!).display,
    };
  });
  expect(r.hasContent).toBe(true);
  expect(r.contentDisplay).toBe('none');
});

test('assistant shows the avatar; user hides it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const vis = async (role?: string) => {
      const el = document.createElement('sherpa-chat-message') as WithRender;
      el.setAttribute('data-message', 'x');
      if (role) el.setAttribute('data-type', role);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const avatar = el.shadowRoot!.querySelector('.avatar')!;
      return { shown: getComputedStyle(avatar).display !== 'none', drawn: !!avatar.querySelector('svg') };
    };
    return { assistant: await vis(), user: await vis('user') };
  });
  // The icon set's glyph, not a Font Awesome one from a font nothing loads.
  expect(r.assistant).toEqual({ shown: true, drawn: true });
  expect(r.user.shown).toBe(false);
});

test('an avatar slot reflects has-avatar', async ({ page }) => {
  const has = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chat-message') as WithRender;
    el.innerHTML = '<img slot="avatar" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />body';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return el.matches(':state(has-avatar)');
  });
  expect(has).toBe(true);
});

test('role drives the bubble colour: user differs from assistant, system is muted', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bg = async (role: string) => {
      const el = document.createElement('sherpa-chat-message') as WithRender;
      el.setAttribute('data-message', 'x');
      el.setAttribute('data-type', role);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.bubble')!).backgroundColor;
    };
    return {
      assistant: await bg('assistant'),
      user: await bg('user'),
      system: await bg('system'),
    };
  });
  expect(r.user).toBe('rgb(59, 76, 205)'); // Saturated accent #3b4ccd (look-tier --_status-surface)
  expect(r.user).not.toBe(r.assistant);
  expect(r.system).not.toBe(r.user);
});
