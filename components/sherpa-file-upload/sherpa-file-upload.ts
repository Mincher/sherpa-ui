/**
 * @element sherpa-file-upload
 * @category input
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
  static override get cssUrl(): string {
    return new URL("sherpa-file-upload.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-file-upload.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
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

  els = this.cacheElements({
    label: '.label',
    dropZone: '.drop-zone',
    fileInput: { selector: '.file-input', type: HTMLInputElement },
    fileList: '.file-list',
    fileItemTpl: { selector: '.file-item-tpl', type: HTMLTemplateElement },
    constraintsText: '.constraints-text',
    uploadBtn: { selector: '.upload-btn', type: HTMLButtonElement },
    removeAllBtn: { selector: '.remove-all-btn', type: HTMLButtonElement }
  });

  /** @type {{ file: File, el: HTMLElement }[]} */
  #files = [];

  /** @type {number} drag-enter counter for nested elements */
  #dragCounter = 0;

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {

    // Drop zone click → trigger file input
    // @ts-expect-error - TODO: Fix type
    this.els.dropZone.addEventListener("click", () => {
      // @ts-expect-error - TODO: Fix type
      if (!this.hasAttribute("disabled")) this.els.fileInput.click();
    });
    // @ts-expect-error - TODO: Fix type
    this.els.dropZone.addEventListener("keydown", (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !this.hasAttribute("disabled")) {
        e.preventDefault();
        // @ts-expect-error - TODO: Fix type
        this.els.fileInput.click();
      }
    });

    // File input change
    // @ts-expect-error - TODO: Fix type
    this.els.fileInput.addEventListener("change", () => {
      // @ts-expect-error - TODO: Fix type
      this.#addFiles(Array.from(this.els.fileInput.files));
      // @ts-expect-error - TODO: Fix type
      this.els.fileInput.value = "";
    });

    // Drag events on drop zone
    // @ts-expect-error - TODO: Fix type
    this.els.dropZone.addEventListener("dragenter", (e) => this.#onDragEnter(e));
    // @ts-expect-error - TODO: Fix type
    this.els.dropZone.addEventListener("dragover", (e) => this.#onDragOver(e));
    // @ts-expect-error - TODO: Fix type
    this.els.dropZone.addEventListener("dragleave", (e) => this.#onDragLeave(e));
    // @ts-expect-error - TODO: Fix type
    this.els.dropZone.addEventListener("drop", (e) => this.#onDrop(e));

    // Action buttons
    // @ts-expect-error - TODO: Fix type
    this.els.uploadBtn.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("file-upload-start", {
          bubbles: true,
          composed: true,
          // @ts-expect-error - TODO: Fix type
          detail: { files: this.#files.map((f) => f.file) },
        })
      );
    });
    // @ts-expect-error - TODO: Fix type
    this.els.removeAllBtn.addEventListener("click", () => this.#clearAll());

    // Initial sync
    this.#syncLabel();
    this.#syncHelper();
    this.#syncFileInput();
  }

  // @ts-expect-error - TODO: Fix type
  override onAttributeChanged(name) {
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
    if (this.els.label) {
      this.els.label.textContent = this.dataset["label"] || "";
    }
  }

  #syncHelper() {
    if (this.els.constraintsText) {
      this.els.constraintsText.textContent = this.dataset["helper"] || "";
    }
  }

  #syncFileInput() {
    if (!this.els.fileInput) return;
    if (this.dataset["accept"]) {
      this.els.fileInput.setAttribute("accept", this.dataset["accept"]);
    } else {
      this.els.fileInput.removeAttribute("accept");
    }
    if (this.hasAttribute("data-multiple")) {
      this.els.fileInput.setAttribute("multiple", "");
    } else {
      this.els.fileInput.removeAttribute("multiple");
    }
  }

  #updateHasFiles() {
    this.toggleAttribute("data-has-files", this.#files.length > 0);
  }

  /* ── drag & drop ─────────────────────────────────────────── */

  #onDragEnter(e: Event) {
    e.preventDefault();
    if (this.hasAttribute("disabled")) return;
    this.#dragCounter++;
    this.toggleAttribute("data-drag-over", true);
  }

  #onDragOver(e: Event) {
    e.preventDefault();
    if (this.hasAttribute("disabled")) return;
    // @ts-expect-error - TODO: Fix type
    e.dataTransfer.dropEffect = "copy";
  }

  #onDragLeave(e: Event) {
    e.preventDefault();
    this.#dragCounter--;
    if (this.#dragCounter <= 0) {
      this.#dragCounter = 0;
      this.removeAttribute("data-drag-over");
    }
  }

  #onDrop(e: Event) {
    e.preventDefault();
    this.#dragCounter = 0;
    this.removeAttribute("data-drag-over");
    if (this.hasAttribute("disabled")) return;

    // @ts-expect-error - TODO: Fix type
    const files = Array.from(e.dataTransfer.files);
    this.#addFiles(files);
  }

  /* ── file management ─────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #addFiles(files) {
    if (!files.length) return;

    // @ts-expect-error - TODO: Fix type
    const maxFiles = parseInt(this.dataset["maxFiles"]) || Infinity;
    // @ts-expect-error - TODO: Fix type
    const maxSize = parseInt(this.dataset["maxSize"]) || Infinity;
    const accepted = this.dataset["accept"]
      ? this.dataset["accept"].split(",").map((s) => s.trim().toLowerCase())
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
      // @ts-expect-error - TODO: Fix type
      this.els.fileList.appendChild(el);
      // @ts-expect-error - TODO: Fix type
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

  // @ts-expect-error - TODO: Fix type
  #matchesAccept(file, accepted) {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    // @ts-expect-error - TODO: Fix type
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

  // @ts-expect-error - TODO: Fix type
  #createFileItem(file) {
    // @ts-expect-error - TODO: Fix type
    const clone = this.els.fileItemTpl.content.cloneNode(true);
    // @ts-expect-error - TODO: Fix type
    const item = clone.querySelector(".file-item");

    item.querySelector(".file-name").textContent = file.name;
    item.querySelector(".file-size").textContent = this.#formatSize(file.size);
    item.querySelector(".file-status-text").textContent = "Ready to upload";
    item.dataset["state"] = "ready";

    // Remove button
    item.querySelector(".file-remove-btn").addEventListener("click", () => {
      // @ts-expect-error - TODO: Fix type
      const idx = this.#files.findIndex((f) => f.el === item);
      if (idx !== -1) {
        const removed = this.#files.splice(idx, 1)[0];
        item.remove();
        this.#updateHasFiles();
        this.dispatchEvent(
          new CustomEvent("file-remove", {
            bubbles: true,
            composed: true,
            // @ts-expect-error - TODO: Fix type
            detail: { file: removed.file, index: idx },
          })
        );
      }
    });

    // Retry button
    item.querySelector(".file-retry-btn").addEventListener("click", () => {
      // @ts-expect-error - TODO: Fix type
      const entry = this.#files.find((f) => f.el === item);
      if (entry) {
        item.dataset["state"] = "ready";
        item.querySelector(".file-status-text").textContent = "Ready to upload";
      }
    });

    return item;
  }

  #clearAll() {
    this.#files = [];
    // @ts-expect-error - TODO: Fix type
    this.els.fileList.textContent = "";
    this.#updateHasFiles();
    this.dispatchEvent(
      new CustomEvent("file-clear", {
        bubbles: true,
        composed: true,
      })
    );
  }

  // @ts-expect-error - TODO: Fix type
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
  // @ts-expect-error - TODO: Fix type
  setFileState(index, state, statusText) {
    const entry = this.#files[index];
    if (!entry) return;
    // @ts-expect-error - TODO: Fix type
    entry.el.dataset["state"] = state;

    const statusLabels = {
      ready: "Ready to upload",
      uploading: "Uploading…",
      uploaded: "Uploaded",
      failed: "Failed",
    };
    // @ts-expect-error - TODO: Fix type
    entry.el.querySelector(".file-status-text").textContent =
      // @ts-expect-error - TODO: Fix type
      statusText || statusLabels[state] || state;
  }

  /**
   * Set upload progress for a file by index (0–100).
   * @param {number} index
   * @param {number} percent
   */
  // @ts-expect-error - TODO: Fix type
  setFileProgress(index, percent) {
    const entry = this.#files[index];
    if (!entry) return;
    // @ts-expect-error - TODO: Fix type
    entry.el.dataset["state"] = "uploading";
    // @ts-expect-error - TODO: Fix type
    const fill = entry.el.querySelector(".file-progress-fill");
    if (fill) fill.style.setProperty("--_file-progress", `${percent}%`);

    // @ts-expect-error - TODO: Fix type
    const status = entry.el.querySelector(".file-status-text");
    if (status) status.textContent = `${Math.round(percent)}%`;
  }

  /**
   * Get the current list of File objects.
   * @returns {File[]}
   */
  get files() {
    // @ts-expect-error - TODO: Fix type
    return this.#files.map((f) => f.file);
  }
}

customElements.define("sherpa-file-upload", SherpaFileUpload);
export { SherpaFileUpload };
