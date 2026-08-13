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
export { renderElement, type ElementNode } from './core/render-element.js';
export {
  renderView,
  StateStore,
  type ViewDefinition,
  type ViewElement,
  type RenderedView,
} from './core/render-view.js';
export { SherpaButton } from './components/sherpa-button/sherpa-button.js';
export { SherpaTag } from './components/sherpa-tag/sherpa-tag.js';
export { SherpaContainer } from './components/sherpa-container/sherpa-container.js';
export { SherpaInputText } from './components/sherpa-input-text/sherpa-input-text.js';
export { SherpaAppShell } from './components/sherpa-app-shell/sherpa-app-shell.js';
export { SherpaNav, type NavItem } from './components/sherpa-nav/sherpa-nav.js';
export { SherpaLoader } from './components/sherpa-loader/sherpa-loader.js';
export { SherpaSwitch } from './components/sherpa-switch/sherpa-switch.js';
export { SherpaSelectCheckbox } from './components/sherpa-select-checkbox/sherpa-select-checkbox.js';
export { SherpaSelectRadio } from './components/sherpa-select-radio/sherpa-select-radio.js';
export { SherpaCallout } from './components/sherpa-callout/sherpa-callout.js';
export { SherpaBreadcrumbs, type Crumb } from './components/sherpa-breadcrumbs/sherpa-breadcrumbs.js';
export { SherpaSectionHeader } from './components/sherpa-section-header/sherpa-section-header.js';
export { SherpaEmptyState } from './components/sherpa-empty-state/sherpa-empty-state.js';
export { SherpaMessage } from './components/sherpa-message/sherpa-message.js';
export { SherpaProgressBar } from './components/sherpa-progress-bar/sherpa-progress-bar.js';
export { SherpaAccordion } from './components/sherpa-accordion/sherpa-accordion.js';
export { SherpaTooltip } from './components/sherpa-tooltip/sherpa-tooltip.js';
export { SherpaKeyValueList, type KeyValuePair } from './components/sherpa-key-value-list/sherpa-key-value-list.js';
export { SherpaList } from './components/sherpa-list/sherpa-list.js';
export { SherpaListItem } from './components/sherpa-list-item/sherpa-list-item.js';
export { SherpaInputNumber } from './components/sherpa-input-number/sherpa-input-number.js';
export { SherpaInputSearch } from './components/sherpa-input-search/sherpa-input-search.js';
export { SherpaInputPassword } from './components/sherpa-input-password/sherpa-input-password.js';
export { SherpaInputSelect, type SelectOption } from './components/sherpa-input-select/sherpa-input-select.js';
export { SherpaInputTag } from './components/sherpa-input-tag/sherpa-input-tag.js';
export { SherpaTabs, type TabDef } from './components/sherpa-tabs/sherpa-tabs.js';
export { SherpaDialog } from './components/sherpa-dialog/sherpa-dialog.js';
export { SherpaPagination } from './components/sherpa-pagination/sherpa-pagination.js';
export { SherpaSparkline } from './components/sherpa-sparkline/sherpa-sparkline.js';
export { SherpaMetric } from './components/sherpa-metric/sherpa-metric.js';
export { SherpaSlider } from './components/sherpa-slider/sherpa-slider.js';
export { SherpaToast, type ToastOptions } from './components/sherpa-toast/sherpa-toast.js';
