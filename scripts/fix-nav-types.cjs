#!/usr/bin/env node
/**
 * Adds explicit types to sherpa-nav.ts.
 * NavSelection, PromoConfig, NavItemData interfaces already exist.
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../components/sherpa-nav/sherpa-nav.ts');
let src = fs.readFileSync(file, 'utf8');

// ---------- onAttributeChanged override ----------
src = src.replace(
  /override onAttributeChanged\(name: string, _oldValue, newValue: string \| null\)/,
  'override onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void'
);

// ---------- function params ----------
const paramFixes = [
  [/setActiveLink\(target\)\s*\{/, 'setActiveLink(target: string): void {'],
  [/#applyActiveLink\(target\)\s*\{/, '#applyActiveLink(target: string): void {'],
  [/setActiveItem\(itemId, sectionId = null\)\s*\{/, 'setActiveItem(itemId: string, sectionId: string | null = null): void {'],
  [/#applyActiveItem\(itemId, sectionId = null\)\s*\{/, '#applyActiveItem(itemId: string, sectionId: string | null = null): void {'],
  [/isFavorite\(itemId\)\s*\{/, 'isFavorite(itemId: string): boolean {'],
  [/setFavorite\(itemId, label, route, on\)\s*\{/, 'setFavorite(itemId: string, label: string, route: string, on: boolean): void {'],
  [/async addToRecent\(itemId, label, route\)\s*\{/, 'async addToRecent(itemId: string, label: string, route: string): Promise<void> {'],
  [/setPromoConfig\(config\)\s*\{/, 'setPromoConfig(config: PromoConfig | null): void {'],
  [/#readStored\(key\)\s*\{/, '#readStored(key: string): unknown[] {'],
  [/#writeStored\(key, items\)\s*\{/, '#writeStored(key: string, items: unknown[]): void {'],
  [/#emit\(name, detail = \{\}\)\s*\{/, '#emit(name: string, detail: Record<string, unknown> = {}): void {'],
  [/#applyOrderToContainer\(container, order\)\s*\{/, '#applyOrderToContainer(container: HTMLElement, order: string[]): void {'],
  [/#persistGroupOrder\(groupIndex, order\)\s*\{/, '#persistGroupOrder(groupIndex: number, order: (string | undefined)[]): void {'],
  [/#getItemLabel\(item\)\s*\{/, '#getItemLabel(item: HTMLElement): string {'],
  [/#createMatchRange\(item, filterLower\)\s*\{/, '#createMatchRange(item: HTMLElement, filterLower: string): Range | null {'],
  [/#revealAncestors\(node\)\s*\{/, '#revealAncestors(node: HTMLElement): void {'],
  [/#applySearchFilter\(value\)\s*\{/, '#applySearchFilter(value: string): void {'],
  [/#onPinnedChange\(pinned\)\s*\{/, '#onPinnedChange(pinned: string | null): void {'],
  [/#onModeChange\(newMode, oldMode\)\s*\{/, '#onModeChange(newMode: string | null, oldMode: string | null): void {'],
  [/#snapshotSection\(sec\)\s*\{/, '#snapshotSection(sec: HTMLElement): NavItemData[] {'],
  [/#persistQuickAccess\(which\)\s*\{/, '#persistQuickAccess(which: "recent" | "favorites"): void {'],
];

for (const [pattern, replacement] of paramFixes) {
  src = src.replace(pattern, replacement);
}

// ---------- dataset accesses on typed elements ----------
// `item.dataset["state"] = "selected"` — item is from querySelectorAll → HTMLElement
src = src.replace(/\bel\.dataset\["state"\] = "selected"/g, '(el as HTMLElement).dataset["state"] = "selected"');
src = src.replace(/\bprimary\b && primary\.dataset\["state"\]/g, 'primary && (primary as HTMLElement).dataset["state"]');
src = src.replace(/\bif \(primary\) primary\.dataset\["state"\]/g, 'if (primary) (primary as HTMLElement).dataset["state"]');
src = src.replace(/\bitem\.dataset\["state"\] = "selected"/g, '(item as HTMLElement).dataset["state"] = "selected"');
src = src.replace(/\bsec\.dataset\["editable"\]/g, '(sec as HTMLElement).dataset["editable"]');
src = src.replace(/\bsec\.dataset\["maxItems"\]/g, '(sec as HTMLElement).dataset["maxItems"]');
src = src.replace(/\bexisting\.dataset\["route"\]/g, '(existing as HTMLElement).dataset["route"]');
src = src.replace(/\bexisting\.dataset\["state"\]/g, '(existing as HTMLElement).dataset["state"]');
src = src.replace(/\bclose\.dataset\["wired"\]/g, '(close as HTMLElement).dataset["wired"]');
src = src.replace(/\bpromo\.dataset\["dismissed"\]/g, '(promo as HTMLElement).dataset["dismissed"]');
src = src.replace(/\blinkEl\.dataset\["url"\]/g, '(linkEl as HTMLElement).dataset["url"]');
src = src.replace(/\bdelete linkEl\.dataset\["url"\]/g, 'delete (linkEl as HTMLElement).dataset["url"]');

// ---------- parseInt without fallback ----------
src = src.replace(
  /parseInt\(sec\.dataset\["maxItems"\], 10\)/g,
  'parseInt((sec as HTMLElement).dataset["maxItems"] || "", 10)'
);

// ---------- #searchField custom method ----------
src = src.replace(
  /this\.#searchField\.clear\(\)/g,
  '(this.#searchField as unknown as { clear?(): void })?.clear?.()'
);

// ---------- applyActiveLink / applyActiveItem internal sel accesses ----------
// sel.itemId, sel.sectionId — NavSelection already has these
src = src.replace(/this\.#applyActiveItem\(sel\.itemId, sel\.sectionId\)/g,
  'this.#applyActiveItem((this.#lastSelection as { itemId: string; sectionId: string | null }).itemId, (this.#lastSelection as { itemId: string; sectionId: string | null }).sectionId)');

// ---------- items[i].remove() in addToRecent ----------
src = src.replace(/for \(let i = max; i < items\.length; i\+\+\) items\[i\]\.remove\(\);/g,
  'for (let i = max; i < items.length; i++) (items[i] as HTMLElement).remove();');

// ---------- hydrate nested function param types ----------
// `hydrate(secId, key, max)` — inside #hydrateQuickAccess
src = src.replace(
  /const hydrate = \(secId, key, max\) =>/g,
  'const hydrate = (secId: string, key: string, max: number) =>'
);

// ---------- rank function inside #syncSectionBadges ----------
src = src.replace(
  /const rank = \(s\) =>/g,
  'const rank = (s: HTMLElement): number =>'
);

// ---------- NavItemData destructuring in snapshotSection ----------
// Already handled by param type fix

// ---------- promoConfig property accesses ----------
// cfg?.link?.url — PromoConfig already typed
src = src.replace(/\bcfg\?\.link\?\.url\b/g, '(cfg as PromoConfig)?.link?.url');

fs.writeFileSync(file, src);
console.log('nav types applied');
