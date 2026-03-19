/**
 * @element sherpa-file-upload
 * @description File upload drop zone with drag-and-drop, file list,
 *   and per-file progress/status tracking. Consumer handles actual upload;
 *   call setFileState/setFileProgress to update UI.
 *
 * @attr {string}  [data-label]     — Label text above the drop zone
 * @attr {string}  [data-accept]    — Accepted file types (e.g. ".jpg,.png,image/*")
 * @attr {boolean} [data-multiple]  — Allow multiple file selection
 * @attr {string}  [data-max-size]  — Maximum file size in bytes
 * @attr {string}  [data-max-files] — Maximum number of files
 * @attr {string}  [data-helper]    — Constraint / helper text
 * @attr {boolean} [disabled]       — Disabled state
 *
 * @fires file-add
 *   bubbles: true, composed: true
 *   detail: { files: File[] }
 * @fires file-remove
 *   bubbles: true, composed: true
 *   detail: { file: File, index: number }
 * @fires file-clear
 *   bubbles: true, composed: true
 *   detail: none
 * @fires file-upload-start
 *   bubbles: true, composed: true
 *   detail: { files: File[] }
 *
 * @method setFileState(index, state, statusText) — Update file item state
 * @method setFileProgress(index, percent) — Update file upload progress
 *
 * @prop {File[]} files — Current list of selected files (getter-only)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaFileUpload extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-file-upload.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-file-upload.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-accept",
      "data-multiple",
      "data-max-size",
      "data-max-files",
      "data-helper",
      "disabled",
    ];
  }

  /* ── cached refs ─────────────────────────────────────────── */

  /** @type {HTMLSpanElement|null} */
  #labelEl = null;
  /** @type {HTMLDivElement|null} */
  #dropZoneEl = null;
  /** @type {HTMLInputElement|null} */
  #fileInputEl = null;
  /** @type {HTMLDivElement|null} */
  #fileListEl = null;
  /** @type {HTMLTemplateElement|null} */
  #fileItemTpl = null;
  /** @type {HTMLSpanElement|null} */
  #constraintsTextEl = null;
  /** @type {HTMLButtonElement|null} */
  #uploadBtnEl = null;
  /** @type {HTMLButtonElement|null} */
  #removeAllBtnEl = null;

  /** @type {{ file: File, el: HTMLElement }[]} */
  #files = [];

  /** @type {number} drag-enter counter for nested elements */
  #dragCounter = 0;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#labelEl = this.$(".label");
    this.#dropZoneEl = this.$(".drop-zone");
    this.#fileInputEl = this.$(".file-input");
    this.#fileListEl = this.$(".file-list");
    this.#fileItemTpl = this.$(".file-item-tpl");
    this.#constraintsTextEl = this.$(".constraints-text");
    this.#uploadBtnEl = this.$(".upload-btn");
    this.#removeAllBtnEl = this.$(".remove-all-btn");

    // Drop zone click → trigger file input
    this.#dropZoneEl.addEventListener("click", () => {
      if (!this.hasAttribute("disabled")) this.#fileInputEl.click();
    });
    this.#dropZoneEl.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !this.hasAttribute("disabled")) {
        e.preventDefault();
        this.#fileInputEl.click();
      }
    });

    // File input change
    this.#fileInputEl.addEventListener("change", () => {
      this.#addFiles(Array.from(this.#fileInputEl.files));
      this.#fileInputEl.value = "";
    });

    // Drag events on drop zone
    this.#dropZoneEl.addEventListener("dragenter", (e) => this.#onDragEnter(e));
    this.#dropZoneEl.addEventListener("dragover", (e) => this.#onDragOver(e));
    this.#dropZoneEl.addEventListener("dragleave", (e) => this.#onDragLeave(e));
    this.#dropZoneEl.addEventListener("drop", (e) => this.#onDrop(e));

    // Action buttons
    this.#uploadBtnEl.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("file-upload-start", {
          bubbles: true,
          composed: true,
          detail: { files: this.#files.map((f) => f.file) },
        })
      );
    });
    this.#removeAllBtnEl.addEventListener("click", () => this.#clearAll());

    // Initial sync
    this.#syncLabel();
    this.#syncHelper();
    this.#syncFileInput();
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-label":
        this.#syncLabel();
        break;
      case "data-helper":
        this.#syncHelper();
        break;
      case "data-accept":
      case "data-multiple":
        this.#syncFileInput();
        break;
    }
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) {
      this.#labelEl.textContent = this.dataset.label || "";
    }
  }

  #syncHelper() {
    if (this.#constraintsTextEl) {
      this.#constraintsTextEl.textContent = this.dataset.helper || "";
    }
  }

  #syncFileInput() {
    if (!this.#fileInputEl) return;
    if (this.dataset.accept) {
      this.#fileInputEl.setAttribute("accept", this.dataset.accept);
    } else {
      this.#fileInputEl.removeAttribute("accept");
    }
    if (this.hasAttribute("data-multiple")) {
      this.#fileInputEl.setAttribute("multiple", "");
    } else {
      this.#fileInputEl.removeAttribute("multiple");
    }
  }

  #updateHasFiles() {
    this.toggleAttribute("data-has-files", this.#files.length > 0);
  }

  /* ── drag & drop ─────────────────────────────────────────── */

  #onDragEnter(e) {
    e.preventDefault();
    if (this.hasAttribute("disabled")) return;
    this.#dragCounter++;
    this.toggleAttribute("data-drag-over", true);
  }

  #onDragOver(e) {
    e.preventDefault();
    if (this.hasAttribute("disabled")) return;
    e.dataTransfer.dropEffect = "copy";
  }

  #onDragLeave(e) {
    e.preventDefault();
    this.#dragCounter--;
    if (this.#dragCounter <= 0) {
      this.#dragCounter = 0;
      this.removeAttribute("data-drag-over");
    }
  }

  #onDrop(e) {
    e.preventDefault();
    this.#dragCounter = 0;
    this.removeAttribute("data-drag-over");
    if (this.hasAttribute("disabled")) return;

    const files = Array.from(e.dataTransfer.files);
    this.#addFiles(files);
  }

  /* ── file management ─────────────────────────────────────── */

  #addFiles(files) {
    if (!files.length) return;

    const maxFiles = parseInt(this.dataset.maxFiles) || Infinity;
    const maxSize = parseInt(this.dataset.maxSize) || Infinity;
    const accepted = this.dataset.accept
      ? this.dataset.accept.split(",").map((s) => s.trim().toLowerCase())
      : null;

    const valid = [];
    for (const file of files) {
      // Count check
      if (this.#files.length + valid.length >= maxFiles) break;

      // Size check
      if (file.size > maxSize) continue;

      // Type check
      if (accepted && !this.#matchesAccept(file, accepted)) continue;

      valid.push(file);
    }

    if (!valid.length) return;

    for (const file of valid) {
      const el = this.#createFileItem(file);
      this.#fileListEl.appendChild(el);
      this.#files.push({ file, el });
    }

    this.#updateHasFiles();

    this.dispatchEvent(
      new CustomEvent("file-add", {
        bubbles: true,
        composed: true,
        detail: { files: valid },
      })
    );
  }

  #matchesAccept(file, accepted) {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    return accepted.some((pattern) => {
      if (pattern.startsWith(".")) {
        return fileName.endsWith(pattern);
      }
      if (pattern.endsWith("/*")) {
        return fileType.startsWith(pattern.replace("/*", "/"));
      }
      return fileType === pattern;
    });
  }

  #createFileItem(file) {
    const clone = this.#fileItemTpl.content.cloneNode(true);
    const item = clone.querySelector(".file-item");

    item.querySelector(".file-name").textContent = file.name;
    item.querySelector(".file-size").textContent = this.#formatSize(file.size);
    item.querySelector(".file-status-text").textContent = "Ready to upload";
    item.dataset.state = "ready";

    // Remove button
    item.querySelector(".file-remove-btn").addEventListener("click", () => {
      const idx = this.#files.findIndex((f) => f.el === item);
      if (idx !== -1) {
        const removed = this.#files.splice(idx, 1)[0];
        item.remove();
        this.#updateHasFiles();
        this.dispatchEvent(
          new CustomEvent("file-remove", {
            bubbles: true,
            composed: true,
            detail: { file: removed.file, index: idx },
          })
        );
      }
    });

    // Retry button
    item.querySelector(".file-retry-btn").addEventListener("click", () => {
      const entry = this.#files.find((f) => f.el === item);
      if (entry) {
        item.dataset.state = "ready";
        item.querySelector(".file-status-text").textContent = "Ready to upload";
      }
    });

    return item;
  }

  #clearAll() {
    this.#files = [];
    this.#fileListEl.textContent = "";
    this.#updateHasFiles();
    this.dispatchEvent(
      new CustomEvent("file-clear", {
        bubbles: true,
        composed: true,
      })
    );
  }

  #formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /* ── public API for consumers ────────────────────────────── */

  /**
   * Set the upload state of a file by index.
   * @param {number} index
   * @param {'ready'|'uploading'|'uploaded'|'failed'} state
   * @param {string} [statusText] — optional override for status label
   */
  setFileState(index, state, statusText) {
    const entry = this.#files[index];
    if (!entry) return;
    entry.el.dataset.state = state;

    const statusLabels = {
      ready: "Ready to upload",
      uploading: "Uploading…",
      uploaded: "Uploaded",
      failed: "Failed",
    };
    entry.el.querySelector(".file-status-text").textContent =
      statusText || statusLabels[state] || state;
  }

  /**
   * Set upload progress for a file by index (0–100).
   * @param {number} index
   * @param {number} percent
   */
  setFileProgress(index, percent) {
    const entry = this.#files[index];
    if (!entry) return;
    entry.el.dataset.state = "uploading";
    const fill = entry.el.querySelector(".file-progress-fill");
    if (fill) fill.style.setProperty("--_file-progress", `${percent}%`);

    const status = entry.el.querySelector(".file-status-text");
    if (status) status.textContent = `${Math.round(percent)}%`;
  }

  /**
   * Get the current list of File objects.
   * @returns {File[]}
   */
  get files() {
    return this.#files.map((f) => f.file);
  }
}

customElements.define("sherpa-file-upload", SherpaFileUpload);
export { SherpaFileUpload };
