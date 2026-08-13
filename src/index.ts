/**
 * index.ts — the reforged Sherpa entry point.
 *
 * Import this once to register components and establish the shared shadow-root
 * styles. The design-token layer (light DOM) is loaded separately via a
 * `<link>`/`@import` of tokens.css, or programmatically with `installTokens()`.
 */
import { SherpaElement } from './core/sherpa-element.js';

/** The base reset each shadow root adopts. Tokens inherit from the light DOM. */
SherpaElement.sharedStyles = [new URL('./core/sherpa-base.css', import.meta.url)];

/**
 * Inject the light-DOM token layer (primitives → aliases → themes) into the
 * document head, once. Apps that already `<link>` tokens.css can skip this.
 */
let tokensInstalled = false;
export function installTokens(): void {
  if (tokensInstalled || typeof document === 'undefined') return;
  tokensInstalled = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./styles/tokens/tokens.css', import.meta.url).href;
  document.head.appendChild(link);
}

export { SherpaElement } from './core/sherpa-element.js';
export { SherpaButton } from './components/sherpa-button/sherpa-button.js';
export { SherpaTag } from './components/sherpa-tag/sherpa-tag.js';
export { SherpaContainer } from './components/sherpa-container/sherpa-container.js';
export { SherpaInputText } from './components/sherpa-input-text/sherpa-input-text.js';
