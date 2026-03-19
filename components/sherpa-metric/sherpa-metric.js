/**
 * SherpaMetric - KPI card with value, trend, and sparkline.
 *
 * Uses DataQueryHandler's unified format - metrics are aggregated views
 * of the same data that can render as tables or charts.
 *
 * Status Styling:
 *   The host carries `status` for explicit coloring; `.metric-card`
 *   carries `data-status` for trend-derived coloring.  Attribute selectors
 *   in sherpa-metric.css set universal colour properties that cascade to children.
 *
 * Trend Display:
 *   - data-trend="up" or "down": Shows trend icon and colored delta
 *   - data-trend="flat": Shows unit type in delta label with default color (no icon)
 *
 * Attributes:
 *   - visible: boolean - Controls metric visibility (hidden when absent/false)
 *   - metric-id: string - Unique identifier for the metric
 *   - status: 'success' | 'warning' | 'critical' | 'info' | 'urgent' - Status styling
 *   - data-trend: 'up' | 'down' | 'flat' - Trend direction (controls icon and delta color)
 *   - heading: string - Metric heading/label
 *   - value: string - Formatted metric value
 *   - delta: string - Change amount (e.g., "+12.5%") or unit type when flat
 *   - Content config attributes: data-label, data-dataset, data-value-field, data-agg,
 *     data-segment-field, data-show-status, data-sort-field, data-sort-direction,
 *     data-limit, data-visible, data-filters
 */
import "../sherpa-sparkline/sherpa-sparkline.js";
import { getTransferableConfig } from "../utilities/data-utils.js";
import {
  ContentAttributesMixin,
  CONTENT_ATTRIBUTES,
} from "../utilities/content-attributes-mixin.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { getCurrencyCode, getCurrencySymbol } from "../utilities/format-utils.js";

/* ── Pluggable trend-to-status mapping ───────────────────────── */

let _trendStatusMap = { up: 'success', down: 'critical', flat: 'neutral' };

/**
 * Override the default mapping from trend direction to status.
 * @param {{ up?: string, down?: string, flat?: string }} map
 */
export function setTrendStatusMap(map) {
  _trendStatusMap = { ..._trendStatusMap, ...map };
}

