/**
 * @element sherpa-code-block
 * @category utility
 * @extends SherpaElement
 * @description Syntax-highlighted, copyable code snippet display. Use in documentation panels,
 *   AI chat responses, or developer-facing UIs where formatted code needs to be displayed and
 *   copied. Prism.js is loaded lazily on first render. Specify data-language or let the
 *   component auto-detect from content. Add data-line-numbers for snippets where line
 *   references matter. The code-copied event fires on clipboard success.
 *
 * @attr {enum}    data-language              — auto | html | css | js | jsx | tsx | json | yaml | bash | python | java | go | rust | sql
 * @attr {boolean} data-line-numbers          — Show line numbers (Prism plugin)
 * @attr {number}  data-line-start=1          — Starting line number for snippet context
 * @attr {string}  data-max-height            — Max height before scrollable (e.g., "300px")
 * @attr {string}  data-copy-button-label    — Button text (default: "Copy code")
 * @attr {string}  data-copy-toast-message   — Toast message (default: "Copied to clipboard!")
 * @attr {enum}    data-theme=auto            — light | dark | auto (inherits from page mode)
 * @attr {string}  data-supported-languages   — Read-only: comma-separated supported langs
 * @attr {string}  data-highlight-error      — Read-only: error message if highlighting failed
 *
 * @fires code-copied
 *   bubbles: true, composed: true
 *   detail: { language, codeLength, success, timestamp, highlightLoaded }
 * @fires code-highlight-error
 *   bubbles: true, composed: true
 *   detail: { language, error, fallbackToPlaintext }
 * @fires code-language-detected
 *   bubbles: true, composed: true
 *   detail: { detected, requested, confidence }
 *
 * @method highlightCode(code, language)
 *   Manually highlight code with specific language.
 *   @param {string} code — Code content
 *   @param {string} language — Language identifier
 *   @returns {Promise<void>}
 *
 * @method reloadHighlighter()
 *   Reload Prism.js from CDN if it failed to load.
 *   @returns {Promise<void>}
 *
 * @prop {string} supportedLanguages — Read-only: comma-separated list of supported languages
 * @prop {string|null} highlightError — Read-only: error message if highlighting failed
 * @prop {string|null} detectedLanguage — Read-only: detected language after rendering
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

interface PrismLanguages { [key: string]: unknown; text: unknown; }
interface PrismPlugins { lineNumbers?: { highlightLines: (el: HTMLElement) => void }; }
interface PrismStatic {
  highlightElement?: (el: Element) => void;
  highlight?: (code: string | null, grammar: unknown, language: string | null) => string;
  languages: PrismLanguages;
  plugins: PrismPlugins;
}

declare global {
  interface Window {
    /** PrismJS — loaded dynamically. */
    Prism?: PrismStatic;
    /** Global SherpaToast factory, when the toast component is registered. */
    SherpaToast?: { success?: (message: string) => void };
  }
}

export class SherpaCodeBlock extends SherpaElement {
  static override get cssUrl(): string {
    return new URL('./sherpa-code-block.css', import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL('./sherpa-code-block.html', import.meta.url).href;
  }

  // Supported languages
  public static SUPPORTED_LANGUAGES = [
    'html',
    'css',
    'js',
    'javascript',
    'jsx',
    'tsx',
    'json',
    'yaml',
    'yml',
    'bash',
    'shell',
    'python',
    'java',
    'go',
    'golang',
    'rust',
    'rs',
    'sql',
    'xml',
    'markdown',
    'md',
    'typescript',
    'ts',
  ];

  // Prism.js CDN config
  public static PRISM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0';
  static readonly #PRISM_SRI: Record<string, string> = {
    'prism.min.js': 'sha512-7Z9J3l1+EYfeaPKcGXu3MS/7T+w19WtKQY/n+xzmw4hZhJ9tyYmcUS+4QqAlzhicE5LAfMQSF3iFTK9bQdTxXg==',
    'plugins/line-numbers/prism-line-numbers.min.js': 'sha512-BttltKXFyWnGZQcRWj6osIg7lbizJchuAMotOkdLxHxwt/Hyo+cl47bZU0QADg+Qt5DJwni3SbYGXeGMB5cBcw==',
  };

  public els = this.cacheElements({
    code: 'code',
    pre: { selector: 'pre', type: HTMLElement },
    copyBtn: '.copy-btn',
    languageLabel: '.language-label'
  });

