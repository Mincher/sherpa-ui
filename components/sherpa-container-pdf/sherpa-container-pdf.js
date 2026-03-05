/**
 * SherpaContainerPdf - PDF export container component.
 * 
 * Renders container data in a print-optimized layout:
 * - Title and description
 * - Metrics in a row
 * - Each section with BOTH chart and table presentations stacked
 * 
 * Usage:
 *   const pdfContainer = document.createElement('sherpa-container-pdf');
 *   pdfContainer.setData(sourceContainer);
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaContainerPdf extends SherpaElement {
  static cssUrl = new URL('./sherpa-container-pdf.css', import.meta.url).href;
  static htmlUrl = new URL('./sherpa-container-pdf.html', import.meta.url).href;

  #data = null;

  /**
   * Set data from a source sherpa-container element
   * @param {HTMLElement} sourceContainer - The sherpa-container to extract data from
   */
  async setData(sourceContainer) {
    await this.rendered;

    // Force light theme for PDF export
    this.setAttribute('data-theme', 'light');
    
    // Extract container info
    const title = sourceContainer.querySelector('.container-title, #container-title')?.textContent || '';
    const description = sourceContainer.querySelector('.container-desc, #container-desc')?.textContent || '';
    
    // Set header
    const titleEl = this.$('.pdf-title');
    const descEl = this.$('.pdf-description');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    
    // Clone metrics
    const metricsContainer = this.$('.pdf-metrics');
    if (metricsContainer) {
      metricsContainer.innerHTML = '';
      const sourceMetrics = sourceContainer.querySelectorAll('.metrics > sherpa-metric');
      sourceMetrics.forEach(metric => {
        const clone = metric.cloneNode(true);
        clone.setAttribute('data-pdf-mode', '');
        metricsContainer.appendChild(clone);
      });
    }
    
    // Process sections - create both presentations for each
    const sectionsContainer = this.$('.pdf-sections');
    if (sectionsContainer) {
      sectionsContainer.innerHTML = '';
      
      const sourceSections = sourceContainer.querySelectorAll('.section');
      for (const section of sourceSections) {
        // Skip hidden sections (check both property and attribute)
        if (section.hidden || section.hasAttribute('hidden')) continue;
        
        const sectionEl = document.createElement('div');
        sectionEl.className = 'pdf-section';
        
        // Get data from existing component in section-content
        const sectionContent = section.querySelector('.section-content');
        if (!sectionContent) continue;
        
        const barchart = sectionContent.querySelector('sherpa-barchart');
        const table = sectionContent.querySelector('sherpa-base-table');
        const sparkline = sectionContent.querySelector('sherpa-sparkline');
        const component = barchart || table || sparkline;
        
        if (!component?.getData) continue;
        
        const data = component.getData();
        if (!data) continue;
        
        // Add section title if available
        const sectionTitle = data.title || section.querySelector('.content-title')?.textContent;
        if (sectionTitle) {
          const titleEl = document.createElement('h3');
          titleEl.className = 'pdf-section-title';
          titleEl.textContent = sectionTitle;
          sectionEl.appendChild(titleEl);
        }
        
        // Create chart presentation
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'pdf-presentation';
        const chartEl = document.createElement('sherpa-barchart');
        chartEl.setAttribute('data-pdf-mode', '');
        chartEl.setData({ ...data, presentationType: 'barchart' });
        chartWrapper.appendChild(chartEl);
        sectionEl.appendChild(chartWrapper);
        
        // Create table presentation
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'pdf-presentation';
        const tableEl = document.createElement('sherpa-base-table');
        tableEl.setAttribute('data-pdf-mode', '');
        tableEl.setData({ ...data, presentationType: 'table' });
        tableWrapper.appendChild(tableEl);
        sectionEl.appendChild(tableWrapper);
        
        sectionsContainer.appendChild(sectionEl);
      }
    }
  }
}

customElements.define('sherpa-container-pdf', SherpaContainerPdf);
