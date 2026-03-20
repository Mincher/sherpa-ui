/**
 * @element sherpa-container-pdf
 * @description Print-optimized container renderer for PDF export via browser print.
 *
 * Accepts a source container element and renders a print-friendly representation
 * with optional chart snapshots, metrics, and data tables.
 *
 * @method setData(sourceContainer, options) — Renders the source container
 *   @param {HTMLElement} sourceContainer — The sherpa-data-viz-container to render
 *   @param {Object} options — Control what to render
 *     @prop {boolean} includeChart — Render chart visual (clone SVG/canvas from shadow DOM)
 *     @prop {boolean} includeMetrics — Render metrics row
 *     @prop {boolean} includeDataGrid — Include tabular data representation
 */

class SherpaContainerPdf extends HTMLElement {
  /**
   * Render a source container in print-friendly format
   * @param {HTMLElement} sourceContainer — The sherpa-data-viz-container
   * @param {Object} options — { includeChart, includeMetrics, includeDataGrid }
   */
  async setData(sourceContainer, options = {}) {
    const {
      includeChart = true,
      includeMetrics = true,
      includeDataGrid = false,
    } = options;

    // Clear any previous content
    this.innerHTML = '';

    if (!sourceContainer) {
      console.warn('sherpa-container-pdf: No source container provided');
      return;
    }

    // Create container wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'container-pdf-wrapper';

    // Header: title and description
    const title = sourceContainer.getAttribute('data-title') || 'Export';
    const description = sourceContainer.getAttribute('data-description') || '';

    const header = document.createElement('div');
    header.className = 'container-pdf-header';

    const titleEl = document.createElement('h2');
    titleEl.className = 'container-pdf-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (description) {
      const descEl = document.createElement('p');
      descEl.className = 'container-pdf-description';
      descEl.textContent = description;
      header.appendChild(descEl);
    }

    wrapper.appendChild(header);

    // Content: metrics, charts, and data grids
    const content = document.createElement('div');
    content.className = 'container-pdf-content';

    // Render metrics if requested
    if (includeMetrics) {
      const metricsSection = this.#renderMetrics(sourceContainer);
      if (metricsSection) {
        content.appendChild(metricsSection);
      }
    }

    // Find and render viz children (charts, grids)
    const vizElements = [...sourceContainer.querySelectorAll(':not(template)')].filter(
      (el) =>
        el.tagName.startsWith('SHERPA-') &&
        ['BARCHART', 'DONUT-CHART', 'LINE-CHART', 'DATA-GRID'].some((tag) =>
          el.tagName.includes(tag.toUpperCase()),
        ),
    );

    for (const vizEl of vizElements) {
      if (vizEl.tagName.includes('DATA-GRID')) {
        // Render data grid as table
        const gridSection = this.#renderDataGrid(vizEl);
        if (gridSection) content.appendChild(gridSection);
      } else if (
        vizEl.tagName.includes('BARCHART') ||
        vizEl.tagName.includes('DONUT-CHART') ||
        vizEl.tagName.includes('LINE-CHART')
      ) {
        // Render chart snapshot if requested
        if (includeChart) {
          const chartSection = this.#renderChartSnapshot(vizEl);
          if (chartSection) content.appendChild(chartSection);
        }

        // Render data table if requested
        if (includeDataGrid) {
          const dataTableSection = this.#renderChartDataTable(vizEl);
          if (dataTableSection) content.appendChild(dataTableSection);
        }
      }
    }