  #prismLoaded = false;
  #detectedLanguage: string | null = null;
  #highlightError: string | null = null;

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-language',
      'data-line-numbers',
      'data-max-height',
      'data-copy-button-label',
      'data-copy-toast-message',
      'data-theme',
    ];
  }

  get supportedLanguages(): string {
    return SherpaCodeBlock.SUPPORTED_LANGUAGES.join(',');
  }

  get highlightError(): string | null {
    return this.#highlightError;
  }

  get detectedLanguage(): string | null {
    return this.#detectedLanguage;
  }

  override onRender(): void {

    // Set ARIA attributes
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'region');
    }
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', 'Code block');
    }

    // Wire copy button
    if (this.els.copyBtn) {
      this.els.copyBtn.addEventListener('click', () => this.#onCopyClick());
    }

    // Cache for data access
    this.setAttribute('data-supported-languages', this.supportedLanguages);
  }

  override async onConnect(): Promise<void> {
    await this.#loadAndHighlightCode();
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    super.onAttributeChanged(name, oldValue, newValue);

    if (name === 'data-max-height' && this.els.pre) {
      if (newValue) {
        this.els.pre.style.maxHeight = newValue;
      } else {
        this.els.pre.style.maxHeight = '';
      }
    }

    if (name === 'data-theme') {
      // Theme changed; re-highlight if needed
      if (this.#prismLoaded) {
        this.#applyThemeCSS();
      }
    }
  }

  /**
   * Manually highlight code with specific language.
   */
  async highlightCode(code: string, language: string): Promise<void> {
    if (!code) return;

    if (this.els.code) {
      this.els.code.textContent = code;
    }

    this.#detectedLanguage = language || 'text';

    await this.#ensurePrismLoaded();
    await this.#highlightElement();
    this.#updateLanguageLabel();
  }

  /**
   * Reload Prism.js from CDN if it failed to load.
   */
  async reloadHighlighter(): Promise<void> {
    this.#prismLoaded = false;
    this.#highlightError = null;
    this.dataset["highlightError"] = '';
    await this.#loadAndHighlightCode();
  }

  // ============ Private Methods ============

  async #loadAndHighlightCode(): Promise<void> {
    const codeContent = this.textContent?.trim() || '';

    if (!codeContent) {
      this.#updateLanguageLabel();
      return;
    }

    // Set code in <code> element
    if (this.els.code) {
      this.els.code.textContent = codeContent;
    }

    // Detect language from attribute or auto-detect from content
    const requestedLanguage = this.dataset["language"] || 'auto';
    this.#detectedLanguage = this.#detectLanguage(codeContent, requestedLanguage);

    // Emit detection event
    this.#emit('code-language-detected', {
      detected: this.#detectedLanguage,
      requested: requestedLanguage,
      confidence: this.#getConfidence(codeContent, this.#detectedLanguage),
    });

    // Load Prism if needed
    await this.#ensurePrismLoaded();

    // Highlight code
    await this.#highlightElement();

    // Update language label
    this.#updateLanguageLabel();

    // Apply line numbers if enabled
    if (this.hasAttribute('data-line-numbers')) {
      this.#applyLineNumbers();
    }

    // Apply max-height if set
    if (this.dataset["maxHeight"] && this.els.pre) {
      this.els.pre.style.maxHeight = this.dataset["maxHeight"];
    }

    // Apply theme
    this.#applyThemeCSS();
  }

  /**
   * Auto-detect language from content.
   */
  #detectLanguage(code: string, requested: string): string {
    // If explicitly requested and not 'auto', use it
    if (requested && requested !== 'auto') {
      return requested;
    }

    // Heuristics for auto-detection
    if (code.match(/^\s*<[!?]?[\w:]/)) return 'html'; // XML/HTML tags
    if (code.match(/^\s*{.*}/s)) return 'json'; // JSON braces
    if (code.match(/^\s*---\s*$/m)) return 'yaml'; // YAML front matter
    if (code.match(/^\s*#!|^\s*#!/)) return 'bash'; // Shebang
    if (code.match(/^\s*(?:def|class|if|for|import)/m)) return 'python'; // Python keywords
    if (code.match(/^\s*(?:const|let|var|function|class|async)/m)) {
      return 'javascript'; // JS keywords
    }
    if (code.match(/^\s*(?:func|package|import)/m)) return 'go'; // Go keywords
    if (code.match(/^\s*(?:fn|let|pub|impl|trait)/m)) return 'rust'; // Rust keywords

    // Check for CSS
    if (code.match(/{\s*[a-z-]+\s*:/mi)) return 'css';

    // Check for SQL
    if (code.match(/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i)) return 'sql';

    // Default
    return 'text';
  }

  /**
   * Confidence score for language detection (0-1).
   */
  #getConfidence(_code: string, language: string | null): number {
    if (language === 'text') return 0.2; // Low confidence for plaintext fallback
    if (this.dataset["language"] && this.dataset["language"] !== 'auto') return 1.0; // Explicit match
    return 0.8; // Auto-detected with reasonable confidence
  }

  /**
   * Ensure Prism.js is loaded from CDN.
   */
  async #ensurePrismLoaded(): Promise<void> {
    if (this.#prismLoaded && window.Prism) {
      return;
    }

    try {
      // Check if Prism already loaded globally
      if (window.Prism) {
        this.#prismLoaded = true;
        return;
      }

      // Load Prism core
      await this.#loadScript(`${SherpaCodeBlock.PRISM_CDN}/prism.min.js`);

      // Load line-numbers plugin if needed
      if (this.hasAttribute('data-line-numbers')) {
        await this.#loadScript(
          `${SherpaCodeBlock.PRISM_CDN}/plugins/line-numbers/prism-line-numbers.min.js`
        );
      }

      this.#prismLoaded = true;
      this.#highlightError = null;
      this.dataset["highlightError"] = '';
    } catch (err) {
      this.#highlightError = `Failed to load syntax highlighter: ${(err as Error).message}`;
      this.dataset["highlightError"] = this.#highlightError;

      this.#emit('code-highlight-error', {
        language: this.#detectedLanguage,
        error: this.#highlightError,
        fallbackToPlaintext: true,
      });

      // Continue without highlighting
      this.#prismLoaded = false;
    }
  }

  /**
   * Load script from CDN with timeout.
   */
  #loadScript(src: string, timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      // Avoid duplicate loads
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';

      // Apply SRI integrity hash if we have one for this path
      const cdnBase = SherpaCodeBlock.PRISM_CDN + '/';
      if (src.startsWith(cdnBase)) {
        const path = src.slice(cdnBase.length);
        const hash = SherpaCodeBlock.#PRISM_SRI[path];
        if (hash) script.integrity = hash;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Script load timeout: ${src}`));
      }, timeout);

      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Failed to load: ${src}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Highlight code element using Prism.
   */
  async #highlightElement(): Promise<void> {
    if (!window.Prism || !this.els.code) return;

    // Set language class
    const langClass = `language-${this.#detectedLanguage}`;
    this.els.code.className = `hljs ${langClass}`;

    // Run Prism highlight
    if (window.Prism.highlightElement) {
      window.Prism.highlightElement(this.els.code);
    } else if (window.Prism.highlight) {
      const highlighted = window.Prism.highlight(
        this.els.code.textContent,
        window.Prism.languages[this.#detectedLanguage ?? "text"] || window.Prism.languages.text,
        this.#detectedLanguage
      );
      this.els.code.innerHTML = highlighted;
    }
  }

  /**
   * Apply line numbers via Prism plugin.
   */
  #applyLineNumbers(): void {
    if (!this.els.pre) return;

    this.els.pre.dataset["lineNumbers"] = 'true';

    // Set line-start if provided
    const lineStart = this.dataset["lineStart"] || '1';
    if (lineStart && lineStart !== '1') {
      this.els.pre.setAttribute('data-start', lineStart);
    }

    // Trigger line-numbers plugin
    if (window.Prism && window.Prism.plugins && window.Prism.plugins.lineNumbers) {
      window.Prism.plugins.lineNumbers.highlightLines(this.els.pre);
    }
  }

  /**
   * Update language label display.
   */
  #updateLanguageLabel(): void {
    if (!this.els.languageLabel) return;

    const lang = this.#detectedLanguage || 'plaintext';
    const display = lang.charAt(0).toUpperCase() + lang.slice(1);
    this.els.languageLabel.textContent = display;
  }

  /**
   * Apply theme CSS (light/dark).
   */
  #applyThemeCSS(): void {
    if (this.els.pre) {
      const theme = this.dataset["theme"] || 'auto';
      const isDark =
        theme === 'dark' || (theme === 'auto' && this.#getPageMode() === 'dark');

      this.dataset["resolvedTheme"] = isDark ? 'dark' : 'light';
    }
  }

  /**
   * Get current page mode (light/dark).
   */
  #getPageMode(): string {
    const root = document.documentElement;
    return root.getAttribute('data-mode') || 'light';
  }

  /**
   * Handle copy button click.
   */
  async #onCopyClick(): Promise<void> {
    const code = this.els.code?.textContent || '';
    if (!code) return;

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback to older API
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // Emit success event
      this.#emit('code-copied', {
        language: this.#detectedLanguage,
        codeLength: code.length,
        success: true,
        timestamp: Date.now(),
        highlightLoaded: this.#prismLoaded,
      });

      // Show toast message
      this.#showToast();
    } catch {
      // Copy failed silently — no action needed
    }
  }

  /**
   * Show copy feedback toast.
   */
  #showToast(): void {
    const message = this.dataset["copyToastMessage"] || 'Copied to clipboard!';

    // Try to use SherpaToast if available
    if (window.SherpaToast) {
      window.SherpaToast.success?.(message);
    }
  }

  /**
   * Emit custom event.
   */
  #emit(name: string, detail: unknown): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail,
      })
    );
  }
}

customElements.define('sherpa-code-block', SherpaCodeBlock);
