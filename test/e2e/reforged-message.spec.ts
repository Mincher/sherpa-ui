import { test, expect } from '@playwright/test';

/**
 * sherpa-message on the reforged base — the inline status strip. Proves the
 * status-hue selection (data-status drives the icon colour + soft surface tint),
 * the label-sync + slotted-body override, the default aria role, and the dismiss
 * button emitting message-dismiss + removing the element.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('data-label writes the message text', async ({ page }) => {
  const text = await page.evaluate(async () => {
    const el = document.createElement('sherpa-message') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'Saved successfully.');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector('.label')!.textContent;
  });
  expect(text).toBe('Saved successfully.');
});

test('data-status drives the icon colour from the status tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const iconColor = async (status?: string) => {
      const el = document.createElement('sherpa-message') as HTMLElement & {
        rendered?: Promise<void>;
      };
      el.setAttribute('data-label', 'x');
      if (status) el.setAttribute('data-status', status);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.icon')!).backgroundColor;
    };
    return {
      info: await iconColor('info'),
      success: await iconColor('success'),
      warning: await iconColor('warning'),
      critical: await iconColor('critical'),
    };
  });
  expect(r.info).toBe('rgb(7, 82, 111)'); // badge = status-info-color-5 #07526F
  expect(r.success).toBe('rgb(5, 129, 66)'); // status-success-color-4 #058142
  expect(r.warning).toBe('rgb(167, 114, 6)'); // status-warning-color-7 #A77206
  expect(r.critical).toBe('rgb(191, 44, 9)'); // status-critical-color-5 #BF2C09
  expect(r.info).not.toBe(r.critical);
});

test('status changes the soft surface tint', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bg = async (status: string) => {
      const el = document.createElement('sherpa-message') as HTMLElement & {
        rendered?: Promise<void>;
      };
      el.setAttribute('data-label', 'x');
      el.setAttribute('data-status', status);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el).backgroundColor;
    };
    return { info: await bg('info'), critical: await bg('critical') };
  });
  // A tinted (non-transparent) surface that differs by status.
  expect(r.info).not.toBe('rgba(0, 0, 0, 0)');
  expect(r.info).not.toBe(r.critical);
});

test('default (no data-status) still resolves an info icon colour', async ({ page }) => {
  const color = await page.evaluate(async () => {
    const el = document.createElement('sherpa-message') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.icon')!).backgroundColor;
  });
  expect(color).toBe('rgb(7, 82, 111)'); // default badge = info #07526F
});

test('a slotted body replaces the data-label text node', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-message') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'ignored');
    el.textContent = 'Slotted message body';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasContent: el.hasAttribute('data-has-content'),
      labelDisplay: getComputedStyle(el.shadowRoot!.querySelector('.label')!).display,
    };
  });
  expect(r.hasContent).toBe(true);
  expect(r.labelDisplay).toBe('none');
});

test('sets a default aria role of status', async ({ page }) => {
  const role = await page.evaluate(async () => {
    const el = document.createElement('sherpa-message') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.getAttribute('role');
  });
  expect(role).toBe('status');
});

test('close button hidden unless data-dismissible', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const plain = document.createElement('sherpa-message') as HTMLElement & {
      rendered?: Promise<void>;
    };
    plain.setAttribute('data-label', 'x');
    document.getElementById('root')!.appendChild(plain);
    await plain.rendered;

    const dismissible = document.createElement('sherpa-message') as HTMLElement & {
      rendered?: Promise<void>;
    };
    dismissible.setAttribute('data-label', 'x');
    dismissible.setAttribute('data-dismissible', '');
    document.getElementById('root')!.appendChild(dismissible);
    await dismissible.rendered;

    return {
      plain: getComputedStyle(plain.shadowRoot!.querySelector('.close')!).display,
      dismissible: getComputedStyle(dismissible.shadowRoot!.querySelector('.close')!).display,
    };
  });
  expect(r.plain).toBe('none');
  expect(r.dismissible).not.toBe('none'); // visible (flex)
});

test('dismiss button fires message-dismiss and removes the element', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-message') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'x');
    el.setAttribute('data-dismissible', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = 0;
    // event is composed — listen on the document so it survives element removal
    document.addEventListener('message-dismiss', () => fired++);
    el.shadowRoot!.querySelector<HTMLElement>('.close')!.click();

    return { fired, connected: el.isConnected };
  });
  expect(r.fired).toBe(1);
  expect(r.connected).toBe(false);
});
