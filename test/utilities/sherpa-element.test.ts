// @ts-nocheck
/**
 * Tests for SherpaElement base class
 */

import { expect } from '@esm-bundle/chai';
import { SherpaElement, parseTemplates } from '../../components/utilities/sherpa-element/sherpa-element.js';
import { createFixture, waitForRender, shadowQuery, shadowQueryAll } from '../helpers/test-utils.js';

describe('SherpaElement', () => {
  describe('parseTemplates utility', () => {
    it('should return null for flat HTML without templates', () => {
      const html = '<div>Hello</div>';
      const result = parseTemplates(html);
      expect(result).to.be.null;
    });

    it('should parse single template', () => {
      const html = '<template id="default"><div>Content</div></template>';
      const result = parseTemplates(html);

      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(1);
      expect(result.has('default')).to.be.true;
      expect(result.get('default')).to.include('<div>Content</div>');
    });

    it('should parse multiple templates', () => {
      const html = `
        <template id="default"><div>Default</div></template>
        <template id="alt"><div>Alternative</div></template>
      `;
      const result = parseTemplates(html);

      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(2);
      expect(result.has('default')).to.be.true;
      expect(result.has('alt')).to.be.true;
    });

    it('should ignore templates without id attribute', () => {
      const html = `
        <template id="named"><div>Named</div></template>
        <template><div>Unnamed</div></template>
      `;
      const result = parseTemplates(html);

      expect(result.size).to.equal(1);
      expect(result.has('named')).to.be.true;
    });
  });

  describe('basic component creation', () => {
    // Create a test component
    class TestComponent extends SherpaElement {
      static get cssUrl() {
        return null; // No CSS for test
      }
      static get htmlUrl() {
        return null; // Inline template
      }

      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = '<div class="test-content"><slot></slot></div>';
        }
        super.connectedCallback();
      }
    }

    customElements.define('test-component-basic', TestComponent);

    it('should create shadow DOM', async () => {
      const el = await createFixture('<test-component-basic>Content</test-component-basic>');
      await waitForRender();

      expect(el.shadowRoot).to.exist;
      expect(el.shadowRoot.mode).to.equal('open');
    });

    it('should render slotted content', async () => {
      const el = await createFixture('<test-component-basic>Hello World</test-component-basic>');
      await waitForRender();

      expect(el.textContent.trim()).to.equal('Hello World');
    });
  });

  describe('query helpers', () => {
    class TestQueryComponent extends SherpaElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = `
            <div class="container">
              <span class="item">Item 1</span>
              <span class="item">Item 2</span>
              <span class="item">Item 3</span>
            </div>
          `;
        }
        super.connectedCallback();
      }
    }

    customElements.define('test-query-component', TestQueryComponent);

    it('should have $ query helper for single element', async () => {
      const el = await createFixture('<test-query-component></test-query-component>');
      await waitForRender();

      const container = el.$('.container');
      expect(container).to.exist;
      expect(container.className).to.equal('container');
    });

    it('should return null when element not found with $', async () => {
      const el = await createFixture('<test-query-component></test-query-component>');
      await waitForRender();

      const missing = el.$('.not-exist');
      expect(missing).to.be.null;
    });

    it('should have $$ query helper for multiple elements', async () => {
      const el = await createFixture('<test-query-component></test-query-component>');
      await waitForRender();

      const items = el.$$('.item');
      expect(items).to.have.lengthOf(3);
      expect(items[0].textContent).to.equal('Item 1');
      expect(items[1].textContent).to.equal('Item 2');
      expect(items[2].textContent).to.equal('Item 3');
    });

    it('should return empty array when no elements found with $$', async () => {
      const el = await createFixture('<test-query-component></test-query-component>');
      await waitForRender();

      const missing = el.$$('.not-exist');
      expect(missing).to.be.an('array');
      expect(missing).to.have.lengthOf(0);
    });
  });

  describe('slot presence detection', () => {
    class TestSlotComponent extends SherpaElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = `
            <div class="header-wrapper" data-has-content>
              <slot name="header"></slot>
            </div>
            <div class="content-wrapper" data-has-content>
              <slot></slot>
            </div>
            <div class="footer-wrapper" data-has-content>
              <slot name="footer"></slot>
            </div>
          `;
        }
        super.connectedCallback();
      }
    }

    customElements.define('test-slot-component', TestSlotComponent);

    it('should detect named slot content', async () => {
      const el = await createFixture(`
        <test-slot-component>
          <div slot="header">Header Content</div>
          <div>Body Content</div>
        </test-slot-component>
      `);
      await waitForRender(3);

      // Component should have data-has-header attribute
      expect(el.hasAttribute('data-has-header')).to.be.true;

      // Wrapper should have data-has-content
      const headerWrapper = shadowQuery(el, '.header-wrapper');
      expect(headerWrapper.hasAttribute('data-has-content')).to.be.true;
    });

    it('should detect default slot content', async () => {
      const el = await createFixture(`
        <test-slot-component>
          <div>Body Content</div>
        </test-slot-component>
      `);
      await waitForRender(3);

      // Component should have data-has-label for default slot
      expect(el.hasAttribute('data-has-label')).to.be.true;

      const contentWrapper = shadowQuery(el, '.content-wrapper');
      expect(contentWrapper.hasAttribute('data-has-content')).to.be.true;
    });

    it('should not set attributes for empty slots', async () => {
      const el = await createFixture(`
        <test-slot-component>
          <div slot="header">Header Only</div>
        </test-slot-component>
      `);
      await waitForRender(3);

      // Should have header
      expect(el.hasAttribute('data-has-header')).to.be.true;

      // Should NOT have footer
      expect(el.hasAttribute('data-has-footer')).to.be.false;
    });
  });

  describe('lifecycle hooks', () => {
    let renderCalled = false;
    let connectCalled = false;
    let disconnectCalled = false;
    let attrChangedCalled = false;

    class TestLifecycleComponent extends SherpaElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = '<div>Lifecycle Test</div>';
        }
        super.connectedCallback();
      }

      onRender() {
        renderCalled = true;
      }

      onConnect() {
        connectCalled = true;
      }

      onDisconnect() {
        disconnectCalled = true;
      }

      onAttributeChanged(name, oldValue, newValue) {
        attrChangedCalled = true;
      }

      static get observedAttributes() {
        return ['data-test'];
      }
    }

    customElements.define('test-lifecycle-component', TestLifecycleComponent);

    beforeEach(() => {
      renderCalled = false;
      connectCalled = false;
      disconnectCalled = false;
      attrChangedCalled = false;
    });

    it('should call onRender hook', async () => {
      const el = await createFixture('<test-lifecycle-component></test-lifecycle-component>');
      await waitForRender(3);

      expect(renderCalled).to.be.true;
    });

    it('should call onConnect hook', async () => {
      const el = await createFixture('<test-lifecycle-component></test-lifecycle-component>');
      await waitForRender(3);

      expect(connectCalled).to.be.true;
    });

    it('should call onAttributeChanged hook', async () => {
      const el = await createFixture('<test-lifecycle-component data-test="value"></test-lifecycle-component>');
      await waitForRender(3);

      // Reset flag
      attrChangedCalled = false;

      // Change attribute
      el.setAttribute('data-test', 'new-value');
      await waitForRender();

      expect(attrChangedCalled).to.be.true;
    });

    it('should call onDisconnect hook', async () => {
      const el = await createFixture('<test-lifecycle-component></test-lifecycle-component>');
      await waitForRender(3);

      // Disconnect element
      el.remove();
      await waitForRender();

      expect(disconnectCalled).to.be.true;
    });
  });

  describe('observedAttributes', () => {
    it('should include base attributes from SherpaElement', () => {
      const baseAttrs = SherpaElement.observedAttributes;

      expect(baseAttrs).to.be.an('array');
      expect(baseAttrs).to.include('data-src-html');
      expect(baseAttrs).to.include('data-src-json');
    });

    it('should allow subclasses to extend observedAttributes', () => {
      class TestExtendedComponent extends SherpaElement {
        static get observedAttributes() {
          return [...super.observedAttributes, 'data-custom'];
        }
      }

      const attrs = TestExtendedComponent.observedAttributes;

      expect(attrs).to.include('data-src-html');
      expect(attrs).to.include('data-src-json');
      expect(attrs).to.include('data-custom');
    });
  });

  describe('category and tier helpers', () => {
    it('should provide getCategory static method', () => {
      expect(SherpaElement.getCategory).to.be.a('function');
    });

    it('should provide getTier static method', () => {
      expect(SherpaElement.getTier).to.be.a('function');
    });
  });
});
