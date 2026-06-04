/**
 * Test utilities for Sherpa UI components
 *
 * Helpers for testing web components with Shadow DOM, attributes, events, and slots.
 */

import { fixture, html } from '@open-wc/testing-helpers';

/**
 * Create a component fixture in the test document.
 */
export async function createFixture(htmlString: string): Promise<HTMLElement> {
  return fixture(html([htmlString] as unknown as TemplateStringsArray));
}

/**
 * Query inside Shadow DOM.
 */
export function shadowQuery(element: Element, selector: string): Element | null {
  return element.shadowRoot?.querySelector(selector) ?? null;
}

/**
 * Query all inside Shadow DOM.
 */
export function shadowQueryAll(element: Element, selector: string): NodeListOf<Element> | Element[] {
  return element.shadowRoot?.querySelectorAll(selector) ?? [];
}

/**
 * Wait for a condition to be true.
 */
async function waitFor(condition: () => boolean, timeout = 3000, interval = 50): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('waitFor timeout exceeded');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Wait for an element to be rendered in Shadow DOM.
 */
async function waitForElement(element: Element, selector: string, timeout = 3000): Promise<Element> {
  let found: Element | null = null;
  await waitFor(() => {
    found = shadowQuery(element, selector);
    return !!found;
  }, timeout);
  return found!;
}

/**
 * Wait for next animation frame.
 */
function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Wait for component to finish rendering (multiple frames).
 */
export async function waitForRender(frames = 2): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await nextFrame();
  }
}

/**
 * Dispatch a custom event on an element.
 */
function dispatchCustomEvent(element: Element, eventName: string, detail: unknown = null): boolean {
  const event = new CustomEvent(eventName, {
    bubbles: true,
    composed: true,
    detail,
  });
  return element.dispatchEvent(event);
}

/**
 * Listen for a single event and return a promise.
 */
export function oneEvent(element: Element, eventName: string, timeout = 3000): Promise<Event> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Event "${eventName}" not fired within ${timeout}ms`));
    }, timeout);

    element.addEventListener(
      eventName,
      (event) => {
        clearTimeout(timer);
        resolve(event);
      },
      { once: true }
    );
  });
}

/**
 * Set multiple attributes on an element.
 */
function setAttributes(element: Element, attrs: Record<string, string | null | undefined>): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) {
      element.removeAttribute(key);
    } else {
      element.setAttribute(key, String(value));
    }
  }
}

/**
 * Get slotted elements for a named slot.
 */
export function getSlottedElements(element: Element, slotName = ''): Element[] {
  const slot = slotName
    ? (shadowQuery(element, `slot[name="${slotName}"]`) as HTMLSlotElement | null)
    : (shadowQuery(element, 'slot:not([name])') as HTMLSlotElement | null);

  return slot ? slot.assignedElements() : [];
}

/**
 * Simulate user input on an input element.
 */
export async function typeInto(input: HTMLInputElement, value: string, triggerEvents = true): Promise<void> {
  input.value = value;

  if (triggerEvents) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  await nextFrame();
}

/**
 * Simulate a click on an element.
 */
export async function click(element: HTMLElement): Promise<void> {
  element.click();
  await nextFrame();
}

/**
 * Simulate focus on an element.
 */
async function focus(element: HTMLElement): Promise<void> {
  element.focus();
  await nextFrame();
}

/**
 * Simulate blur on an element.
 */
async function blur(element: HTMLElement): Promise<void> {
  element.blur();
  await nextFrame();
}

/**
 * Get all CSS custom properties from an element.
 */
function getCustomProperties(element: Element): Record<string, string> {
  const styles = window.getComputedStyle(element);
  const props: Record<string, string> = {};

  for (let i = 0; i < styles.length; i++) {
    const name = styles[i]!;
    if (name.startsWith('--')) {
      props[name] = styles.getPropertyValue(name).trim();
    }
  }

  return props;
}

/**
 * Assert that an element is visible (not display:none or visibility:hidden).
 */
function isVisible(element: Element): boolean {
  const styles = window.getComputedStyle(element);
  return styles.display !== 'none' && styles.visibility !== 'hidden';
}

/**
 * Assert that an element has aria-hidden="true".
 */
function isAriaHidden(element: Element): boolean {
  return element.getAttribute('aria-hidden') === 'true';
}
