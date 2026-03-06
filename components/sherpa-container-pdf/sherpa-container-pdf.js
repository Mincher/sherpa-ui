/**
 * SherpaContainerPdf - PDF export container component.
 *
 * Renders container data in a print-optimized layout:
 * - Title and description
 * - Metrics in a row
 * - Each section with BOTH chart and table presentations stacked
 *
 * Cloning prototypes (shadow DOM):
 *   .section-tpl — div.pdf-section > h3.pdf-section-title + div.pdf-chart-wrapper + div.pdf-table-wrapper
 *
 * Usage:
 *   const pdfContainer = document.createElement('sherpa-container-pdf');
 *   pdfContainer.setData(sourceContainer);
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaContainerPdf extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-container-pdf.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-container-pdf.html", import.meta.url).href;
  }

  #data = null;

  /**
   * Set data from a source sherpa-container element
   * @param {HTMLElement} sourceContainer - The sherpa-container to extract data from
   */
  async setData(sourceContainer) {
    await this.rendered;

    // Light mode is forced via color-scheme: light in the component CSS —
    // no runtime attribute needed.

    // Extract container info
    const title =
      sourceContainer.querySelector(".container-title, #container-title")
        ?.textContent || "";
    const description =
      sourceContainer.querySelector(".container-desc, #container-desc")
        ?.textContent || "";

    // Set header
    const titleEl = this.$(".pdf-title");
    const descEl = this.$(".pdf-description");
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;

    // Clone metrics
    const metricsContainer = this.$(".pdf-metrics");
    if (metricsContainer) {
      metricsContainer.replaceChildren();
      const sourceMetrics = sourceContainer.querySelectorAll(
        ".content > sherpa-metric",
      );
      sourceMetrics.forEach((metric) => {
        const clone = metric.cloneNode(true);
        clone.setAttribute("data-pdf-mode", "");
        metricsContainer.appendChild(clone);
      });
    }

    // Process sections — clone section-tpl prototype for each
    const sectionsContainer = this.$(".pdf-sections");
    const sectionTpl = this.$("template.section-tpl");
    if (sectionsContainer && sectionTpl) {
      sectionsContainer.replaceChildren();

      const sourceSections = sourceContainer.querySelectorAll(
        ".content > .sections > .section",
      );
      for (const section of sourceSections) {
        // Skip hidden sections (check both property and attribute)
        if (section.hidden || section.hasAttribute("hidden")) continue;

        const sectionContent = section.querySelector(".section-content");
        if (!sectionContent) continue;

        const barchart = sectionContent.querySelector("sherpa-barchart");
        const table = sectionContent.querySelector("sherpa-data-grid");
        const sparkline = sectionContent.querySelector("sherpa-sparkline");
        const component = barchart || table || sparkline;

        if (!component?.getData) continue;

        const data = component.getData();
        if (!data) continue;

        // Clone the section prototype
        const frag = sectionTpl.content.cloneNode(true);

        // Section title (CSS hides via :empty if blank)
        const sectionTitle =
          data.title ||
          section.querySelector(".content-title")?.textContent ||
          "";
        frag.querySelector(".pdf-section-title").textContent = sectionTitle;

        // Create chart presentation (data-driven element creation)
        const chartWrapper = frag.querySelector(".pdf-chart-wrapper");
        const chartEl = document.createElement("sherpa-barchart");
        chartEl.setAttribute("data-pdf-mode", "");
        chartEl.setData({ ...data, presentationType: "barchart" });
        chartWrapper.appendChild(chartEl);

        // Create table presentation (data-driven element creation)
        const tableWrapper = frag.querySelector(".pdf-table-wrapper");
        const tableEl = document.createElement("sherpa-data-grid");
        tableEl.setAttribute("data-pdf-mode", "");
        tableEl.setAttribute("data-selectable", "false");
        tableEl.setAttribute("data-show-pagination", "false");
        tableEl.setAttribute("data-show-secondary-headers", "false");
        tableEl.setAttribute("data-show-actions", "false");
        tableEl.setData({ ...data, presentationType: "table" });
        tableWrapper.appendChild(tableEl);

        sectionsContainer.appendChild(frag);
      }
    }
  }
}

customElements.define("sherpa-container-pdf", SherpaContainerPdf);
