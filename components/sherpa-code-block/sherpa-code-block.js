/**
 * @element sherpa-code-block
 * @category utility
 * @extends SherpaElement
 * @description Syntax-highlighted, copyable code display with optional line numbers.
 *   Uses Prism.js (v1.29+) for syntax highlighting. Supports auto-language detection
 *   from content inspection. Emits code-copied event on clipboard success.
 *
 * @attr {enum}    [data-language]              — auto | html | css | js | jsx | tsx | json | yaml | bash | python | java | go | rust | sql
 * @attr {boolean} [data-line-numbers]          — Show line numbers (Prism plugin)
 * @attr {number}  [data-line-start=1]          — Starting line number for snippet context
 * @attr {string}  [data-max-height]            — Max height before scrollable (e.g., "300px")
 * @attr {string}  [data-copy-button-label]    — Button text (default: "Copy code")
 * @attr {string}  [data-copy-toast-message]   — Toast message (default: "Copied to clipboard!")
 * @attr {enum}    [data-theme=auto]            — light | dark | auto (inherits from page mode)
 * @attr {string}  [data-supported-languages]   — Read-only: comma-separated supported langs
 * @attr {string}  [data-highlight-error]      — Read-only: error message if highlighting failed
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

export class SherpaCodeBlock extends SherpaElement {
  static get cssUrl() {
    return new URL('./sherpa-code-block.css', import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL('./sherpa-code-block.html', import.meta.url).href;
  }

  // Supported languages
  static SUPPORTED_LANGUAGES = [
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
  static PRISM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0';

  #codeEl = null;
  #preEl = null;
  #copyBtnEl = null;
  #languageLabelEl = null;
  #prismLoaded = false;
  #detectedLanguage = null;
  #highlightError = null;

  static get observedAttributes() {
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

  get supportedLanguages() {
    return SherpaCodeBlock.SUPPORTED_LANGUAGES.join(',');
  }

  get highlightError() {
    return this.#highlightError;
  }

  get detectedLanguage() {
    return this.#detectedLanguage;
  }

  onRender() {
    this.#codeEl = this.$('code');
    this.#preEl = this.$('pre');
    this.#copyBtnEl = this.$('sherpa-button[class="copy-btn"]');
    this.#languageLabelEl = this.$('.code-language');

    // Set ARIA attributes
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'region');
    }
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', 'Code block');
    }

    // Wire copy button
    if (this.#copyBtnEl) {
      this.#copyBtnEl.addEventListener('click', () => this.#onCopyClick());
    }

    // Cache for data access
    this.setAttribute('data-supported-languages', this.supportedLanguages);
  }

  async onConnect() {
    await this.#loadAndHighlightCode();
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);

    if (name === 'data-max-height' && this.#preEl) {
      if (newValue) {
        this.#preEl.style.maxHeight = newValue;
      } else {
        this.#preEl.style.maxHeight = '';
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
  async highlightCode(code, language) {
    if (!code) return;

    if (this.#codeEl) {
      this.#codeEl.textContent = code;
    }

    this.#detectedLanguage = language || 'text';

    await this.#ensurePrismLoaded();
    await this.#highlightElement();
    this.#updateLanguageLabel();
  }

  /**
   * Reload Prism.js from CDN if it failed to load.
   */
  async reloadHighlighter() {
    this.#prismLoaded = false;
    this.#highlightError = null;
    this.dataset.highlightError = '';
    await this.#loadAndHighlightCode();
  }

  // ============ Private Methods ============

  async #loadAndHighlightCode() {
    const codeContent = this.textContent?.trim() || '';

    if (!codeContent) {
      this.#updateLanguageLabel();
      return;
    }

    // Set code in <code> element
    if (this.#codeEl) {
      this.#codeEl.textContent = codeContent;
    }

    // Detect language from attribute or auto-detect from content
    const requestedLanguage = this.dataset.language || 'auto';
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
    if (this.dataset.maxHeight && this.#preEl) {
      this.#preEl.style.maxHeight = this.dataset.maxHeight;
    }

    // Apply theme
    this.#applyThemeCSS();
  }

  /**
   * Auto-detect language from content.
   */
  #detectLanguage(code, requested) {
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
  #getConfidence(code, language) {
    if (language === 'text') return 0.2; // Low confidence for plaintext fallback
    if (this.dataset.language && this.dataset.language !== 'auto') return 1.0; // Explicit match
    return 0.8; // Auto-detected with reasonable confidence
  }

  /**
   * Ensure Prism.js is loaded from CDN.
   */
  async #ensurePrismLoaded() {
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
      this.dataset.highlightError = '';
    } catch (err) {
      this.#highlightError = `Failed to load syntax highlighter: ${err.message}`;
      this.dataset.highlightError = this.#highlightError;

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
  #loadScript(src, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Avoid duplicate loads
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;

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
  async #highlightElement() {
    if (!window.Prism || !this.#codeEl) return;

    // Set language class
    const langClass = `language-${this.#detectedLanguage}`;
    this.#codeEl.className = `hljs ${langClass}`;

    // Run Prism highlight
    if (window.Prism.highlightElement) {
      window.Prism.highlightElement(this.#codeEl);
    } else if (window.Prism.highlight) {
      const highlighted = window.Prism.highlight(
        this.#codeEl.textContent,
        window.Prism.languages[this.#detectedLanguage] || window.Prism.languages.text,
        this.#detectedLanguage
      );
      this.#codeEl.innerHTML = highlighted;
    }
  }

  /**
   * Apply line numbers via Prism plugin.
   */
  #applyLineNumbers() {
    if (!this.#preEl) return;

    this.#preEl.dataset.lineNumbers = 'true';

    // Set line-start if provided
    const lineStart = this.dataset.lineStart || '1';
    if (lineStart && lineStart !== '1') {
      this.#preEl.setAttribute('data-start', lineStart);
    }

    // Trigger line-numbers plugin
    if (window.Prism && window.Prism.plugins && window.Prism.plugins.lineNumbers) {
      window.Prism.plugins.lineNumbers.highlightLines(this.#preEl);
    }
  }

  /**
   * Update language label display.
   */
  #updateLanguageLabel() {
    if (!this.#languageLabelEl) return;

    const lang = this.#detectedLanguage || 'plaintext';
    const display = lang.charAt(0).toUpperCase() + lang.slice(1);
    this.#languageLabelEl.textContent = display;
  }

  /**
   * Apply theme CSS (light/dark).
   */
  #applyThemeCSS() {
    if (this.#preEl) {
      const theme = this.dataset.theme || 'auto';
      const isDark =
        theme === 'dark' || (theme === 'auto' && this.#getPageMode() === 'dark');

      this.dataset.resolvedTheme = isDark ? 'dark' : 'light';
    }
  }

  /**
   * Get current page mode (light/dark).
   */
  #getPageMode() {
    const root = document.documentElement;
    return root.getAttribute('data-mode') || 'light';
  }

  /**
   * Handle copy button click.
   */
  async #onCopyClick() {
    const code = this.#codeEl?.textContent || '';
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
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }

  /**
   * Show copy feedback toast.
   */
  #showToast() {
    const message = this.dataset.copyToastMessage || 'Copied to clipboard!';

    // Try to use SherpaToast if available
    if (window.SherpaToast) {
      window.SherpaToast.success(message);
    } else {
      // Fallback: simple alert (can be improved)
      console.log(message);
    }
  }

  /**
   * Emit custom event.
   */
  #emit(name, detail) {
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
