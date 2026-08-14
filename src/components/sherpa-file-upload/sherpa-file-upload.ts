/**
 * sherpa-file-upload — a drag-and-drop file selection zone.
 *
 * A dashed drop area opens a hidden native file input on click / keyboard, and
 * accepts dropped files. Selected files render as a list (name + size + remove)
 * stamped from a cloning prototype — the only structural DOM this component
 * creates. Drag state is a data-dragover attribute on the host (pure CSS);
 * accept / multiple mirror to the native input. JS carries files and events only.
 *
 * @fires files-change  detail: { files: File[] }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaFileUpload extends SherpaElement {
  static override css = new URL('./sherpa-file-upload.css', import.meta.url);
  static override html = new URL('./sherpa-file-upload.html', import.meta.url);
  static override observed = ['data-label', 'data-helper', 'data-accept', 'data-multiple', 'disabled'];

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
    // One delegated listener for every remove button — rows come and go.
    this.$('.file-list')?.addEventListener('click', this.#onListClick);
  }

  override onChange(name: string): void {
    if (name === 'data-label' || name === 'data-helper') this.#syncText();
    else this.#syncInput();
  }

  /** Label / helper text into the shadow (CSS collapses empties). */
  #syncText(): void {
    const label = this.$('.label');
    if (label) label.textContent = this.dataset['label'] ?? '';
    const helper = this.$('.helper');
    if (helper) helper.textContent = this.dataset['helper'] ?? '';
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
    const files = this.hasAttribute('data-multiple') ? incoming : incoming.slice(0, 1);
    this.#files = this.hasAttribute('data-multiple') ? [...this.#files, ...files] : files;
    this.#render();
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
    this.#files.splice(idx, 1);
    this.#render();
    this.emit('files-change', { files: this.#files });
  };

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