    wrapper.appendChild(content);
    this.appendChild(wrapper);
  }

  /**
   * Render metrics from the source container
   */
  #renderMetrics(sourceContainer) {
    const metrics = [...sourceContainer.querySelectorAll('sherpa-metric')];
    if (metrics.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'container-pdf-metrics';

    const metricsGrid = document.createElement('div');
    metricsGrid.className = 'metrics-grid';

    for (const metric of metrics) {
      const metricCard = document.createElement('div');
      metricCard.className = 'metric-card';

      // Get metric label and value
      const label = metric.getAttribute('data-label') || 'Metric';
      const value = metric.textContent?.trim() || '—';

      const labelEl = document.createElement('span');
      labelEl.className = 'metric-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'metric-value';
      valueEl.textContent = value;

      metricCard.appendChild(labelEl);
      metricCard.appendChild(valueEl);
      metricsGrid.appendChild(metricCard);
    }

    section.appendChild(metricsGrid);
    return section;
  }

  /**
   * Snapshot and render a chart element (bar, donut, line)
   */
  #renderChartSnapshot(chartEl) {
    const section = document.createElement('div');
    section.className = 'container-pdf-chart';

    const title = chartEl.getAttribute('data-title') || 'Chart';
    const titleEl = document.createElement('h3');
    titleEl.className = 'chart-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    try {
      // Try to get the rendered chart from shadow DOM
      const shadowRoot = chartEl.shadowRoot;
      if (!shadowRoot) {
        console.warn(`No shadow root found for ${chartEl.tagName}`);
        return section;
      }

      // Look for SVG or canvas in the shadow DOM
      const svg = shadowRoot.querySelector('svg');
      const canvas = shadowRoot.querySelector('canvas');

      if (svg) {
        // Clone and serialize SVG
        const clonedSvg = svg.cloneNode(true);
        const svgContainer = document.createElement('div');
        svgContainer.className = 'chart-render';
        svgContainer.appendChild(clonedSvg);
        section.appendChild(svgContainer);
      } else if (canvas) {
        // Convert canvas to image
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.className = 'chart-render';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        section.appendChild(img);
      } else {
        // Fallback: try to clone the visible chart area
        const chartArea = shadowRoot.querySelector('.chart-area, [class*="chart"]');
        if (chartArea) {
          const cloned = chartArea.cloneNode(true);
          const container = document.createElement('div');
          container.className = 'chart-render';
          container.appendChild(cloned);
          section.appendChild(container);
        }
      }
    } catch (e) {
      console.warn(`Error rendering chart snapshot: ${e.message}`);
    }

    return section;
  }

  /**
   * Render a data-grid as a table
   */
  #renderDataGrid(gridEl) {
    const section = document.createElement('div');
    section.className = 'container-pdf-datagrid';

    const title = gridEl.getAttribute('data-title') || 'Data Grid';
    const titleEl = document.createElement('h3');
    titleEl.className = 'grid-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    try {
      // Try to get visible table from shadow DOM
      const shadowRoot = gridEl.shadowRoot;
      if (shadowRoot) {
        const table = shadowRoot.querySelector('table');
        if (table) {
          const clonedTable = table.cloneNode(true);
          clonedTable.className = 'data-table';
          section.appendChild(clonedTable);
          return section;
        }
      }

      // Fallback: if visible table is in light DOM (unlikely)
      const lightTable = gridEl.querySelector('table');
      if (lightTable) {
        const cloned = lightTable.cloneNode(true);
        cloned.className = 'data-table';
        section.appendChild(cloned);
        return section;
      }

      console.warn('No table found in data-grid');
    } catch (e) {
      console.warn(`Error rendering data-grid: ${e.message}`);
    }

    return section;
  }

  /**
   * Build a data table from chart's underlying data (for charts with getData/data)
   */
  #renderChartDataTable(chartEl) {
    const section = document.createElement('div');
    section.className = 'container-pdf-datatable';

    const title = chartEl.getAttribute('data-title') || 'Data Table';
    const titleEl = document.createElement('h4');
    titleEl.className = 'datatable-title';
    titleEl.textContent = `${title} (Data)`;
    section.appendChild(titleEl);

    let data = null;

    try {
      // Try getData() first (for barchart)
      if (typeof chartEl.getData === 'function') {
        data = chartEl.getData();
      }
      // Fallback to data property (for donut-chart, line-chart)
      else if (chartEl.data) {
        data = Array.isArray(chartEl.data) ? chartEl.data : [chartEl.data];
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn(`No data found for ${chartEl.tagName}`);
        return section;
      }

      // Build table from data
      const dataArray = Array.isArray(data) ? data : [data];
      if (dataArray.length === 0) return section;

      const table = document.createElement('table');
      table.className = 'data-table';

      // Header row from first item's keys
      const firstItem = dataArray[0];
      if (typeof firstItem === 'object') {
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        Object.keys(firstItem).forEach((key) => {
          const th = document.createElement('th');
          th.textContent = key;
          headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Data rows
        const tbody = document.createElement('tbody');
        dataArray.forEach((item) => {
          const row = document.createElement('tr');
          Object.values(item).forEach((value) => {
            const td = document.createElement('td');
            td.textContent = String(value ?? '').substring(0, 100); // Truncate long values
            row.appendChild(td);
          });
          tbody.appendChild(row);
        });
        table.appendChild(tbody);

        section.appendChild(table);
      }
    } catch (e) {
      console.warn(`Error building data table: ${e.message}`);
    }

    return section;
  }
}

if (!customElements.get('sherpa-container-pdf')) {
  customElements.define('sherpa-container-pdf', SherpaContainerPdf);
}

export { SherpaContainerPdf };
