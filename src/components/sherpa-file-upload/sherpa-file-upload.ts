/**
 * sherpa-file-upload — a drag-and-drop file selection zone.
 *
 * Rebuilt to match the Figma "File Uploader": a drop zone, a details block (max
 * size + allowed types), a file list (each row: icon + name + size + status +
 * remove), and an actions row (clear-all + upload). The drop area opens a hidden
 * native file input on click / keyboard and accepts dropped files. Drag state,
 * file presence and disabled are data-* on the host (pure CSS); JS carries the
 * files, mirrors accept/multiple, and emits the lifecycle events.
 *
 * @fires file-add          detail: { added: File[], files: File[] }
 * @fires file-remove       detail: { removed: File, files: File[] }
 * @fires file-clear        detail: {}
 * @fires file-upload-start detail: { files: File[] }
 * @fires files-change      detail: { files: File[] }   (kept for back-compat)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaFileUpload extends SherpaElement {
  static override css = new URL('./sherpa-file-upload.css', import.meta.url);
  static override html = new URL('./sherpa-file-upload.html', import.meta.url);
  static override observed = ['data-label', 'data-helper', 'data-max-size', 'data-accept', 'data-multiple', 'disabled'];

  #input: HTMLInputElement | null = null;
  #files: File[] = [];
  /** Drag-enter counter — survives dragenter/leave on nested children. */
  #dragDepth = 0;

  override onRender(): void {
    this.#input = this.$<HTMLInputElement>('.file-input');
    this.#syncText();
    this.#syncInput();

    const zone = this.$('.drop-zone');
    zone?.addEventListener('click', this.#open);
    zone?.addEventListener('keydown', this.#onKeydown);
    zone?.addEventListener('dragenter', this.#onDragEnter);
    zone?.addEventListener('dragover', this.#onDragOver);
    zone?.addEventListener('dragleave', this.#onDragLeave);
    zone?.addEventListener('drop', this.#onDrop);

    this.#input?.addEventListener('change', this.#onInputChange);
    this.$('.file-list')?.addEventListener('click', this.#onListClick);
    this.$('.clear-all')?.addEventListener('click', this.#onClearAll);
    this.$('.upload')?.addEventListener('click', this.#onUpload);
  }

  override onChange(name: string): void {
    if (name === 'data-label' || name === 'data-helper' || name === 'data-max-size' || name === 'data-accept') this.#syncText();
    if (name === 'data-accept' || name === 'data-multiple') this.#syncInput();
  }

  /** Label / helper / details text into the shadow (CSS collapses empties). */
  #syncText(): void {
    const label = this.$('.label');
    if (label) label.textContent = this.dataset['label'] ?? '';
    const helper = this.$('.helper');
    if (helper) helper.textContent = this.dataset['helper'] ?? '';
    const maxSize = this.$('.max-size');
    if (maxSize) maxSize.textContent = this.dataset['maxSize'] ? `Maximum file size: ${this.dataset['maxSize']}` : '';
    const allowed = this.$('.allowed-types');
    if (allowed) allowed.textContent = this.dataset['accept'] ? `Allowed file types: ${this.dataset['accept']}` : '';
  }

  /** Mirror accept / multiple host → native input. */
  #syncInput(): void {
    const input = this.#input;
    if (!input) return;
    if (this.dataset['accept']) input.setAttribute('accept', this.dataset['accept']);
    else input.removeAttribute('accept');
    input.toggleAttribute('multiple', this.hasAttribute('data-multiple'));
  }

  /* ── Open / drag / drop ────────────────────────────────────────────── */

  #open = (): void => {
    if (!this.hasAttribute('disabled')) this.#input?.click();
  };

  #onKeydown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#open();
    }
  };

  #onDragEnter = (event: Event): void => {
    event.preventDefault();
    if (this.hasAttribute('disabled')) return;
    this.#dragDepth++;
    this.toggleAttribute('data-dragover', true);
  };

  #onDragOver = (event: Event): void => {
    event.preventDefault();
    const e = event as DragEvent;
    if (e.dataTransfer && !this.hasAttribute('disabled')) e.dataTransfer.dropEffect = 'copy';
  };

  #onDragLeave = (event: Event): void => {
    event.preventDefault();
    if (--this.#dragDepth <= 0) {
      this.#dragDepth = 0;
      this.removeAttribute('data-dragover');
    }
  };

  #onDrop = (event: Event): void => {
    event.preventDefault();
    this.#dragDepth = 0;
    this.removeAttribute('data-dragover');
    if (this.hasAttribute('disabled')) return;
    this.#add(Array.from((event as DragEvent).dataTransfer?.files ?? []));
  };

  #onInputChange = (): void => {
    this.#add(Array.from(this.#input?.files ?? []));
    if (this.#input) this.#input.value = ''; // allow re-picking the same file
  };

  /* ── File list ─────────────────────────────────────────────────────── */

  #add(incoming: File[]): void {
    if (!incoming.length) return;
    const added = this.hasAttribute('data-multiple') ? incoming : incoming.slice(0, 1);
    this.#files = this.hasAttribute('data-multiple') ? [...this.#files, ...added] : added;
    this.#render();
    this.emit('file-add', { added, files: this.#files });
    this.emit('files-change', { files: this.#files });
  }

  #render(): void {
    const list = this.$('.file-list');
    const tpl = this.$<HTMLTemplateElement>('template.file-item-tpl');
    if (!list || !tpl) return;
    list.replaceChildren();
    this.#files.forEach((file, i) => {
      const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      row.dataset['index'] = String(i);
      row.querySelector('.file-name')!.textContent = file.name;
      row.querySelector('.file-size')!.textContent = this.#formatSize(file.size);
      list.appendChild(row);
    });
    this.toggleAttribute('data-has-files', this.#files.length > 0);
  }

  #onListClick = (event: Event): void => {
    const btn = (event.target as HTMLElement).closest('.file-remove');
    if (!btn) return;
    const row = btn.closest<HTMLElement>('.file-item');
    const idx = Number(row?.dataset['index']);
    if (Number.isNaN(idx)) return;
    const [removed] = this.#files.splice(idx, 1);
    this.#render();
    if (removed) this.emit('file-remove', { removed, files: this.#files });
    this.emit('files-change', { files: this.#files });
  };

  #onClearAll = (): void => {
    if (this.hasAttribute('disabled') || !this.#files.length) return;
    this.#files = [];
    this.#render();
    this.emit('file-clear', {});
    this.emit('files-change', { files: this.#files });
  };

  #onUpload = (): void => {
    if (this.hasAttribute('disabled') || this.hasAttribute('data-uploading') || !this.#files.length) return;
    this.emit('file-upload-start', { files: this.#files });
  };

  /** Set a per-file status line (e.g. "Uploading…", "Uploaded", "Failed"). */
  setFileStatus(index: number, status: string): void {
    const row = this.$$('.file-item').find((r) => Number((r as HTMLElement).dataset['index']) === index);
    const el = row?.querySelector('.file-status');
    if (el) el.textContent = status;
  }

  #formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Current list of selected files. */
  get files(): File[] {
    return [...this.#files];
  }
}

customElements.define('sherpa-file-upload', SherpaFileUpload);
