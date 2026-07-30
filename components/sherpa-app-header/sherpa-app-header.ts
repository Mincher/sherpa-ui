/**
 * sherpa-app-header.ts — App Shell v2 header.
 *
 * The new baseline application header, merging the old product-bar's app-level
 * actions with the view-header's title / breadcrumbs / favourite. Sits at the
 * top of sherpa-app-shell's content area, above the main view. Hosts the Quick
 * Filter Toolbar (Phase 4) in its `filters` slot.
 *
 * Structure follows the Figma "App Header": a top row (breadcrumbs + back +
 * app-actions), a view row (title + quick filters + view-actions), and a 2px
 * loading strip. All node structure is template-driven; breadcrumbs clone a
 * `<template class="crumb-tpl">` prototype (no createElement/innerHTML).
 *
 * `sherpa-view-header` is retained for legacy UI recreation; this is the new
 * baseline for all new app shells.
 *
 * @element sherpa-app-header
 * @category shell
 * @description The App Shell v2 header. Set the view title with data-label; feed breadcrumbs
 *   as a JSON array via data-breadcrumbs. Slot app-level actions (AI, notifications, help) into
 *   `app-actions`, the Quick Filter Toolbar into `filters`, and view-level actions (save, refresh)
 *   into `view-actions`. Enables a back button (data-back-button) and a favourite toggle
 *   (data-show-favorite / data-favorite). Merges the old product-bar + view-header.
 *
 * @attr {string}  data-label          — View title text
 * @attr {json}    data-breadcrumbs    — Breadcrumb trail: [{ label, href? }]
 * @attr {boolean} data-back-button    — Show the back button
 * @attr {boolean} data-show-favorite  — Show the favourite toggle
 * @attr {boolean} data-favorite       — Favourite is active (filled star)
 * @attr {boolean} data-loading        — Show the 2px loading strip
 * @attr {boolean} data-info           — Show the title info/help affordance
 * @attr {string}  data-export-title   — Title used when an export action fires
 *
 * @fires view-header-back    — Back button clicked  · bubbles, composed · detail: {}
 * @fires favorite-toggle     — Favourite toggled     · bubbles, composed · detail: { favorite: boolean }
 * @fires breadcrumb-click    — A breadcrumb clicked  · bubbles, composed · detail: { index, label, href? }
 * @fires view-export         — Export requested      · bubbles, composed · detail: { title }
 *
 * @slot app-actions   — Right-side app-level actions (AI trigger, notifications, help, user)
 * @slot filters       — The Quick Filter Toolbar (Phase 4)
 * @slot view-actions  — Right-side view-level actions (save, refresh, settings)
 * @slot title-icon    — Custom icon before the view title
 *
 * @method setHeading(text)      — Set the view title
 * @method getHeading()          — Get the view title
 * @method setBreadcrumbs(items) — Set the breadcrumb trail
 * @method setFavorite(on)       — Set favourite state
 * @method isFavorite()          — Read favourite state
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";

/** A breadcrumb entry. */
export interface Breadcrumb {
  label: string;
  href?: string;
}

export class SherpaAppHeader extends SherpaElement {
  static override get cssUrl(): string { return new URL("./sherpa-app-header.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-app-header.html", import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-breadcrumbs",
      "data-favorite",
    ];
  }

  public els = this.cacheElements({
    title: { selector: ".view-title", type: HTMLElement },
    crumbs: { selector: ".breadcrumbs", type: HTMLElement },
    back: { selector: ".back-button", type: HTMLButtonElement },
    favorite: { selector: ".favorite-button", type: HTMLButtonElement },
  });

  #bound = false;

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  override onRender(): void {
    if (!this.#bound) {
      this.els.back?.addEventListener("click", this.#onBack);
      this.els.favorite?.addEventListener("click", this.#onFavorite);
      this.els.crumbs?.addEventListener("click", this.#onCrumbClick);
      this.#bound = true;
    }
    this.#syncHeading();
    this.#syncBreadcrumbs();
  }

  override onAttributeChanged(name: string): void {
    if (name === "data-label") this.#syncHeading();
    else if (name === "data-breadcrumbs") this.#syncBreadcrumbs();
    else if (name === "data-favorite") this.#syncFavorite();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get heading(): string { return this.dataset["label"] || ""; }
  set heading(v: string) { if (v) this.dataset["label"] = v; else delete this.dataset["label"]; }

  public setHeading(text: string): void { this.heading = text; }
  public getHeading(): string { return this.heading; }

  public setBreadcrumbs(items: Breadcrumb[]): void {
    this.dataset["breadcrumbs"] = JSON.stringify(items ?? []);
  }

  public isFavorite(): boolean { return this.hasAttribute("data-favorite"); }
  public setFavorite(on: boolean): void { this.toggleAttribute("data-favorite", !!on); }

  /* ── Sync ──────────────────────────────────────────────────────── */

  #syncHeading(): void {
    if (this.els.title) this.els.title.textContent = this.heading;
  }

  #syncFavorite(): void {
    const on = this.isFavorite();
    this.els.favorite?.setAttribute("aria-pressed", String(on));
    const icon = this.els.favorite?.querySelector("i");
    if (icon) icon.className = on ? "fa-solid fa-star" : "fa-regular fa-star";
  }

  /** Rebuild the breadcrumb trail from data-breadcrumbs using cloning prototypes. */
  #syncBreadcrumbs(): void {
    const trail = this.els.crumbs;
    const crumbTpl = this.$<HTMLTemplateElement>("template.crumb-tpl");
    const sepTpl = this.$<HTMLTemplateElement>("template.crumb-sep-tpl");
    if (!trail || !crumbTpl || !sepTpl) return;

    let items: Breadcrumb[] = [];
    const raw = this.dataset["breadcrumbs"];
    if (raw) { try { items = JSON.parse(raw); } catch { items = []; } }

    trail.replaceChildren();
    this.toggleAttribute("data-has-breadcrumbs", items.length > 0);

    items.forEach((item, i) => {
      if (i > 0) {
        const sep = sepTpl.content.cloneNode(true) as DocumentFragment;
        trail.appendChild(sep);
      }
      const frag = crumbTpl.content.cloneNode(true) as DocumentFragment;
      const a = frag.querySelector<HTMLAnchorElement>(".crumb");
      if (!a) return;
      a.textContent = item.label;
      a.dataset["index"] = String(i);
      const isLast = i === items.length - 1;
      if (item.href && !isLast) a.href = item.href;
      if (isLast) a.setAttribute("aria-current", "page");
      trail.appendChild(frag);
    });
  }

  /* ── Interaction ───────────────────────────────────────────────── */

  #onBack: EventHandler<MouseEvent> = () => { this.emit("view-header-back", {}); };

  #onFavorite: EventHandler<MouseEvent> = () => {
    const next = !this.isFavorite();
    this.setFavorite(next);
    this.emit("favorite-toggle", { favorite: next });
  };

  #onCrumbClick: EventHandler<MouseEvent> = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(".crumb");
    if (!a || a.getAttribute("aria-current") === "page") return;
    const index = Number(a.dataset["index"] ?? "-1");
    const raw = this.dataset["breadcrumbs"];
    let item: Breadcrumb | undefined;
    if (raw) { try { item = JSON.parse(raw)[index]; } catch { /* ignore */ } }
    // Let real hrefs navigate; only intercept when there's no href.
    if (!item?.href) e.preventDefault();
    this.emit("breadcrumb-click", { index, label: item?.label, href: item?.href });
  };
}

customElements.define("sherpa-app-header", SherpaAppHeader);
