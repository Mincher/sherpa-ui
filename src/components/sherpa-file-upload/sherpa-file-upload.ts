/**
 * sherpa-file-upload — a drop zone plus a list of picked files.
 *
 * CSS owns the drag highlight and the disabled look; JS holds the files.
 */
import { SherpaElement, coerceNum } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaFileUpload extends SherpaElement {
  static override css = new URL('./sherpa-file-upload.css', import.meta.url);
  static override html = new URL('./sherpa-file-upload.html', import.meta.url);
  static override props = {
    /* An upload is in flight — the host sets it, CSS shows the bar. */
    'data-loading': { type: 'boolean', kind: 'style' },
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-helper': { type: 'string', kind: 'content', to: '.helper' },
  } as const;

  static override observed = ['data-max-size', 'data-accept', 'data-multiple', 'disabled'];

  /** The hidden native file input. */
  #input: HTMLInputElement | null = null;
  /** The files picked so far. */
  #files: File[] = [];
  /** Drag-enter counter — survives dragenter/leave on nested children. */
  #dragDepth = 0;

  override onRender(): void {
    this.#input = this.$<HTMLInputElement>('.file-input');
    this.#syncText();
    this.#syncInput();

    this.$('.browse')?.addEventListener('click', this.#open);

    const zone = this.$('.drop-zone');
    zone?.addEventListener('dragenter', this.#onDragEnter);
    zone?.addEventListener('dragover', this.#onDragOver);
    zone?.addEventListener('dragleave', this.#onDragLeave);
    zone?.addEventListener('drop', this.#onDrop);

    this.#input?.addEventListener('change', this.#onInputChange);
    this.$('.file-list')?.addEventListener('button-click', this.#onListClick);
    this.$('.clear-all')?.addEventListener('button-click', this.#onClearAll);
    this.$('.upload')?.addEventListener('button-click', this.#onUpload);
  }

  override onChange(name: string): void {
    if (name === 'data-max-size' || name === 'data-accept') this.#syncText();
    if (name === 'data-accept' || name === 'data-multiple') this.#syncInput();
  }

  /** The two TEXT TEMPLATES; the label and helper are declared props. CSS
   *  collapses the empty nodes, so an absent attribute needs no branch. */
  #syncText(): void {
    const maxSize = this.$('.max-size');
    if (maxSize) maxSize.textContent = this.dataset['maxSize'] ? `Maximum file size: ${this.dataset['maxSize']}` : '';
    const allowed = this.$('.allowed-types');
    if (allowed) allowed.textContent = this.dataset['accept'] ? `Allowed file types: ${this.dataset['accept']}` : '';
  }

  /** Mirror `data-accept` and `data-multiple` onto the native input. */
  #syncInput(): void {
    const input = this.#input;
    if (!input) return;
    if (this.dataset['accept']) input.setAttribute('accept', this.dataset['accept']);
    else input.removeAttribute('accept');
    input.toggleAttribute('multiple', this.hasAttribute('data-multiple'));
  }

  /* ── Open / drag / drop ────────────────────────────────────────────── */

  /** Open the native file picker. */
  #open = (): void => {
    if (!this.hasAttribute('disabled')) this.#input?.click();
  };

  /** A drag entered: show the drop state. */
  #onDragEnter = (event: Event): void => {
    event.preventDefault();
    if (this.hasAttribute('disabled')) return;
    this.#dragDepth++;
    this.toggleAttribute('data-dragover', true);
  };

  /** Say a drop here copies. */
  #onDragOver = (event: Event): void => {
    event.preventDefault();
    const e = event as DragEvent;
    if (e.dataTransfer && !this.hasAttribute('disabled')) e.dataTransfer.dropEffect = 'copy';
  };

  /** A drag left: drop the state once it has left every child. */
  #onDragLeave = (event: Event): void => {
    event.preventDefault();
    if (--this.#dragDepth <= 0) {
      this.#dragDepth = 0;
      this.removeAttribute('data-dragover');
    }
  };

  /** Files dropped: add them. */
  #onDrop = (event: Event): void => {
    event.preventDefault();
    this.#dragDepth = 0;
    this.removeAttribute('data-dragover');
    if (this.hasAttribute('disabled')) return;
    this.#add(Array.from((event as DragEvent).dataTransfer?.files ?? []));
  };

  /** Files picked: add them, and let the same file be picked again. */
  #onInputChange = (): void => {
    this.#add(Array.from(this.#input?.files ?? []));
    if (this.#input) this.#input.value = ''; // allow re-picking the same file
  };

  /* ── File list ─────────────────────────────────────────────────────── */

  /** Add files — one replaces, unless several are allowed. */
  #add(incoming: File[]): void {
    if (!incoming.length) return;
    const added = this.hasAttribute('data-multiple') ? incoming : incoming.slice(0, 1);
    this.#files = this.hasAttribute('data-multiple') ? [...this.#files, ...added] : added;
    this.#render();
    this.emit('file-add', { added, files: this.#files });
    this.emit('files-change', { files: this.#files });
  }

  /** Size is written here because it is computed; name and index are declared. */
  #render(): void {
    this.renderItems('.file-list', 'template.file-item-tpl', this.#files, {
      after: (row, file) => {
        row.querySelector('.file-size')!.textContent = this.#formatSize(file.size);
      },
    });
    this.toggleAttribute('data-has-files', this.#files.length > 0);
  }

  /** A file's remove button. */
  #onListClick = (event: Event): void => {
    // pathFind, not target.closest: a composed sherpa-button retargets its
    // event to the host, so the path is the honest place to look.
    const btn = this.pathFind(event, '.file-remove');
    if (!btn) return;
    const row = btn.closest<HTMLElement>('.file-item');
    // -1, not Number(): `Number(null)` is 0, which would splice the FIRST file.
    const idx = coerceNum(row?.dataset['index'], -1, { int: true });
    if (idx < 0 || idx >= this.#files.length) return;
    const [removed] = this.#files.splice(idx, 1);
    this.#render();
    if (removed) this.emit('file-remove', { removed, files: this.#files });
    this.emit('files-change', { files: this.#files });
  };

  /** Remove every file. */
  #onClearAll = (): void => {
    if (this.hasAttribute('disabled') || !this.#files.length) return;
    this.#files = [];
    this.#render();
    this.emit('file-clear');
    this.emit('files-change', { files: this.#files });
  };

  /** Ask the host to upload the files. */
  #onUpload = (): void => {
    if (this.hasAttribute('disabled') || this.hasAttribute('data-loading') || !this.#files.length) return;
    this.emit('file-upload-start', { files: this.#files });
  };

  /** Set a per-file status line (e.g. "Uploading…", "Uploaded", "Failed"). */
  setFileStatus(index: number, status: string): void {
    const row = this.$$('.file-item').find(
      (r) => coerceNum((r as HTMLElement).dataset['index'], -1, { int: true }) === index,
    );
    const el = row?.querySelector('.file-status');
    if (el) el.textContent = status;
  }

  /** A byte count as B, KB or MB. */
  #formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  get files(): File[] {
    return [...this.#files];
  }
}

customElements.define('sherpa-file-upload', SherpaFileUpload);
