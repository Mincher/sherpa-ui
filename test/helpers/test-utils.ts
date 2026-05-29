// @ts-nocheck
/**
 * Test utilities for Sherpa UI components
 *
 * Helpers for testing web components with Shadow DOM, attributes, events, and slots.
 */

import { fixture, html } from '@open-wc/testing-helpers';

/**
 * Create a component fixture in the test document.
 * @param {string} htmlString - HTML string to render
 * @returns {Promise<HTMLElement>} The rendered element
 */
export async function createFixture(htmlString) {
  return fixture(html([htmlString]));
}

/**
 * Query inside Shadow DOM.
 * @param {HTMLElement} element - Element with shadowRoot
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
export function shadowQuery(element, selector) {
  return element.shadowRoot?.querySelector(selector) || null;
}

/**
 * Query all inside Shadow DOM.
 * @param {HTMLElement} element - Element with shadowRoot
 * @param {string} selector - CSS selector
 * @returns {NodeListOf<Element>}
 */
export function shadowQueryAll(element, selector) {
  return element.shadowRoot?.querySelectorAll(selector) || [];
}

/**
 * Wait for a condition to be true.
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Max wait time in ms
 * @param {number} interval - Check interval in ms
 * @returns {Promise<void>}
 */
export async function waitFor(condition, timeout = 3000, interval = 50) {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('waitFor timeout exceeded');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Wait for an element to be rendered in Shadow DOM.
 * @param {HTMLElement} element - Parent element
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<Element>}
 */
export async function waitForElement(element, selector, timeout = 3000) {
  let found = null;
  await waitFor(() => {
    found = shadowQuery(element, selector);
    return !!found;
  }, timeout);
  return found;
}

/**
 * Wait for next animation frame.
 * @returns {Promise<void>}
 */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Wait for component to finish rendering (multiple frames).
 * @param {number} frames - Number of frames to wait
 * @returns {Promise<void>}
 */
export async function waitForRender(frames = 2) {
  for (let i = 0; i < frames; i++) {
    await nextFrame();
  }
}

/**
 * Dispatch a custom event on an element.
 * @param {HTMLElement} element - Target element
 * @param {string} eventName - Event name
 * @param {any} detail - Event detail
 * @returns {boolean} True if not cancelled
 */
export function dispatchEvent(element, eventName, detail = null) {
  const event = new CustomEvent(eventName, {
    bubbles: true,
    composed: true,
    detail,
  });
  return element.dispatchEvent(event);
}

/**
 * Listen for a single event and return a promise.
 * @param {HTMLElement} element - Element to listen on
 * @param {string} eventName - Event name
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<CustomEvent>}
 */
export function oneEvent(element, eventName, timeout = 3000) {
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
 * Get computed style of an element (including Shadow DOM).
 * @param {HTMLElement} element - Target element
 * @returns {CSSStyleDeclaration}
 */
export function getComputedStyle(element) {
  return window.getComputedStyle(element);
}

/**
 * Set multiple attributes on an element.
 * @param {HTMLElement} element - Target element
 * @param {Object} attrs - Key-value pairs of attributes
 */
export function setAttributes(element, attrs) {
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      element.removeAttribute(key);
    } else {
      element.setAttribute(key, String(value));
    }
  });
}

/**
 * Get slotted elements for a named slot.
 * @param {HTMLElement} element - Element with shadow root
 * @param {string} slotName - Slot name (empty string for default slot)
 * @returns {Element[]}
 */
export function getSlottedElements(element, slotName = '') {
  const slot = slotName
    ? shadowQuery(element, `slot[name="${slotName}"]`)
    : shadowQuery(element, 'slot:not([name])');

  return slot ? slot.assignedElements() : [];
}

/**
 * Simulate user input on an input element.
 * @param {HTMLInputElement} input - Input element
 * @param {string} value - Value to set
 * @param {boolean} triggerEvents - Whether to trigger input/change events
 */
export async function typeInto(input, value, triggerEvents = true) {
  input.value = value;

  if (triggerEvents) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  await nextFrame();
}

/**
 * Simulate a click on an element.
 * @param {HTMLElement} element - Element to click
 */
export async function click(element) {
  element.click();
  await nextFrame();
}

/**
 * Simulate focus on an element.
 * @param {HTMLElement} element - Element to focus
 */
export async function focus(element) {
  element.focus();
  await nextFrame();
}

/**
 * Simulate blur on an element.
 * @param {HTMLElement} element - Element to blur
 */
export async function blur(element) {
  element.blur();
  await nextFrame();
}

/**
 * Get all CSS custom properties from an element.
 * @param {HTMLElement} element - Target element
 * @returns {Object} Map of custom property names to values
 */
export function getCustomProperties(element) {
  const styles = getComputedStyle(element);
  const props = {};

  for (let i = 0; i < styles.length; i++) {
    const name = styles[i];
    if (name.startsWith('--')) {
      props[name] = styles.getPropertyValue(name).trim();
    }
  }

  return props;
}

/**
 * Assert that an element is visible (not display:none or visibility:hidden).
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isVisible(element) {
  const styles = getComputedStyle(element);
  return styles.display !== 'none' && styles.visibility !== 'hidden';
}

/**
 * Assert that an element has aria-hidden="true".
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isAriaHidden(element) {
  return element.getAttribute('aria-hidden') === 'true';
}