export class SherpaMetric extends ContentAttributesMixin(SherpaElement) {
  static cssUrl = new URL("./sherpa-metric.css", import.meta.url).href;
  static htmlUrl = new URL("./sherpa-metric.html", import.meta.url).href;

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-metric-id",
      "data-status",
      "data-trend",
      "data-label",
      "value",
      "data-delta",
    ];
  }

  #contentData = null; // Unified format from DataQueryHandler
  #sparklineValues = [];
  #sparklineUnit = "";
  #suppressSparkline = false;

  onRender() {
    // Mark as viz component for container CSS targeting
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
  }

  setVisible(visible) {
    this.dataset.visible = visible === false ? "false" : "true";
  }
  isVisible() {
    return this.dataset.visible !== "false";
  }

  onAttributeChanged(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case "data-label": {
        const titleEl = this.$(".header-title");
        if (titleEl) titleEl.textContent = newValue || "";
        break;
      }
      case "value":
        if (this.$(".metric-value"))
          this.$(".metric-value").textContent = newValue || "";
        break;
      case "data-delta":
        if (this.$(".metric-delta"))
          this.$(".metric-delta").textContent = newValue || "";
        break;
      case "data-status": {
        // Status drives sparkline visibility
        this.#updateSparkline({ forceHidden: this.#suppressSparkline });
        break;
      }
    }
  }

  /**
   * Get configuration for switching to another presentation type
   */
  getTransferableConfig(presentationType) {
    return this.#contentData
      ? getTransferableConfig(this.#contentData, presentationType)
      : null;
  }

  /**
   * Override getData() to return metric configuration for component switching
   * (base class looks for #data which is not populated in metric)
   */
  getData() {
    if (!this.#contentData) return null;
    // For metric transitions, use the full config with all necessary fields
    const config = getTransferableConfig(this.#contentData, "table");
    return config;
  }

  async setData(data) {
    await this.rendered;

    // Pre-aggregated data from dataset cascade
    if (data?._fromCascade) {
      this.#contentData = data;
      this.#initialize();
      return;
    }

    // Legacy: content config from ContentAttributesMixin
    const config = { ...data, presentationType: "kpi-metric" };
    this.#contentData = await this.fetchContentData(config);
    this.#initialize();
  }

  // ============ Private Methods ============

  #initialize() {
    if (!this.#contentData) {
      console.error("[SherpaMetric] #initialize called but missing data");
      return;
    }

    // Configure the header using the parent class method
    const viewOptions = this.getViewOptions({
      activeType: "kpi-metric",
      canShowChart: true,
    });

    this.configureHeader({
      title: this.#contentData?.name || "",
      viewOptions,
    });

    this.#populate();
    this.wireContentMenu(this, "kpi-metric");
  }

  #populate() {
    const data = this.#contentData;
    if (!data) {
      console.error("[SherpaMetric] No content data available");
      return;
    }

    const summary = {
      total: 0,
      delta: 0,
      deltaPercent: 0,
      values: [],
      ...(data.summary || {}),
    };
    const config = data.config || {};
    const values = Array.isArray(summary.values) ? summary.values : [];
    const totalValue = Number.isFinite(summary.total) ? summary.total : 0;
    const unitText = config.unit || "";
    const showStatus = config.showStatus !== false;

    // Derive trend direction from delta (newest bucket vs oldest bucket)
    const hasTrend = values.length > 1 && summary.delta !== 0;
    // Show sparkline whenever there is multi-bucket time data with any variance
    const hasTimeSeries = values.length > 1 && new Set(values).size > 1;
    let trendDir = "flat";
    if (hasTrend) {
      trendDir = summary.delta > 0 ? "up" : "down";
    }

    const deltaValue = summary.delta;
    const deltaPercent = summary.deltaPercent;

    const formattedValue = this.#formatNumber(totalValue, unitText);
    const sign = deltaValue >= 0 ? "+" : "";
    const formattedDelta = `${sign}${this.#trimDecimals(deltaPercent.toFixed(2))}% (${sign}${this.#formatDelta(deltaValue, unitText)})`;

    // Show delta when trending, unit when flat
    const trendLabel = trendDir === "flat" ? unitText : formattedDelta;

    // Status only applied when explicitly set via config or attribute
    const explicitStatus = config.status || this.dataset.status || "";

    // Derive trend-based status for the card wrapper (not the host)
    let cardStatus = explicitStatus;
    if ((!cardStatus || cardStatus === "default") && showStatus) {
      if (trendDir === "up") {
        cardStatus = _trendStatusMap.up || "success";
      } else if (trendDir === "down") {
        cardStatus = _trendStatusMap.down || "critical";
      } else if (hasTimeSeries) {
        cardStatus = _trendStatusMap.flat || "neutral";
      } else {
        cardStatus = "";
      }
    }

    // Set trend direction attribute (trend label always visible, just icons hidden when flat)
    this.setAttribute("data-trend", trendDir);
    this.dataset.metricId = data.name || "";
    this.dataset.label = data.name || "";
    this.setAttribute("value", formattedValue);
    this.dataset.delta = trendLabel;

    // Apply explicit status to the host element
    if (
      explicitStatus &&
      explicitStatus !== "default" &&
      explicitStatus !== "none"
    ) {
      this.dataset.status = explicitStatus;
    } else {
      delete this.dataset.status;
    }

    // Apply trend-derived status to .metric-card so tokens cascade to children
    const card = this.$(".metric-card");
    if (card) {
      if (cardStatus && cardStatus !== "default" && cardStatus !== "none") {
        card.dataset.status = cardStatus;
      } else {
        delete card.dataset.status;
      }
    }

    // Update DOM
    const metricValue = this.$(".metric-value");
    if (metricValue) {
      metricValue.textContent = formattedValue;
    }

    const deltaEL = this.$(".metric-delta");
    if (deltaEL) {
      deltaEL.textContent = trendLabel;
    }

    // Create sparkline from summary values — show whenever there is time-series variance
    this.#suppressSparkline = !hasTimeSeries;

    const sparklineValues = values.slice();
    this.#updateSparkline({
      status: cardStatus,
      unitText,
      values: sparklineValues,
      forceHidden: this.#suppressSparkline,
    });
  }

  #updateSparkline({ status, unitText, values, forceHidden } = {}) {
    if (forceHidden !== undefined) {
      this.#suppressSparkline = !!forceHidden;
    }

    if (unitText !== undefined) {
      this.#sparklineUnit = unitText ?? "";
    } else {
      unitText = this.#sparklineUnit;
    }

    if (values !== undefined) {
      this.#sparklineValues = Array.isArray(values) ? values : [];
    } else {
      values = this.#sparklineValues;
    }

    const showSparkline = !this.#suppressSparkline;

    // CSS controls visibility via :host([data-sparkline]) .metric-sparkline
    this.toggleAttribute("data-sparkline", showSparkline);

    if (!showSparkline) return;

    const sparkline = this.$("sherpa-sparkline");
    if (!sparkline) return;

    sparkline.dataset.unit = unitText || "";
    sparkline.setValues(Array.isArray(values) ? values : []);
  }

  #formatNumber(num, unit) {
    const isCurrency = unit === getCurrencyCode();
    const isPercent = unit === "percent" || unit === "%";
    let str;
    if (num >= 1e6) str = this.#trimDecimals((num / 1e6).toFixed(2)) + "M";
    else if (num >= 1e3) str = this.#trimDecimals((num / 1e3).toFixed(2)) + "K";
    else str = this.#trimDecimals(num.toFixed(2));
    if (isCurrency) return getCurrencySymbol() + str;
    if (isPercent) return str + "%";
    return str;
  }

  #formatDelta(num, unit) {
    const isCurrency = unit === getCurrencyCode();
    const isPercent = unit === "percent" || unit === "%";
    const abs = Math.abs(num);
    let str;
    if (abs >= 1e6) str = this.#trimDecimals((num / 1e6).toFixed(2)) + "M";
    else if (abs >= 1e3) str = this.#trimDecimals((num / 1e3).toFixed(2)) + "K";
    else str = this.#trimDecimals(num.toFixed(2));
    if (isCurrency) return getCurrencySymbol() + str;
    if (isPercent) return str + "%";
    return str;
  }

  /** Strip unnecessary trailing zeros: "1.50" → "1.5", "2.00" → "2" */
  #trimDecimals(str) {
    return str.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
  }
}

customElements.define("sherpa-metric", SherpaMetric);
