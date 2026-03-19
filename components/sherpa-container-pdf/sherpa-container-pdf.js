/**
 * @element sherpa-container-pdf
 * @description ARCHIVED — No-op stub. PDF export functionality is archived
 *   for rework. Registers the custom element so existing imports don't break.
 *
 * @method setData(sourceContainer) — No-op, logs warning
 */

class SherpaContainerPdf extends HTMLElement {
  /** @param {HTMLElement} _sourceContainer */
  async setData(_sourceContainer) {
    console.warn("sherpa-container-pdf is archived — setData() is a no-op.");
  }
}

if (!customElements.get("sherpa-container-pdf")) {
  customElements.define("sherpa-container-pdf", SherpaContainerPdf);
}

export { SherpaContainerPdf };
